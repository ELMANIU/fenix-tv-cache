export default {
async fetch(request) {

const url = new URL(request.url);

let path = url.pathname.replace("/cache","");

const origen = "http://fenixstream.duckdns.org";

const respuesta = await fetch(origen + path + url.search, {
headers:{
"User-Agent":"Mozilla/5.0"
},
cache:"no-store"
});


const nuevo = new Response(respuesta.body, respuesta);


nuevo.headers.set(
"Access-Control-Allow-Origin",
"*"
);


if(path.endsWith(".m3u8")){

nuevo.headers.set(
"Cache-Control",
"no-cache, no-store, must-revalidate"
);

nuevo.headers.set(
"CDN-Cache-Control",
"no-store"
);

nuevo.headers.set(
"Pragma",
"no-cache"
);

}


if(path.endsWith(".ts")){

nuevo.headers.set(
"Cache-Control",
"public, max-age=86400"
);

}


return nuevo;

}
}
