# Goles encajados · app para entrenador de porteros

Registra cada gol encajado desde el clip, etiqueta la jugada con **tus 20 zonas
de campo propio y tus 8 zonas de portería**, y genera el Excel con la estructura
de tu plantilla (`LISTA GOLES` + resúmenes). Sin backend, sin login, sin coste.

URL cuando se publica: `https://alcasasran-rgb.github.io/celtafortuna/`

---

## 1. Puesta en marcha

1. Abre `config.js` y revisa porteros, rivales y jugadores. Los
   porteros también se añaden desde la app («+ Añadir portero…»).
2. Publica como el resto del repositorio (`./deploy.sh "porteros v1"`). La web
   se sirve desde la rama `main` (Settings → Pages → Deploy from a branch → `main`).
3. En el móvil o el ordenador, abre la URL → *Añadir a pantalla de inicio*.

## 2. Flujo de trabajo (un gol en menos de un minuto)

1. **Nuevo gol** → elige el clip (se guarda en este dispositivo) o pega el enlace.
2. Partido: viene prerrellenado con el último gol; con tres goles del mismo
   partido solo lo escribes una vez. El rival se elige de la lista de la liga
   (`RIVALES` en `config.js`; «+ Otro rival…» para Copa o amistosos) y con la
   jornada se marca sola la vuelta.
3. Minuto → el **periodo** y la **parte** se rellenan solos.
4. Tipo → aparecen los subtipos de tu `TABLA MAESTRA`. Goleador y asistente
   se eligen de la lista del rival (`JUGADORES` en `config.js`) o se escriben:
   lo que escribas queda recordado para ese rival.
5. Toca la **zona de disparo** en el campo → **área** y **banda** se rellenan solas.
6. Toca la **zona de portería**.
7. Opcional: valoración del portero (evitable, responsabilidad, errores, trabajo correctivo).
8. **Guardar**. Si has enlazado un archivo Excel, se actualiza solo.

## 3. El Excel

Se genera entero cada vez desde los goles guardados en la app:

| Hoja | Qué lleva |
|---|---|
| `LISTA GOLES` | Las 22 columnas de tu plantilla, en el mismo orden, + 15 columnas de análisis del portero |
| `RESUMEN` | Totales y tablas por tipo, subtipo, periodo, golpeo, marcador, área, banda, zona de portería, zona de disparo, evitabilidad, responsabilidad, errores, portero y rival |
| `MAPAS` | Por portero: rejilla de portería 2×4 y rejilla de campo 4×5 con conteos |
| `PARTIDOS` | Goles encajados, evitables y a balón parado por partido |
| `TABLA MAESTRA` | Las listas de valores y la definición de las 31 zonas |

**En Chrome o Edge de ordenador** → pestaña Excel → *Enlazar un archivo…* →
eliges dónde guardarlo una vez y a partir de ahí la app sobrescribe ese archivo
cada vez que guardas un gol. En móvil o Safari se descarga como archivo nuevo.

**Para verlo desde el móvil y otros sitios**: enlaza el archivo dentro de una
carpeta de **iCloud Drive, OneDrive, Google Drive para escritorio o Dropbox**. La app lo
sobrescribe en el ordenador, la sincronización lo sube y lo abres desde
cualquier dispositivo con Excel o la app de Drive. Los vídeos no viajan: se
quedan en el ordenador donde se añadieron.

> El Excel es la **salida**; la base de datos es la app. Si editas el Excel a
> mano, la siguiente actualización lo pisa.
> Ten el archivo **cerrado en Excel** al guardar goles: si está abierto, el
> sistema puede bloquearlo y la app no podrá escribirlo (avisa y descarga una copia).

## 4. Zonas

Numeración de tus dibujos. Izquierda y derecha son siempre las del dibujo.

**Campo propio** (portería arriba): 1 área pequeña centro · 2 frontal del área ·
3/4 área pequeña izq./dcha. · 5/6 semi izq./dcha. del área · 7/8 laterales del
área · 9/10 bandas a la altura del área · 11/12 bandas franja media · 13/14
interiores franja media **alta** · 21/22 interiores franja media **baja** ·
19 centro franja media alta · 23 centro franja media baja · 15/16 bandas franja
lejana · 17/18 interiores franja lejana · 20 centro franja lejana.
Dentro del área = 1-8. Impares = izquierda, pares = derecha.

**Portería** (vista frontal desde el campo): 1/2 alta centro izq./dcha. ·
3/4 baja centro izq./dcha. · 5/6 escuadras · 7/8 junto al palo abajo.

Si hay que mover una línea, se toca solo `assets/zonas.js`.

## 5. Icono en el escritorio

- **Mac**: abre `assets/icono-512.png` en Vista Previa, `⌘A`, `⌘C`; selecciona
  `goles-encajados.html` en el Finder, `⌘I`, clic en el icono pequeño de arriba
  a la izquierda y `⌘V`.
