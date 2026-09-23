export default {
  async fetch(request) {

    const url = new URL(request.url);

    // Quitar prefijo /cache/
    let path = url.pathname.replace("/cache", "");

    // Servidor origen
    const origen = "http://fenixstream.duckdns.org";

    const destino = origen + path + url.search;


    // Pedir al VPS
    const respuesta = await fetch(destino, {
      method: request.method,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      },

      // Forzar caché Cloudflare
      cf: {
        cacheEverything: true,
        cacheTtl: 86400
      }
    });


    // Crear nueva respuesta
    const nuevo = new Response(
      respuesta.body,
      respuesta
    );


    // CORS para reproductores
    nuevo.headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    // Caché navegador/CDN
    nuevo.headers.set(
      "Cache-Control",
      "public, max-age=86400"
    );


    // Evitar problemas HLS
    nuevo.headers.set(
      "Accept-Ranges",
      "bytes"
    );


    // Mantener tipo correcto
    if (path.endsWith(".m3u8")) {

      nuevo.headers.set(
        "Content-Type",
        "application/vnd.apple.mpegurl"
      );

    }

    if (path.endsWith(".ts")) {

      nuevo.headers.set(
        "Content-Type",
        "video/mp2t"
      );

    }


    return nuevo;
  }
}
