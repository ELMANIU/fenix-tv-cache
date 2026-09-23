const ORIGIN = "https://cablered.iptvperu.tv:1936/cablered/bitme_new/playlist.m3u8";

export default {
  async fetch(request) {

    const response = await fetch(ORIGIN, {
      headers:{
        "User-Agent":"Mozilla/5.0"
      }
    });

    return new Response(response.body,{
      headers:{
        "Content-Type":"application/vnd.apple.mpegurl",
        "Cache-Control":"no-cache"
      }
    });

  }
}
