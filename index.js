export default {
  async fetch(request) {

    const url = new URL(request.url);

    const path = url.pathname.replace(/^\/cache/, "");

    const origin = "http://fenixstream.duckdns.org" + path + url.search;

    const response = await fetch(origin, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const headers = new Headers(response.headers);

    // PLAYLIST EN VIVO
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


    // SEGMENTOS TS
    if (url.pathname.endsWith(".ts")) {

      headers.set(
        "Cache-Control",
        "public, max-age=5"
      );

      headers.set(
        "CDN-Cache-Control",
        "public, max-age=5"
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
