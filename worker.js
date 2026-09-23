const ORIGIN = "https://cablered.iptvperu.tv:1936/cablered/bitme_new/";

export default {
  async fetch(request) {

    const url = new URL(request.url);

    let path = url.pathname;

    if (path.endsWith(".m3u8")) {
      const target = ORIGIN + "playlist.m3u8";

      const response = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      let text = await response.text();

      // Reescribe segmentos para que pasen por el Worker
      text = text.replace(
        /([^#\n].*\.ts.*)/g,
        "/bitme/$1"
      );

      return new Response(text, {
        headers:{
          "Content-Type":"application/vnd.apple.mpegurl",
          "Cache-Control":"no-cache"
        }
      });
    }


    if (path.startsWith("/bitme/")) {

      const file = path.replace("/bitme/","");

      const response = await fetch(
        ORIGIN + file,
        {
          headers:{
            "User-Agent":"Mozilla/5.0"
          }
        }
      );

      return new Response(response.body,{
        headers:{
          "Content-Type":"video/mp2t",
          "Cache-Control":"public,max-age=30"
        }
      });

    }


    return new Response("OK");
  }
};
