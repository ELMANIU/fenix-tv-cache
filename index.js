export default {
  async fetch(request) {

    const url = new URL(request.url);

    // Quita /cache para ir al origen
    const path = url.pathname.replace("/cache", "");

    const origen = "https://fenixstream.duckdns.org";

    const respuesta = await fetch(origen + path + url.search, {
      method: request.method,
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      }
    });


    const headers = new Headers(respuesta.headers);

    headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    // EL VIVO SIEMPRE DEBE ACTUALIZARSE
    if (path.endsWith(".m3u8")) {

      headers.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate, max-age=0"
      );

      headers.set(
        "CDN-Cache-Control",
        "no-store"
      );

      headers.set(
        "Pragma",
        "no-cache"
      );

    }


    // LOS SEGMENTOS SÍ SE PUEDEN CACHEAR
    if (path.endsWith(".ts")) {

      headers.set(
        "Cache-Control",
        "public, max-age=86400"
      );

    }


    return new Response(respuesta.body, {
      status: respuesta.status,
      headers
    });

  }
};
