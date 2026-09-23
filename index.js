export default {
  async fetch(request) {

    const url = new URL(request.url);

    const path = url.pathname.replace(/^\/cache/, "");

    const origin = "http://fenixstream.duckdns.org" + path + url.search;

    const newRequest = new Request(origin, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Cache-Control": "no-cache"
      },
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      }
    });


    const response = await fetch(newRequest);

    const headers = new Headers(response.headers);


    if (url.pathname.endsWith(".m3u8")) {

      headers.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );

      headers.set(
        "CDN-Cache-Control",
        "no-store"
      );

      headers.set(
        "Cloudflare-CDN-Cache-Control",
        "no-store"
      );
    }


    if (url.pathname.endsWith(".ts")) {

      headers.set(
        "Cache-Control",
        "public, max-age=3"
      );

      headers.set(
        "CDN-Cache-Control",
        "public, max-age=3"
      );
    }


    headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );


    return new Response(response.body, {
      status: response.status,
      headers
    });

  }
};
