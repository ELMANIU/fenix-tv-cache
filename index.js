export default {
  async fetch(request) {

    const url = new URL(request.url);

    // Quitar prefijo /cache/
    let path = url.pathname.replace("/cache", "");

    // VPS origen
    const origen = "http://fenixstream.duckdns.org";

    const destino = origen + path + url.search;

    const respuesta = await fetch(destino, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });


    const nuevo = new Response(respuesta.body, respuesta);


    // CORS
    nuevo.headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    // ==============================
    // PLAYLIST HLS (.m3u8)
    // Siempre actualizado
    // ==============================
    if (path.endsWith(".m3u8")) {

      nuevo.headers.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );

      nuevo.headers.set(
        "CDN-Cache-Control",
        "no-cache"
      );

      nuevo.headers.set(
        "Cloudflare-CDN-Cache-Control",
        "no-cache"
      );

    }


    // ==============================
    // SEGMENTOS HLS (.ts)
    // Se almacenan en Cloudflare
    // ==============================
    else if (path.endsWith(".ts")) {

      nuevo.headers.set(
        "Cache-Control",
        "public, max-age=86400"
      );

      nuevo.headers.set(
        "CDN-Cache-Control",
        "public, max-age=86400"
      );

    }


    // ==============================
    // Otros archivos
    // ==============================
    else {

      nuevo.headers.set(
        "Cache-Control",
        "public, max-age=3600"
      );

    }


    return nuevo;
  }
}
