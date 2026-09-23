export default {
  async fetch(request) {

    const url = new URL(request.url);

    const origin =
      "http://fenixstream.duckdns.org" +
      url.pathname.replace("/cache","");

    const response = await fetch(origin, {
      headers: {
        "Cache-Control": "no-cache"
      }
    });

    const headers = new Headers(response.headers);

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

    return new Response(response.body,{
      status: response.status,
      headers
    });
  }
}
