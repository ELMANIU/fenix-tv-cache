// HLS publico de FFmpeg: Worker + cache de Cloudflare, sin R2.
const ORIGIN = "http://fenixstream.duckdns.org";
const PREFIX = "/cache";
const PLAYLIST_TTL = 1;       // Segundos en Cloudflare; el reproductor no la guarda.
const SEGMENT_TTL = 300;      // Los nombres de segmentos deben ser unicos.
const HEADER_TIMEOUT_MS = 15000;

const TYPES = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  m4s: "video/iso.segment",
  mp4: "video/mp4",
  aac: "audio/aac",
  vtt: "text/vtt; charset=utf-8",
  webvtt: "text/vtt; charset=utf-8",
  key: "application/octet-stream",
};

function cors(headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, If-Range, If-None-Match, If-Modified-Since");
  headers.set("Access-Control-Expose-Headers", "X-HLS-Cache, X-HLS-Edge-TTL, Age, Content-Length, Content-Range, Accept-Ranges, ETag");
  return headers;
}

function errorResponse(message, status, method = "GET") {
  const headers = cors(new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
  }));
  if (status === 405) headers.set("Allow", "GET, HEAD, OPTIONS");
  return new Response(method === "HEAD" ? null : message, { status, headers });
}

function validPath(path) {
  try {
    const decoded = decodeURIComponent(path);
    return decoded.startsWith("/canales/") &&
      !/[\\\x00-\x1f]/.test(decoded) &&
      !decoded.split("/").some(part => part === "." || part === "..");
  } catch { return false; }
}

// Reescribe segmentos, sublistas y atributos URI (claves, audio, subtitulos).
// Evita que una URL absoluta del m3u8 mande a los clientes directamente al VPS.
export function rewritePlaylist(text, originURL, workerOrigin) {
  if (!text.trimStart().startsWith("#EXTM3U")) {
    throw new Error("El origen no entrego un m3u8 valido");
  }
  function proxyURI(value) {
    const target = new URL(value, originURL);
    if (!/^https?:$/.test(target.protocol) ||
        target.host !== new URL(ORIGIN).host ||
        target.username || target.password || !validPath(target.pathname)) {
      throw new Error("La lista contiene una ruta fuera del origen configurado");
    }
    return workerOrigin + PREFIX + target.pathname + target.search;
  }
  return text.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!trimmed.startsWith("#")) return proxyURI(trimmed);
    return line.replace(/([:,])URI="([^"]*)"/g,
      (_, separator, uri) => `${separator}URI="${proxyURI(uri)}"`);
  }).join("\n");
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(new Headers()) });
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      return errorResponse("Metodo no permitido", 405, request.method);
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith(PREFIX + "/")) {
      return errorResponse("Usa /cache/canales/bitme/index.m3u8", 404, request.method);
    }
    const path = url.pathname.slice(PREFIX.length);
    const extension = path.split(".").pop().toLowerCase();
    if (!validPath(path) || !Object.hasOwn(TYPES, extension)) {
      return errorResponse("Ruta HLS no permitida", 404, request.method);
    }

    const isPlaylist = extension === "m3u8";
    // Claves e init.mp4 pueden cambiar sin cambiar de nombre: TTL corto.
    const shortLived = isPlaylist || extension === "key" || extension === "mp4";
    const ttl = shortLived ? PLAYLIST_TTL : SEGMENT_TTL;
    const originURL = ORIGIN + path + url.search;
    const originHeaders = new Headers({
      "User-Agent": "Mozilla/5.0 (Fenix-HLS-Cache)",
      "Accept": "*/*",
    });
    if (!isPlaylist) {
      for (const name of ["Range", "If-Range"]) {
        if (request.headers.has(name)) originHeaders.set(name, request.headers.get(name));
      }
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEADER_TIMEOUT_MS);
      let upstream;
      try {
        // fetch consulta primero la cache de Cloudflare. Tambien permite
        // Tiered Cache, si esta activado en la zona. No usa caches.default.
        upstream = await fetch(originURL, {
          method: request.method,
          headers: originHeaders,
          redirect: "manual",
          signal: controller.signal,
          cf: {
            cacheEverything: true,
            cacheTtlByStatus: {
              "200": ttl,
              "206": isPlaylist ? -1 : ttl,
              "201-205": -1,
              "207-599": -1,
            },
          },
        });
      } finally { clearTimeout(timer); }

      if (![200, 206].includes(upstream.status) || (isPlaylist && upstream.status !== 200)) {
        if (upstream.body) await upstream.body.cancel();
        const status = upstream.status >= 400 ? upstream.status : 502;
        return errorResponse(`El origen respondio ${upstream.status}. Revisa el canal en el VPS.`, status, request.method);
      }

      const headers = cors(new Headers(upstream.headers));
      headers.set("Content-Type", TYPES[extension]);
      headers.set("X-HLS-Cache", upstream.headers.get("CF-Cache-Status") || "UNKNOWN");
      headers.set("X-HLS-Edge-TTL", String(ttl));
      headers.delete("Set-Cookie");
      headers.delete("Expires");
      headers.delete("Pragma");
      const policy = shortLived ? "no-store, no-cache, must-revalidate" : `public, max-age=${ttl}`;
      headers.set("Cache-Control", policy);
      headers.set("CDN-Cache-Control", shortLived ? "no-store" : policy);
      headers.set("Cloudflare-CDN-Cache-Control", shortLived ? "no-store" : policy);

      let body = request.method === "HEAD" ? null : upstream.body;
      if (isPlaylist) {
        // Estos valores ya no describen el cuerpo despues de reescribirlo.
        for (const name of ["Content-Length", "Content-Encoding", "ETag", "Last-Modified", "Content-Range", "Accept-Ranges"]) {
          headers.delete(name);
        }
        if (request.method !== "HEAD") {
          body = rewritePlaylist(await upstream.text(), originURL, url.origin);
        }
      }
      return new Response(body, { status: upstream.status, headers });
    } catch (error) {
      const timedOut = error.name === "AbortError";
      return errorResponse(timedOut ? "El VPS tardo demasiado en responder" : "No se pudo obtener o interpretar el canal del VPS", timedOut ? 504 : 502, request.method);
    }
  },
};
