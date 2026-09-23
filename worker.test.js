import test from "node:test";
import assert from "node:assert/strict";
import worker, { rewritePlaylist } from "../worker.js";

const BASE = "https://fenix.example/cache/canales/bitme/";
const ORIGIN = "http://fenixstream.duckdns.org/canales/bitme/";
const list = n => `#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:${n}\n#EXTINF:10,\nsegment_${n}.ts\n`;
const request = (path, options) => new Request(BASE + path, options);

// Simula el contrato cf.cacheTtlByStatus. No sustituye la prueba en Cloudflare.
function mockCDN(t, origin) {
  const entries = new Map();
  let now = 0, calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const key = options.method + " " + url + " " + (options.headers.get("Range") || "");
    const hit = entries.get(key);
    if (hit && hit.expires > now) {
      const result = hit.response.clone();
      result.headers.set("CF-Cache-Status", "HIT");
      return result;
    }
    calls++;
    const result = await origin(url, options, calls);
    const rule = Object.entries(options.cf.cacheTtlByStatus).find(([range]) => {
      const [start, end = start] = range.split("-").map(Number);
      return result.status >= start && result.status <= end;
    });
    if (rule && rule[1] > 0) entries.set(key, { response: result.clone(), expires: now + rule[1] });
    result.headers.set("CF-Cache-Status", "MISS");
    return result;
  });
  return { advance: seconds => { now += seconds; }, calls: () => calls };
}

test("la lista se comparte brevemente y luego avanza sin fijar los primeros segmentos", async t => {
  const cdn = mockCDN(t, (_url, _options, count) => new Response(list(4870 + count), {
    headers: { "Cache-Control": "no-store", "ETag": "old", "Content-Length": "100" },
  }));
  const first = await worker.fetch(request("index.m3u8"));
  assert.match(await first.text(), /https:\/\/fenix.example\/cache\/canales\/bitme\/segment_4871.ts/);
  assert.match(first.headers.get("Cache-Control"), /no-store/);
  assert.equal(first.headers.get("ETag"), null);
  assert.equal(first.headers.get("Content-Length"), null);
  const second = await worker.fetch(request("index.m3u8"));
  assert.equal(second.headers.get("X-HLS-Cache"), "HIT");
  assert.equal(cdn.calls(), 1);
  cdn.advance(1.01);
  const third = await worker.fetch(request("index.m3u8"));
  assert.match(await third.text(), /MEDIA-SEQUENCE:4872/);
  assert.equal(cdn.calls(), 2);
});

test("el mismo segmento se reutiliza para distintos espectadores", async t => {
  const cdn = mockCDN(t, () => new Response("video", { headers: { "Cache-Control": "no-store" } }));
  for (let i = 0; i < 10; i++) {
    const result = await worker.fetch(request("segment_4871.ts"));
    assert.equal(await result.text(), "video");
    assert.equal(result.headers.get("X-HLS-Cache"), i ? "HIT" : "MISS");
  }
  assert.equal(cdn.calls(), 1);
  cdn.advance(301);
  await worker.fetch(request("segment_4871.ts"));
  assert.equal(cdn.calls(), 2);
});

test("un 404 temporal no permanece en cache e impide recuperar el segmento", async t => {
  const cdn = mockCDN(t, (_u, _o, count) => new Response(count === 1 ? "missing" : "video", { status: count === 1 ? 404 : 200 }));
  const first = await worker.fetch(request("new.ts"));
  assert.equal(first.status, 404);
  assert.equal(first.headers.get("Cache-Control"), "no-store");
  const next = await worker.fetch(request("new.ts"));
  assert.equal(next.status, 200);
  assert.equal(await next.text(), "video");
  assert.equal(cdn.calls(), 2);
});

