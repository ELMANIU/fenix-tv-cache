const ORIGIN = "http://fenixstream.duckdns.org";
const PREFIX = "/cache";

const PLAYLIST_PATH = "/canales/";

const TYPES = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  m4s: "video/iso.segment",
  key: "application/octet-stream"
};


function cors(headers = new Headers()) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  return headers;
}


function noCache(headers) {
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

  return headers;
}


function validPath(path) {

  try {

    const d = decodeURIComponent(path);

    return (
      d.startsWith(PLAYLIST_PATH) &&
      !d.includes("..")
    );

  } catch {

    return false;

  }

}


function rewritePlaylist(text, workerOrigin, originalURL) {


  return text
  .split("\n")
  .map(line => {


    if(
      line.startsWith("#") ||
      line.trim()===""
    ){

      return line;

    }


    try {

      let u = new URL(line, originalURL);

      return (
        workerOrigin +
        PREFIX +
        u.pathname +
        u.search
      );


    } catch {

      return line;

    }


  })
  .join("\n");


}



export default {


async fetch(request){


if(request.method==="OPTIONS"){

return new Response(null,{
status:204,
headers:cors()
});

}



if(
request.method!=="GET" &&
request.method!=="HEAD"
){

return new Response("Method not allowed",{
status:405
});

}



const url = new URL(request.url);



if(
!url.pathname.startsWith(PREFIX)
){

return new Response("404",{
status:404
});

}



const path =
url.pathname.substring(
PREFIX.length
);



if(!validPath(path)){

return new Response("invalid path",{
status:403
});

}



const ext =
path.split(".").pop().toLowerCase();



if(!TYPES[ext]){

return new Response("extension denied",{
status:403
});

}



const isPlaylist =
ext==="m3u8";



const originURL =
ORIGIN +
path +
url.search;



let headers = new Headers();

headers.set(
"User-Agent",
"Mozilla/5.0 Fenix-HLS"
);

headers.set(
"Accept",
"*/*"
);



try{


let response =
await fetch(
originURL,
{


method:request.method,


headers,


redirect:"follow",



cf:
isPlaylist

?

{

cacheEverything:false

}

:

{

cacheEverything:true,
cacheTtl:30

}



});




if(
response.status!==200
){

return new Response(
"Origin error "+response.status,
{
status:502
}
);

}




let out =
new Headers(response.headers);



out.set(
"Content-Type",
TYPES[ext]
);



out = cors(out);



let body =
response.body;



if(isPlaylist){


let text =
await response.text();



text =
rewritePlaylist(
text,
url.origin,
originURL
);



body=text;



out=noCache(out);



out.delete("ETag");
out.delete("Content-Length");
out.delete("Age");


}
else{


out.set(
"Cache-Control",
"public,max-age=30"
);


}



return new Response(
request.method==="HEAD"
?
null
:
body,
{
status:200,
headers:out
}
);



}
catch(e){


return new Response(
"Worker error: "+e.message,
{
status:500
}
);


}


}


};
