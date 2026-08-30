# Decisiones tomadas y cosas que quedan fuera

## Cambios sobre el modelo que aprobaste

1. **`precio_orientativo` es texto libre, no número.** Vas a escribir «90–120 €
   hab. doble» o «menú 18 €». Un campo numérico rompería la Sheet en cuanto
   alguien meta un rango. La app no calcula nada con él.
2. **`nivel` es opcional fuera de alojamiento.** Un fisioterapeuta no es VIP ni
   LOWCOST. Si lo dejas vacío, la ficha sale igual en los chips de su categoría.
3. **`id` en texto legible** (`frances-e3`, `lug-014`) en vez de autonumérico.
   Al meter datos a mano, el error más común es equivocarse de `etapa_id`; con
   ids legibles se ve a simple vista.
4. **Columna `orden` añadida a `lugares`** (opcional, numérica): para que tu
   favorito salga el primero dentro de un nivel. Vacío = orden alfabético.
5. **`activo` y `partner_freshlegs` aceptan `sí / si / x / 1 / true`.** Cualquier
   otra cosa, o vacío, cuenta como «no».

## Decisiones que tomé sin preguntar

6. **Las filas «EJEMPLO – borrar» no cuentan en el panel de cobertura.** Si
   contaran, el panel mentiría: diría que tienes un VIP en Portomarín cuando lo
   que tienes es una fila de muestra. En la app sí se ven, con borde discontinuo
   y etiqueta EJEMPLO, para que veas el formato antes de borrarlas.
7. **Los teléfonos de ejemplo son `+34 600 000 000` y las webs `example.com`.**
   Números y direcciones deliberadamente falsos: no he inventado ni un solo
   proveedor real, tal como pediste.
8. **La conexión con la Sheet se hace pegando su enlace**, no publicando cada
   pestaña por separado. Es un paso en vez de tres. La opción de publicar por
   pestañas sigue disponible en `config.js` (`CSV_URLS`) por si algún día la
   necesitas.
9. **Copia local en el móvil.** La app guarda la última descarga en el teléfono.
   Si la Sheet va lenta o no responde, sigues viendo los datos con un aviso de
   «estás viendo la última copia». El botón ↻ fuerza la descarga.
   No he puesto *service worker* (modo offline completo) a propósito: obligaría a
   versionar la caché y el fallo típico sería «he cambiado la app y en el móvil
   sigue la vieja». Con un móvil sin datos, la web no carga; asumido.
10. **Si `google_maps_url` está vacío, el botón Mapa busca «nombre + localidad»**
    en Google Maps. Es una búsqueda, no una dirección inventada.
11. **Un alojamiento por etapa y nivel en el roadbook**: al marcar uno nuevo,
    sustituye al anterior de esa misma etapa y nivel. El resto de categorías
    (restaurantes, fisio, planes) se acumulan como extras de la etapa.
12. **La selección del roadbook vive en el móvil, no en la Sheet.** Sin backend
    no hay forma de compartirla entre dispositivos: cada teléfono lleva la suya.
13. **`camino_id` se queda en `lugares` aunque sea deducible** por `etapa_id`.
    Permite proveedores de camino sin etapa concreta (un taxi que cubre el tramo)
    y hace la Sheet legible cuando filtras a mano.
14. **La categoría es texto libre.** Escribe `lavandería exprés` en la Sheet y
    aparece su chip, con su acento y su mayúscula, sin tocar código.
15. **Las notas de las etapas 2 y 3 mencionan los centros Freshlegs** de Palas de
    Rei y Arzúa. Es información tuya, no un dato inventado; bórrala si no la
    quieres ahí.

## Lo que NO he construido

- Login, edición desde la app, reservas online, multi-idioma, mapas interactivos,
  reseñas y Booking: fuera de v1, como marcaste.
- **Ningún dato real.** Ni un alojamiento, ni un teléfono, ni un precio. Solo la
  estructura, las 5 etapas de Sarria–Santiago con sus km y 3 filas de ejemplo.
- **El Camino Portugués va sin etapas y marcado como inactivo**, tal como pediste.
  Aparece en la pantalla de inicio bajo «Inactivos», atenuado y sin enlace.

## Dos limitaciones que debes conocer

- **Confidencialidad.** Sin backend no hay contraseña posible: quien tenga la URL
  de la Sheet puede leerla. No metas importes de tarifas netas ni comisiones.
  Detalle y alternativa en el apartado 5 del README.
- **Impresión del roadbook.** El salto de página por etapa está verificado en
  Chrome (una etapa = una página exacta). Safari en iPhone lo respeta bien. En
  algunos Android el diálogo de impresión del sistema respeta peor los saltos; si
  te pasa, imprime desde Chrome de escritorio.

## Lo que yo haría a continuación (no está hecho)

- Rellenar Sarria–Portomarín entera (3 niveles) y usarla como plantilla de
  calidad para las otras cuatro etapas.
- Cuando haya 50+ proveedores, añadir un filtro «solo partners» en la vista de
  etapa. Son unas 10 líneas.
- Si algún día necesitas que el roadbook se comparta entre móviles, eso sí exige
  backend: es el primer límite real de esta arquitectura.
