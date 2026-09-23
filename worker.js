const ORIGIN = "https://cablered.iptvperu.tv:1936/cablered/bitme_new/";

export default {
  async fetch(request) {

    const url = new URL(request.url);
    const path = url.pathname;

    const target = ORIGIN + path.replace("/", "");

    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "no-cache"
      }
    });

  }
}
