export default {
  async fetch(request) {

    const url = new URL(request.url);

    const origin = "http://200.234.234.244";

    const target = origin + url.pathname;

    const response = await fetch(target);

    const headers = new Headers(response.headers);

    // Playlist HLS
    if (url.pathname.endsWith(".m3u8")) {
      headers.set(
        "Cache-Control",
        "public, max-age=5"
      );
    }

    // Segmentos TS
    if (url.pathname.endsWith(".ts")) {
      headers.set(
        "Cache-Control",
        "public, max-age=60"
      );
    }

    headers.set(
      "Access-Control-Allow-Origin",
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
