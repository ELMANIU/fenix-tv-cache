const ORIGIN = "http://fenixstream.duckdns.org";
const PREFIX = "/cache";

const PLAYLIST_TTL = 0;
const SEGMENT_TTL = 20;
const HEADER_TIMEOUT_MS = 15000;

const TYPES = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  m4s: "video/iso.segment",
  mp4: "video/mp4",
  aac: "audio/aac",
  vtt: "text/vtt; charset=utf-8",
  webvtt: "text/vtt; charset=utf-8",
  key: "application/octet-stream",
};


function cors(headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Range, If-Range, If-None-Match, If-Modified-Since"
  );
  headers.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, ETag"
  );

  return headers;
}


function errorResponse(msg, status) {
  return new Response(msg, {
    status,
    headers: cors(new Headers({
      "Content-Type":"text/plain",
      "Cache-Control":"no-store"
    }))
  });
}


function validPath(path) {

  try {

    const decoded = decodeURIComponent(path);

    return decoded.startsWith("/canales/")
      && !decoded.includes("..")
      && !/[\\\x00-\x1f]/.test(decoded);

  } catch {

    return false;

  }

}



function rewritePlaylist(text, originURL, workerOrigin){

  if(!text.trim().startsWith("#EXTM3U")){
    throw new Error("Playlist inválida");
  }


  function proxyURI(value){

    const target = new URL(value, originURL);


    if(
      target.host !== new URL(ORIGIN).host ||
      !validPath(target.pathname)
    ){

      throw new Error("Ruta externa bloqueada");

    }


    return workerOrigin + PREFIX + target.pathname + target.search;

  }



  return text
    .split(/\r?\n/)
    .map(line=>{

      let t=line.trim();


      if(!t) return line;


      if(!t.startsWith("#")){

        return proxyURI(t);

      }


      return line.replace(
        /URI="([^"]*)"/g,
        (_,uri)=>`URI="${proxyURI(uri)}"`
      );


    })
    .join("\n");

}



export default {


async fetch(request){


if(request.method==="OPTIONS"){

 return new Response(null,{
  status:204,
  headers:cors(new Headers())
 });

}



if(!["GET","HEAD"].includes(request.method)){

 return errorResponse(
  "Método no permitido",
  405
 );

}



const url=new URL(request.url);



if(!url.pathname.startsWith(PREFIX+"/")){

 return errorResponse(
  "Ruta incorrecta",
  404
 );

}



const path=url.pathname.slice(PREFIX.length);



const ext=path.split(".").pop().toLowerCase();



if(!validPath(path) || !TYPES[ext]){

 return errorResponse(
  "Archivo no permitido",
  404
 );

}



const isPlaylist=ext==="m3u8";


const ttl=isPlaylist
 ? PLAYLIST_TTL
 : SEGMENT_TTL;



const originURL=
 ORIGIN+
 path+
 url.search;



const headersOrigin=new Headers({

 "User-Agent":
 "Mozilla/5.0 Fenix-HLS",

 "Accept":"*/*"

});



if(!isPlaylist){

 for(const h of ["Range","If-Range"]){

  if(request.headers.has(h)){

   headersOrigin.set(
    h,
    request.headers.get(h)
   );

  }

 }

}



try{


const controller=new AbortController();


const timer=setTimeout(
 ()=>controller.abort(),
 HEADER_TIMEOUT_MS
);



let response;



try{


response=await fetch(
 originURL,
 {

 method:request.method,

 headers:headersOrigin,

 redirect:"manual",

 signal:controller.signal,


 cf:{

 cacheEverything:true,

 cacheTtlByStatus:{

 "200":ttl,

 "206":ttl,

 "404":-1,

 "500":-1

 }

 }


 });


}

finally{

 clearTimeout(timer);

}



if(
 response.status!==200 &&
 response.status!==206
){

 return errorResponse(
  "Origen respondió "+response.status,
  502
 );

}




const headers=cors(
 new Headers(response.headers)
);



headers.set(
 "Content-Type",
 TYPES[ext]
);



headers.delete("Set-Cookie");
headers.delete("Expires");
headers.delete("Pragma");





if(isPlaylist){


headers.set(
 "Cache-Control",
 "no-store, no-cache, must-revalidate"
);


headers.set(
 "CDN-Cache-Control",
 "no-store"
);


headers.set(
 "Cloudflare-CDN-Cache-Control",
 "no-store"
);



for(
 const h of [
 "Content-Length",
 "ETag",
 "Last-Modified"
 ]
){

 headers.delete(h);

}



const body =
 request.method==="HEAD"
 ? null
 : rewritePlaylist(
     await response.text(),
     originURL,
     url.origin
   );



return new Response(
 body,
 {
 status:200,
 headers
 }
);



}




// SEGMENTOS TS


headers.set(
 "Cache-Control",
 `public, max-age=${SEGMENT_TTL}`
);


headers.set(
 "CDN-Cache-Control",
 `public, max-age=${SEGMENT_TTL}`
);


headers.set(
 "Cloudflare-CDN-Cache-Control",
 `public, max-age=${SEGMENT_TTL}`
);



return new Response(
 request.method==="HEAD"
 ? null
 : response.body,
 {
 status:response.status,
 headers
 }
);



}

catch(e){


return errorResponse(
 "Error: "+e.message,
 504
);


}



}


};
