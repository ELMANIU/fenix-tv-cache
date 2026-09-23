export default {
async fetch(request) {

const url = new URL(request.url);

const path = url.pathname.replace("/cache","");

const origin = "http://TU_IP_O_DOMINIO_DEL_VPS";

let response = await fetch(origin + path, {
  headers:{
    "User-Agent":"Mozilla/5.0"
  },
  cf:{
    cacheTtl:0,
    cacheEverything:false
  }
});


let headers = new Headers(response.headers);


headers.set("Access-Control-Allow-Origin","*");


if(path.endsWith(".m3u8")){

 headers.set(
 "Cache-Control",
 "no-store, no-cache, must-revalidate, max-age=0"
 );

 headers.set(
 "CDN-Cache-Control",
 "no-store"
 );

 headers.set(
 "Pragma",
 "no-cache"
 );

}


if(path.endsWith(".ts")){

 headers.set(
 "Cache-Control",
 "public, max-age=86400"
 );

}


return new Response(response.body,{
 status:response.status,
 headers
});


}
}
