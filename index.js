export default {
  async fetch(request) {

    const url = new URL(request.url);

    // Quita /cache para apuntar al origen
    const path = url.pathname.replace(/^\/cache/, "");

    const origin = "http://fenixstream.duckdns.org" + path + url.search;

    const response = await fetch(origin, {
      method: request.method,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Cache-Control": "no-cache"
      }
    });

    const headers = new Headers(response.headers);

    // HLS EN VIVO: nunca guardar en caché
    if (
      url.pathname.endsWith(".m3u8") ||
      url.pathname.endsWith(".ts")
    ) {

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

      headers.delete("Age");
      headers.delete("ETag");
    }

    // CORS
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
