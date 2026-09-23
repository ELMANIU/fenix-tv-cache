# Fenix HLS: Worker con caché, sin R2

Este paquete conserva el FFmpeg y el servidor HTTP que ya tienes. No sube nada a R2, no necesita bindings y no modifica el VPS. Reemplaza el script del Worker por `worker.js`.

## Instalar y reproducir Bitme

1. Abre tu Worker en Cloudflare y reemplaza TODO el código por `worker.js`.
2. Usa una fecha de compatibilidad reciente; la configuración incluida usa `2026-09-23`.
3. Guarda y despliega. Prueba la URL publicada, no solamente la vista previa del editor.
4. En tus reproductores usa:

   ```text
   https://TU-WORKER.TU-SUBDOMINIO.workers.dev/cache/canales/bitme/index.m3u8
   ```

   Sustituye el dominio por la URL real de tu Worker. Para otro canal, cambia `bitme` por su carpeta dentro de `/canales/`.

Si el reproductor usa `http://fenixstream.duckdns.org/canales/bitme/index.m3u8` directamente, seguirá descargando del VPS. El cambio de URL en el reproductor es necesario.

## Qué corrige

El código anterior llamaba al origen con `cacheTtl: 0` y `cacheEverything: false`, y enviaba `no-store` para los segmentos. Eso no crea la caché compartida que necesitas. El parámetro `Connection: keep-alive` tampoco convierte las peticiones de los espectadores en una sola descarga compartida.

Esta versión usa la caché nativa de `fetch()` y TTL por estado HTTP:

| Recurso | Cloudflare | Reproductor |
| --- | --- | --- |
| `.m3u8` | 1 segundo | No guardar la lista |
| `.ts`, `.m4s`, `.aac`, `.vtt`, `.webvtt` | 300 segundos | Hasta 300 segundos |
| `.key`, `.mp4` de inicialización | 1 segundo | No guardar |
| Errores HTTP | No guardar | No guardar |

Una petición atendida por la caché no descarga de nuevo ese archivo del VPS. Al caducar la lista, la siguiente petición obtiene o revalida su versión actual. No hay un temporizador que cierre el canal después de ocho segmentos.

La lista se reescribe para que segmentos, sublistas y atributos `URI` del mismo servidor apunten al Worker. Conserva los parámetros de consulta. No añade un timestamp diferente a cada reproducción: eso destruiría la reutilización de la caché. Tampoco elimina parámetros de autenticación arbitrariamente.

Los vídeos pasan como streams; el Worker solamente lee como texto las listas. Mantiene `Range`, `Content-Range` y las peticiones `HEAD`. Los errores y las redirecciones no se convierten en un archivo de vídeo guardado durante minutos.

## El límite de «como una sola persona»

Esto reduce las descargas repetidas; **no garantiza una sola descarga mundial por segmento**. Una falta de caché, una expulsión, distintas ubicaciones o solicitudes simultáneas pueden causar descargas adicionales. HLS hace peticiones de archivos; no es una única conexión permanente.

Para reducir peticiones entre ubicaciones, puedes servir el Worker en un dominio de una zona que controles en Cloudflare y activar Tiered Cache en esa zona. El código usa `fetch()`, compatible con esa función. No utiliza `caches.default`, cuya caché es local al centro de datos. Activar Tiered Cache no garantiza exactamente una descarga global ni sucede por pegar el script.

Si una única descarga global es un requisito estricto, se necesita además un coordinador o relay central por canal. No requiere necesariamente R2, pero sí otra pieza aparte de este proxy con caché.

No hay precarga cuando nadie mira. La primera petición de un archivo que falta llena la caché. No se promete que todos los archivos permanezcan guardados durante el TTL ni que el canal continúe si FFmpeg, el origen o la red dejan de funcionar.

## Verificarlo después de desplegar

Obtén la lista desde la URL del Worker, espera unos 10–15 segundos y vuelve a obtenerla. `#EXT-X-MEDIA-SEQUENCE` y los segmentos deberían avanzar. El TTL de 1 segundo limita la copia compartida; no establece la frecuencia de recarga de cada reproductor.

Para revisar un segmento, copia una URL `.ts` del m3u8 servido por el Worker y haz dos GET seguidos desde el mismo lugar:

