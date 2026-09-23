const ORIGIN = "https://cablered.iptvperu.tv:1936/cablered/bitme_new/";

export default {
 async fetch(request) {

  const url = new URL(request.url);

  if (url.pathname.endsWith(".m3u8")) {

    const res = await fetch(ORIGIN + "playlist.m3u8", {
      headers:{
        "User-Agent":"Mozilla/5.0"
      }
    });

    let body = await res.text();

    body = body.split("\n").map(line => {

      if(line && !line.startsWith("#")) {

        if(line.startsWith("http")) {
          return line;
        }

        return url.origin + "/bitme/" + line;
      }

      return line;

    }).join("\n");


    return new Response(body,{
      headers:{
        "Content-Type":"application/vnd.apple.mpegurl",
        "Cache-Control":"no-cache"
      }
    });

  }


  if(url.pathname.startsWith("/bitme/")){

    const file = url.pathname.replace("/bitme/","");

    const res = await fetch(ORIGIN + file,{
      headers:{
        "User-Agent":"Mozilla/5.0"
      }
    });


    return new Response(res.body,{
      headers:{
        "Content-Type":"video/mp2t",
        "Cache-Control":"public,max-age=30"
      }
    });

  }


  return new Response("Worker activo");

 }
}
