export default {
  async fetch(request) {

    const url = new URL(request.url);

    let path = url.pathname.replace("/cache", "");

    const origen = "http://fenixstream.duckdns.org";

    const destino = origen + path + url.search;

    let opciones = {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    };


    if (path.endsWith(".ts")) {

      opciones.cf = {
        cacheEverything: true,
        cacheTtl: 86400
      };

    } else {

      opciones.cf = {
        cacheEverything: false
      };

    }


    const respuesta = await fetch(destino, opciones);

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

      nuevo.headers.set(
        "Content-Type",
        "application/vnd.apple.mpegurl"
      );

    }


    if (path.endsWith(".ts")) {

      nuevo.headers.set(
        "Cache-Control",
        "public, max-age=86400"
      );

    }


    return nuevo;
  }
}
