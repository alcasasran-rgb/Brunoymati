# Camino DB · Freshlegs

Base de datos interna de proveedores del Camino de Santiago, organizada por
**camino → etapa → nivel de precio**.

- Los datos viven en una **Google Sheet**. La app solo lee.
- Nadie del equipo necesita tocar código para añadir, cambiar o borrar proveedores.
- Sin backend, sin login, sin base de datos. Hosting estático y gratis.

---

## 1. Desplegar en 5 pasos

**Paso 1 — Crear la Sheet.**
Entra en [sheets.new](https://sheets.new) y crea tres pestañas con estos nombres
exactos, en minúscula: `caminos`, `etapas`, `lugares`.
Abre los tres archivos de la carpeta `data/` de este repositorio
(`caminos.csv`, `etapas.csv`, `lugares.csv`) y copia el contenido de cada uno en
su pestaña. La forma más rápida: en Google Sheets, *Archivo → Importar → Subir*,
elige el CSV y marca **«Reemplazar hoja actual»**.

**Paso 2 — Compartir la Sheet.**
Botón **Compartir** (arriba a la derecha) → *Acceso general* → **Cualquier
usuario que tenga el enlace** → rol **Lector**. Sin esto la app no puede leerla.
> Ojo: esto hace la Sheet accesible para quien tenga el enlace. Lee el aviso de
> confidencialidad más abajo antes de meter tarifas netas.

**Paso 3 — Pegar el enlace en la app.**
Copia el enlace de la Sheet desde la barra del navegador. En este repositorio,
abre el archivo `config.js` (desde github.com se edita con el lápiz ✏️) y pégalo
entre las comillas:

```js
SHEET_URL: "https://docs.google.com/spreadsheets/d/1AbC...XyZ/edit",
```

Guarda (*Commit changes*).

**Paso 4 — Encender la web.**
En GitHub: pestaña **Settings → Pages → Source: GitHub Actions**. Con eso queda
publicada. A partir de ahí, cada cambio se publica solo; desde tu ordenador basta
con un comando:

```bash
./deploy.sh "he añadido hoteles de Arzúa"
```

**Paso 5 — Ponerla en el móvil.**
Abre la URL que te da GitHub Pages
(`https://alcasasran-rgb.github.io/brunoymati/`) en el móvil del mostrador →
menú del navegador → **Añadir a pantalla de inicio**. Queda como una app.

> **Los cambios en la Sheet tardan hasta 5 minutos en verse**: Google cachea el
> CSV. El botón ↻ de la cabecera fuerza una descarga nueva.

---

## 2. Cómo añadir un alojamiento nuevo (10 líneas)

1. Abre la Sheet, pestaña **lugares**.
2. Ve a la primera fila vacía del final.
3. `id`: cualquier código que no se repita. Vale `lug-014`.
4. `camino_id`: `frances`. `etapa_id`: el id de la etapa (`frances-e3` = Palas de Rei → Arzúa).
5. `localidad`: el pueblo. `categoria`: `alojamiento`. `nivel`: `VIP`, `PRO` o `LOWCOST`.
6. `nombre` y `tipo` (hotel, pazo, casa rural, pensión, albergue…).
7. `telefono` y `whatsapp` con prefijo: `+34 981 000 000`. Son los botones de la ficha.
8. `precio_orientativo`: texto libre, como lo dirías: `90–120 € hab. doble`.
9. `verificado_fecha`: la fecha de hoy en formato `2026-08-30`. A los 12 meses la ficha avisa sola.
10. `activo`: `sí`. Guarda. En el móvil, pulsa ↻ y ya está.

**Para borrar un proveedor**, no borres la fila: pon `activo` en `no`. Así
desaparece de la app pero conservas el historial y el teléfono.

---

## 3. Las tres pestañas

**caminos** — `id · nombre · descripcion · orden · activo`
**etapas** — `id · camino_id · orden · origen · destino · km · notas`
**lugares** — `id · camino_id · etapa_id · localidad · categoria · nivel · nombre ·
tipo · telefono · whatsapp · email · web · enlace_reserva · precio_orientativo ·
google_maps_url · valoracion_propia · contacto_persona · acuerdo ·
partner_freshlegs · orden · notas · verificado_fecha · activo`

Reglas que aplica la app:

| Columna | Qué acepta |
|---|---|
| `activo`, `partner_freshlegs` | `sí`, `si`, `x`, `1`, `true` = sí. Vacío o cualquier otra cosa = no. |
| `nivel` | `VIP`, `PRO`, `LOWCOST`. Obligatorio en alojamientos; puede ir vacío en el resto. |
| `categoria` | Texto libre. Las conocidas salen con nombre bonito; **una categoría nueva funciona sin tocar código**. |
| `precio_orientativo` | Texto libre. Escribe rangos si quieres. |
| `verificado_fecha` | `2026-08-30` o `30/08/2026`. Vacío = «Sin verificar» en rojo. |
| `google_maps_url` | Opcional. Si lo dejas vacío, el botón Mapa busca por nombre + localidad. |
| `orden` | Opcional. Número para forzar qué ficha sale primero. Vacío = orden alfabético. |

Las cabeceras se leen sin distinguir mayúsculas ni acentos: `Teléfono`,
`telefono` y `TELEFONO` son la misma columna.

---

## 4. Qué hace la app

- **Caminos** → tarjetas grandes de cada camino activo.
- **Camino** → sus etapas en orden, con origen, destino y km.
- **Etapa** → pestañas VIP / PRO / LOWCOST con los alojamientos, y debajo chips
  con las demás categorías **que tengan datos en esa etapa**. Las vacías no salen.
- **Ficha** → llamar, WhatsApp, web, reservar, mapa. Badge *Partner Freshlegs*,
  valoración propia y aviso naranja si hace más de 12 meses que no se verifica.
- **Buscar** → por nombre y localidad, sin importar acentos.
- **Roadbook** → marca un alojamiento por etapa y nivel, pon el nombre del cliente
  y pulsa *Imprimir / Guardar PDF*. Sale **una etapa por página**.
- **Cobertura** → tabla camino × etapa × nivel. En rojo lo que falta por conseguir.

La selección del roadbook y el nombre del cliente se guardan en el propio móvil,
no en la Sheet. Cada teléfono tiene su propia selección.

**Copia de seguridad en el móvil.** La app guarda en el teléfono la última
descarga de la Sheet. Si Google va lento o la Sheet no responde, sigues viendo
los datos con un aviso de «estás viendo la última copia». Esto **no** es modo
offline completo: si el móvil se queda sin datos, la propia web tampoco carga.

---

## 5. Aviso de confidencialidad (importante)

Sin backend no hay forma de pedir contraseña. Cualquiera que tenga la URL de la
Sheet o la de la web puede leer los datos, y una Sheet «publicada» puede acabar
indexada por Google.

Consecuencia práctica: **no escribas en la Sheet nada que te dolería ver fuera**.
En concreto, en la columna `acuerdo` pon el tipo (`tarifa neta`, `comisión`) pero
no los importes ni los porcentajes. Guarda las condiciones económicas en un
documento aparte que la app no lea.

---

## 6. Archivos del repositorio

```
index.html          la app (una sola página)
config.js           ← el único archivo que se toca: el enlace de la Sheet
assets/app.js       toda la lógica
assets/styles.css   todo el diseño
data/*.csv          los tres CSV de arranque, listos para importar en la Sheet
deploy.sh           publicar con un comando
```

Y en `DECISIONES.md`, lo que decidí por mi cuenta y lo que quedó fuera.