test("sublistas, rutas absolutas y claves pasan por el Worker", () => {
  const input = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.key?token=abc"\n#EXT-X-MEDIA:TYPE=AUDIO,URI="/canales/bitme/audio/index.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\nhttp://fenixstream.duckdns.org/canales/bitme/high/index.m3u8\n';
  const output = rewritePlaylist(input, ORIGIN + "index.m3u8", "https://fenix.example");
  assert.ok(!output.includes("duckdns.org"));
  assert.match(output, /URI="https:\/\/fenix.example\/cache\/canales\/bitme\/key.key\?token=abc"/);
  assert.match(output, /https:\/\/fenix.example\/cache\/canales\/bitme\/audio\/index.m3u8/);
  assert.match(output, /https:\/\/fenix.example\/cache\/canales\/bitme\/high\/index.m3u8/);
});

test("las listas no pueden redirigir espectadores a un origen externo", () => {
  for (const uri of ["http://otro.example/x.ts", "//otro.example/x.ts", "file:///etc/data", "/privado/file.ts"]) {
    assert.throws(() => rewritePlaylist(`#EXTM3U\n${uri}`, ORIGIN + "index.m3u8", "https://fenix.example"));
  }
});

test("Range conserva los bytes parciales y Content-Range", async t => {
  mockCDN(t, (url, options) => {
    assert.equal(url, ORIGIN + "segment.ts");
    assert.equal(options.headers.get("Range"), "bytes=2-4");
    assert.equal(options.headers.get("If-Range"), '"segment"');
    return new Response("cde", { status: 206, headers: { "Content-Range": "bytes 2-4/6", "Content-Length": "3" } });
  });
  const response = await worker.fetch(request("segment.ts", { headers: { Range: "bytes=2-4", "If-Range": '"segment"' } }));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 2-4/6");
  assert.equal(await response.text(), "cde");
});

test("HEAD no devuelve cuerpo y OPTIONS no consulta el VPS", async t => {
  const cdn = mockCDN(t, (_u, options) => {
    assert.equal(options.method, "HEAD");
    return new Response(null, { headers: { "Content-Length": "1234" } });
  });
  const response = await worker.fetch(request("segment.ts", { method: "HEAD" }));
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("Content-Length"), "1234");
  const preflight = await worker.fetch(request("index.m3u8", { method: "OPTIONS" }));
  assert.equal(preflight.status, 204);
  assert.equal(cdn.calls(), 1);
});

test("una redireccion no permite saltarse el Worker", async t => {
  mockCDN(t, () => new Response(null, { status: 302, headers: { Location: "http://otro.example/direct.ts" } }));
  const response = await worker.fetch(request("segment.ts"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("Location"), null);
});

test("rechaza HTML recibido en lugar del m3u8 y errores de red", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Error</html>"));
  let response = await worker.fetch(request("index.m3u8"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  t.mock.method(globalThis, "fetch", async () => { throw new Error("connection reset"); });
  response = await worker.fetch(request("segment.ts"));
  assert.equal(response.status, 502);
});

test("conserva la consulta necesaria y no envia cookies de cada espectador al origen", async t => {
  mockCDN(t, (url, options) => {
    assert.equal(url, ORIGIN + "index.m3u8?token=canal");
    assert.equal(options.headers.get("Cookie"), null);
    assert.equal(options.headers.get("Authorization"), null);
    assert.equal(options.headers.get("Cache-Control"), null);
    return new Response(list(7));
  });
  const response = await worker.fetch(request("index.m3u8?token=canal", { headers: { Cookie: "viewer=8", Authorization: "Bearer viewer", "Cache-Control": "no-cache" } }));
  assert.equal(response.status, 200);
});

test("un prefijo incorrecto y metodos de escritura no consultan el VPS", async t => {
  const cdn = mockCDN(t, () => { throw new Error("No debe ejecutarse"); });
  for (const url of ["https://fenix.example/cachex/canales/bitme/index.m3u8", "https://fenix.example/cache/privado/index.m3u8", "https://fenix.example/cache/canales/bitme/config.json"]) {
    assert.equal((await worker.fetch(new Request(url))).status, 404);
  }
  assert.equal((await worker.fetch(request("index.m3u8", { method: "POST" }))).status, 405);
  assert.equal(cdn.calls(), 0);
});
