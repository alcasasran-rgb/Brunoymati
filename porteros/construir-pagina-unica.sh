#!/usr/bin/env bash
# Genera "goles-encajados.html": toda la app en un solo archivo, sin servidor.
# Se abre con doble clic en Chrome o Edge y funciona igual que la publicada
# (los datos se guardan en ese navegador).
#
#   ./construir-pagina-unica.sh
set -e
cd "$(dirname "$0")"
SALIDA="goles-encajados.html"

python3 - "$SALIDA" <<'PY'
import io, sys, re

leer = lambda p: io.open(p, encoding='utf-8').read()
html = leer('index.html')

html = re.sub(r'<link rel="stylesheet" href="assets/styles\.css">',
              lambda m: '<style>\n%s\n</style>' % leer('assets/styles.css'), html)

def inline(m):
    return '<script>\n%s\n</script>' % leer(m.group(1))
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)

io.open(sys.argv[1], 'w', encoding='utf-8').write(html)
print('Generado %s (%d KB)' % (sys.argv[1], len(html) // 1024))
PY
