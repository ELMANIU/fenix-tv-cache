export default {
  async fetch(request) {

    const url = new URL(request.url);

    // Quitar /cache del enlace
    let path = url.pathname.replace("/cache", "");

    // Servidor origen VPS
    const origen = "http://fenixstream.duckdns.org";

    const destino = origen + path + url.search;


    // Obtener archivo desde VPS
    const respuesta = await fetch(destino, {
      method: request.method,

      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      },

      cf: {
        cacheEverything: true,

        // Caché base
        cacheTtl: 86400
      }
    });


    const nuevo = new Response(
      respuesta.body,
      respuesta
    );


    // Permitir reproductores externos
    nuevo.headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    // Tipos HLS

    if (path.endsWith(".m3u8")) {

      nuevo.headers.set(
        "Content-Type",
        "application/vnd.apple.mpegurl"
      );


      // Playlist siempre actualizada
      nuevo.headers.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );

    }


    if (path.endsWith(".ts")) {

      nuevo.headers.set(
        "Content-Type",
        "video/mp2t"
      );


      // Segmentos cacheados
      nuevo.headers.set(
        "Cache-Control",
        "public, max-age=86400"
      );

    }


    // Soporte de rangos
    nuevo.headers.set(
      "Accept-Ranges",
      "bytes"
    );


    return nuevo;

  }
}
