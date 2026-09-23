const ORIGIN = "http://fenixstream.duckdns.org";
const PREFIX = "/cache";

const SEGMENT_TTL = 60;
const HEADER_TIMEOUT_MS = 15000;

const TYPES = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  m4s: "video/iso.segment",
  mp4: "video/mp4",
  aac: "audio/aac",
  vtt: "text/vtt; charset=utf-8",
  key: "application/octet-stream",
};


function cors(headers){

  headers.set(
    "Access-Control-Allow-Origin",
    "*"
  );

  headers.set(
    "Access-Control-Allow-Methods",
    "GET, HEAD, OPTIONS"
  );

  headers.set(
    "Access-Control-Allow-Headers",
    "*"
  );

  return headers;
}



function errorResponse(msg,status){

  return new Response(msg,{
    status,
    headers:cors(new Headers({
      "Cache-Control":"no-store"
    }))
  });

}



function validPath(path){

  try{

    const decoded = decodeURIComponent(path);

    return decoded.startsWith("/canales/")
      &&
      !decoded.includes("..");

  }catch{

    return false;

  }

}




function rewritePlaylist(text, originURL, workerOrigin){


  if(!text.trim().startsWith("#EXTM3U")){

    throw new Error("Playlist inválida");

  }



  function proxyURI(uri){

    const target = new URL(uri, originURL);


    return workerOrigin +
      PREFIX +
      target.pathname +
      target.search;

  }



  return text
  .split(/\r?\n/)
  .map(line=>{

    if(
      !line.trim()
      ||
      line.startsWith("#")
    ){

      return line;

    }


    return proxyURI(line);


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
"Metodo no permitido",
405
);

}




const url = new URL(request.url);



if(!url.pathname.startsWith(PREFIX)){

return errorResponse(
"Ruta incorrecta",
404
);

}



const path =
url.pathname.slice(PREFIX.length);



if(!validPath(path)){

return errorResponse(
"Ruta no válida",
404
);

}



const ext =
path.split(".").pop().toLowerCase();



if(!TYPES[ext]){

return errorResponse(
"Extension no permitida",
404
);

}



const isPlaylist =
ext==="m3u8";




const originURL =
ORIGIN +
path +
url.search;



const headersOrigen =
new Headers({

"User-Agent":
"Mozilla/5.0 Fenix-HLS",

"Accept":"*/*"

});





try{


const controller =
new AbortController();



const timer =
setTimeout(
()=>controller.abort(),
HEADER_TIMEOUT_MS
);




let response;



try{


response =
await fetch(
originURL,
{

method:request.method,

headers:headersOrigen,


// IMPORTANTE
// Playlist nunca cacheada

cf:
isPlaylist
?
{
cacheEverything:false,
cacheTtl:0
}
:
{
cacheEverything:true,
cacheTtl:SEGMENT_TTL
}


}
);


}
finally{

clearTimeout(timer);

}






if(response.status!==200){


return errorResponse(
"Origen error "+response.status,
502
);


}





const headers =
cors(
new Headers(response.headers)
);



headers.set(
"Content-Type",
TYPES[ext]
);



headers.delete(
"ETag"
);

headers.delete(
"Last-Modified"
);



let body;



if(isPlaylist){



headers.set(
"Cache-Control",
"no-store, no-cache, must-revalidate, max-age=0"
);


headers.set(
"CDN-Cache-Control",
"no-store"
);


headers.set(
"Cloudflare-CDN-Cache-Control",
"no-store"
);



const text =
await response.text();



body =
rewritePlaylist(
text,
originURL,
url.origin
);



headers.delete(
"Content-Length"
);



}
else{



headers.set(
"Cache-Control",
`public, max-age=${SEGMENT_TTL}`
);


headers.set(
"CDN-Cache-Control",
`public, max-age=${SEGMENT_TTL}`
);


body =
request.method==="HEAD"
?
null
:
response.body;



}




return new Response(
body,
{
status:200,
headers
}
);



}
catch(e){


return errorResponse(
"Error Worker: "+e.message,
502
);


}



}

};
