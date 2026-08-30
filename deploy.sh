#!/usr/bin/env bash
# Publica la app. Uso:  ./deploy.sh "lo que has cambiado"
set -e
MENSAJE="${1:-Actualización de la app}"
git add -A
git commit -m "$MENSAJE" || echo "No había cambios que guardar."
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
echo "Listo. GitHub Pages publica la nueva versión en 1–2 minutos."
