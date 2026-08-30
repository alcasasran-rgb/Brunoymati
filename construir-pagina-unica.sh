#!/usr/bin/env bash
# Genera "pagina-unica.html": toda la app y los datos de ejemplo en un solo
# archivo, sin servidor. Útil para enseñar la herramienta sin desplegarla:
# se abre con doble clic o se manda por WhatsApp.
#
#   ./construir-pagina-unica.sh
#
# Ojo: esta versión lleva los datos incrustados y NO lee tu Google Sheet.
# Para el uso diario, usa la app desplegada.
set -e
cd "$(dirname "$0")"
SALIDA="pagina-unica.html"

python3 - "$SALIDA" <<'PY'
import io, json, sys, re

leer = lambda p: io.open(p, encoding='utf-8').read()

html   = leer('index.html')
css    = leer('assets/styles.css')
js     = leer('assets/app.js')
datos  = {n: leer('data/%s.csv' % n) for n in ('caminos', 'etapas', 'lugares')}

# El <link> a la hoja de estilos pasa a ser un <style> con el CSS dentro.
estilo = '<style>\n%s\n</style>' % css
html = re.sub(r'<link rel="stylesheet" href="assets/styles\.css">',
              lambda m: estilo, html)

# Los <script> externos pasan a ser inline, con los CSV incrustados delante.
bloque = ('<script>\nwindow.__DATOS_EMBEBIDOS__ = %s;\nwindow.CONFIG = '
          '{ MARCA: "Freshlegs · Camino DB", MESES_VERIFICACION: 12 };\n</script>\n'
          '<script>\n%s\n</script>') % (json.dumps(datos, ensure_ascii=False), js)
html = re.sub(r'<script src="config\.js"></script>\s*<script src="assets/app\.js"></script>',
              lambda m: bloque, html)

io.open(sys.argv[1], 'w', encoding='utf-8').write(html)
print('Generado %s (%d KB)' % (sys.argv[1], len(html) // 1024))
PY
