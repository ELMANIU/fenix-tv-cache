export default {
  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    // URL del VPS
    const ORIGIN = "http://fenixstream.duckdns.org";

    // Construir URL real del VPS
    const targetUrl = ORIGIN + url.pathname + url.search;


    const isPlaylist =
      url.pathname.endsWith(".m3u8");


    const isSegment =
      url.pathname.endsWith(".ts");


    let response;


    if (isPlaylist) {

      // PLAYLIST SIEMPRE EN VIVO
      response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        cf: {
          cacheTtl: 0,
          cacheEverything: false
        }
      });


    } else {


      // SEGMENTOS TS CON CACHE
      response = await fetch(targetUrl, {

        cf: {
          cacheEverything: true,
          cacheTtl: 86400
        }

      });

    }



    const newHeaders = new Headers(response.headers);



    if (isPlaylist) {

      newHeaders.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0"
      );

      newHeaders.set(
        "Pragma",
        "no-cache"
      );

      newHeaders.set(
        "Expires",
        "0"
      );


      // Evitar que Cloudflare guarde la playlist
      newHeaders.delete("ETag");
      newHeaders.delete("Age");


    }



    if (isSegment) {

      newHeaders.set(
        "Cache-Control",
        "public, max-age=86400"
      );

    }



    return new Response(
      response.body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      }
    );


  }
};
