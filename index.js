export default {
  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    let path = url.pathname.replace("/cache", "");

    const origen = "http://fenixstream.duckdns.org";

    const destino = origen + path + url.search;


    // Solo cachear segmentos TS
    const esTS = path.endsWith(".ts");


    const cache = caches.default;


    if (esTS) {

      const cacheKey = new Request(request.url, request);

      const cached = await cache.match(cacheKey);

      if (cached) {
        return cached;
      }


      const respuesta = await fetch(destino, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });


      const nuevo = new Response(respuesta.body, respuesta);


      nuevo.headers.set(
        "Access-Control-Allow-Origin",
        "*"
      );


      nuevo.headers.set(
        "Cache-Control",
        "public, max-age=86400"
      );


      ctx.waitUntil(
        cache.put(cacheKey, nuevo.clone())
      );


      return nuevo;

    }


    // Playlist m3u8 siempre fresca

    const respuesta = await fetch(destino, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });


    const nuevo = new Response(respuesta.body, respuesta);


    nuevo.headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    nuevo.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );


    return nuevo;

  }
}
