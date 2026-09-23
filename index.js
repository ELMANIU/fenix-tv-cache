export default {
  async fetch(request) {

    const url = new URL(request.url);

    const path = url.pathname.replace(/^\/cache/, "");

    const origin = "http://fenixstream.duckdns.org" + path + url.search;


    const isPlaylist = path.endsWith(".m3u8");
    const isSegment = path.endsWith(".ts");


    let response;

    try {

      response = await fetch(origin, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "*/*",
          "Connection": "keep-alive"
        },

        cf: {
          cacheTtl: 0,
          cacheEverything: false
        }
      });


    } catch (e) {

      return new Response(
        "Origin error",
        {
          status: 502
        }
      );

    }


    const headers = new Headers(response.headers);


    // Limpieza HLS
    headers.delete("ETag");
    headers.delete("Age");
    headers.delete("Last-Modified");


    // Playlist vivo
    if (isPlaylist) {

      headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );

      headers.set(
        "CDN-Cache-Control",
        "no-store"
      );

      headers.set(
        "Cloudflare-CDN-Cache-Control",
        "no-store"
      );

      headers.set(
        "Content-Type",
        "application/vnd.apple.mpegurl"
      );

    }


    // Segmentos TS
    if (isSegment) {

      headers.set(
        "Cache-Control",
        "no-store"
      );

      headers.set(
        "CDN-Cache-Control",
        "no-store"
      );

      headers.set(
        "Cloudflare-CDN-Cache-Control",
        "no-store"
      );

      headers.set(
        "Content-Type",
        "video/mp2t"
      );

    }


    headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    headers.set(
      "Access-Control-Allow-Headers",
      "*"
    );


    return new Response(
      response.body,
      {
        status: response.status,
        headers
      }
    );

  }
};
