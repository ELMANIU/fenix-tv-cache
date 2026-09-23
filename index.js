export default {
  async fetch(request) {

    const url = new URL(request.url);

    let path = url.pathname.replace("/cache", "");

    const origen = "http://fenixstream.duckdns.org";

    const destino = origen + path + url.search;


    const respuesta = await fetch(destino, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 86400
      }
    });


    const nuevo = new Response(respuesta.body, respuesta);


    nuevo.headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    if (path.endsWith(".m3u8")) {

      nuevo.headers.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );

    } else if (path.endsWith(".ts")) {

      nuevo.headers.set(
        "Cache-Control",
        "public, max-age=86400"
      );

    }


    return nuevo;
  }
}
