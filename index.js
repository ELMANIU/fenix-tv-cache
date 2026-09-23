export default {
  async fetch(request) {

    const url = new URL(request.url);

    let path = url.pathname.replace("/cache", "");

    const origen = "http://fenixstream.duckdns.org";

    const destino = origen + path + url.search;


    const headers = {
      "User-Agent": "Mozilla/5.0"
    };


    if (path.endsWith(".m3u8")) {

      const respuesta = await fetch(destino, {
        headers
      });

      const nuevo = new Response(respuesta.body, respuesta);

      nuevo.headers.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );

      nuevo.headers.set(
        "Access-Control-Allow-Origin",
        "*"
      );

      return nuevo;

    }


    const respuesta = await fetch(destino, {
      headers,
      cf:{
        cacheEverything:true,
        cacheTtl:86400
      }
    });


    const nuevo = new Response(respuesta.body, respuesta);


    nuevo.headers.set(
      "Cache-Control",
      "public, max-age=86400"
    );

    nuevo.headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    return nuevo;
  }
}