```bash
curl -sS -D - -o /dev/null 'PEGA_AQUI_LA_URL_TS_DEL_WORKER'
curl -sS -D - -o /dev/null 'PEGA_AQUI_LA_URL_TS_DEL_WORKER'
```

Mira `X-HLS-Cache`, que copia el estado comunicado por Cloudflare:

- `HIT`: esa respuesta vino de la caché.
- `MISS` o `EXPIRED`: no había una copia fresca en esa consulta; con Tiered Cache puede existir una copia en otro nivel.
- `REVALIDATED`: Cloudflare validó una copia guardada.
- `BYPASS`, `DYNAMIC` o `UNKNOWN` de forma persistente: revisa la configuración del despliegue y las reglas de caché. El script no inventa un `HIT` si Cloudflare no lo reporta.

Haz la prueba sobre EL MISMO segmento, sin añadir consultas aleatorias. Ver solo los `.m3u8` no mide el ahorro de tráfico del vídeo. Para conocer la reducción real, compara los accesos a `.ts` en nginx y la salida de red del VPS con varios reproductores conectados al Worker.

## Evitar paradas que no puede arreglar la caché

- FFmpeg debe seguir generando segmentos completos y avanzando la secuencia. El Worker no reinicia un FFmpeg detenido.
- No reutilices una URL de segmento para contenido distinto dentro del tiempo de caché. Esto también importa cuando reinicias FFmpeg. Una opción de FFmpeg que ayuda es `-hls_start_number_source epoch`; conserva el resto de tu comando y revisa cómo construye los nombres antes de cambiarlo.
- `-hls_flags temp_file` permite publicar los segmentos cuando terminan de escribirse. Si ya tienes otros flags, se combinan: no los reemplaces a ciegas.
- No borres del VPS los segmentos aún anunciados en el m3u8 ni los recién retirados que un espectador rezagado puede pedir. FFmpeg ofrece `hls_delete_threshold` para retener más segmentos retirados.
- En una emisión viva, un `#EXT-X-ENDLIST` indica final al reproductor. No lo eliminamos artificialmente: hay que revisar por qué FFmpeg terminó la emisión.
- Evita reglas externas que guarden el `.m3u8` durante minutos. Una lista vieja puede apuntar a segmentos que el VPS ya borró.

El caso comprobado es HLS convencional de FFmpeg con segmentos TS separados. No está verificada la operación con LL-HLS, `single_file`/archivos crecientes, DRM, URLs personalizadas por espectador ni manifiestos con variables. Las referencias del manifiesto deben pertenecer a `fenixstream.duckdns.org` y estar dentro de `/canales/`. Este proxy está planteado para canales públicos; no implementa control de acceso a espectadores.

## Comprobación realizada

El 23 de septiembre de 2026, el origen real de Bitme respondió HTTP 200. Entre dos lecturas, la secuencia pasó de 4870 a 4872. La lista tenía ocho segmentos de 10 segundos, rutas relativas y no incluía `ENDLIST`. Una consulta HEAD de un segmento devolvió HTTP 200 y `Content-Type: video/mp2t`. Esto verifica que el origen avanzaba durante esa revisión; no demuestra la causa de todos los cortes ni sustituye una prueba de reproducción prolongada.

Se incluyen 11 pruebas locales del Worker. Cubren listas que avanzan, reutilización de segmentos en una simulación de caché, recuperación de un 404, reescritura, rangos, HEAD, preflight, errores y rutas. Ejecuta `npm test` con Node.js 22 o posterior; no requiere instalar dependencias. No se ha desplegado este código en tu cuenta ni medido su tasa de aciertos real en Cloudflare.

## Referencias oficiales

- Caché de `fetch()` y diferencia con Cache API: https://developers.cloudflare.com/workers/reference/how-the-cache-works/
- TTL por estado que prevalece sobre las instrucciones del origen: https://developers.cloudflare.com/workers/runtime-apis/request/
- Tiered Cache: https://developers.cloudflare.com/cache/how-to/tiered-cache/
- Respuestas de caché: https://developers.cloudflare.com/cache/concepts/cache-responses/
- Opciones HLS de FFmpeg: https://ffmpeg.org/ffmpeg-formats.html#hls-2
