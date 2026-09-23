export default {
  async fetch(request) {

    const url = new URL(request.url);

    const path = url.pathname;

    const origin = "http://200.234.234.244";

    const response = await fetch(origin + path, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const headers = new Headers();

    headers.set(
      "Content-Type",
      response.headers.get("Content-Type") || "application/octet-stream"
    );

    headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );

    if(path.endsWith(".m3u8")){
      headers.set(
        "Cache-Control",
        "no-cache"
      );
    }

    if(path.endsWith(".ts")){
      headers.set(
        "Cache-Control",
        "public, max-age=60"
      );
    }

    return new Response(
      response.body,
      {
        status: response.status,
        headers
      }
    );
  }
}