- **Windows**: deja `goles-encajados.html`, `icono-goles.ico` (es
  `assets/favicon.ico`) y `crear-acceso-directo.bat` en la misma carpeta y haz
  doble clic en el `.bat`: crea el acceso directo en el escritorio con el icono.
- **Publicada con URL**: Chrome → *Instalar aplicación* (o *Añadir a pantalla de
  inicio* en el móvil) usa el icono del `manifest.webmanifest`.

**Sin internet**: la primera vez que se abre la web con conexión, el navegador
guarda una copia (`sw.js`). A partir de ahí la app instalada abre sin internet;
los datos y clips siempre están en el propio ordenador. Al volver a tener
conexión se actualiza sola a la última versión publicada. Solo necesitan
internet: la copia en Google Drive y las fotos de jugadores que aún no se
hayan visto.

## 5b. Penaltis

Selector «Penaltis» arriba, entre Goles encajados y Finalización. Se registra **cada lanzamiento** en contra (gol,
parada, fuera o palo): lanzador (lista del rival), pie, carrera, zona por la
que va el balón (las 8 de portería o las tres franjas de fuera), altura, lado
al que se lanza el portero y notas. El informe muestra paradas, goles, % de
acierto de lado, mapa de lanzamientos, resultado y una tabla por lanzador; el
PDF del informe sirve para preparar al portero antes de un partido.

Un penalti que acaba en **gol** crea solo su gol en «Goles encajados»
(subtipo PENALTY, zona de disparo 2) y lo mantiene sincronizado: si se cambia
a parada o se borra, el gol desaparece. Por eso el desplegable de jugada del
informe de goles no incluye «Penalti».

## 6. Google Drive (copia automática)

Con Drive conectado, cada vez que se guarda un gol o un remate la app sube a
la carpeta «Goles encajados» de la cuenta de Google del usuario: la copia
completa (`copia-goles.json`), el Excel y el clip de vídeo (`clips/`). En otro
ordenador: Exportar → *Conectar con Google* → *Restaurar desde Drive*.

Hace falta un ID de cliente OAuth, **una sola vez** (5 minutos, cuenta de Google):

1. https://console.cloud.google.com → crear proyecto (p. ej. «Goles encajados»).
2. *APIs y servicios → Biblioteca* → buscar **Google Drive API** → *Habilitar*.
3. *APIs y servicios → Pantalla de consentimiento OAuth* → tipo **Externo** →
   nombre de la app y tu correo → guardar. En *Público* pulsa **Publicar app**
   (el permiso que usa la app, `drive.file`, no requiere verificación).
4. *APIs y servicios → Credenciales → Crear credenciales → ID de cliente de
   OAuth* → tipo **Aplicación web** → en *Orígenes de JavaScript autorizados*
   añade `https://alcasasran-rgb.github.io` → *Crear*.
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y
   pégalo en `config.js`, en `GOOGLE_CLIENT_ID`.

La app solo puede ver y tocar los archivos que ella misma crea en Drive
(permiso `drive.file`); no accede al resto de la cuenta.

## 7. Vídeos y copias

- El clip se guarda **en el navegador del dispositivo** donde lo metes. No se
  sube a ningún sitio. Para compartirlo, usa el campo *enlace* (Drive, YouTube…).
- `GUARDAR_VIDEO: false` en `config.js` si no quieres que la app almacene vídeo.
- Pestaña Excel → *Descargar copia (.json)* guarda todos los goles (sin vídeos)
  para cambiar de dispositivo o restaurar.

## 8. Archivos

```
index.html        la app
config.js         ← lo único que se toca: porteros, equipos, nombre del Excel
assets/app.js     lógica y vistas
assets/zonas.js   geometría y nombres de las 20 + 8 zonas
assets/xlsx-min.js generador de .xlsx sin librerías externas
assets/styles.css diseño
assets/finalizacion.js módulo Finalización de delanteros
assets/penaltis.js     módulo Penaltis
assets/drive.js    copia automática en Google Drive
```

## 9. Decisiones tomadas

- **Mismos valores que tu `TABLA MAESTRA`** (tipos, subtipos, golpeo…) para que
  tus tablas dinámicas sigan funcionando si copias `LISTA GOLES` a tu archivo.
- `ZONA DISPARO` pasa de 1-63 a **1-20** y `ZONA PORTERIA` de 1-35 a **1-8**.
- El subtipo `Juego Directo + ` de tu plantilla tenía el nombre sin terminar; lo
  he dejado como `Juego Directo +`. Dime qué debe decir.
- `PERIODO`, `PARTE`, `AREA` y `BANDA` se calculan solos pero se pueden cambiar.
- Añadida la capa de análisis del portero (15 columnas al final). Es opcional
  en el formulario: etiquetar rápido sigue siendo posible.
- Sin librerías externas: el .xlsx se construye en `xlsx-min.js` (ZIP sin
  comprimir; Excel, Numbers y LibreOffice lo abren igual).
- Los datos viven en el dispositivo. Sin backend no hay sincronización entre
  móvil y ordenador: usa la copia .json.
