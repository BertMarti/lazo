#!/usr/bin/env bash
# Publica la demo (sin backend, datos ficticios) en Cloudflare Pages: https://lazo-demo.pages.dev
# Se ejecuta en WSL: bash scripts/wsl.sh 'bash scripts/pages-deploy.sh'
# Necesita una sesión de wrangler (`npx wrangler@4 login`) hecha por el usuario; el script no crea ni guarda claves.
# El build de la demo no lleva ninguna clave: antes de subir se comprueba que no aparece ningún valor de .env.local.
set -euo pipefail
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")/.."

npm run build:demo

if [ -f .env.local ]; then
  while IFS='=' read -r k v; do
    v="${v%\"}"; v="${v#\"}"
    [ -n "${k// }" ] && [ "${k:0:1}" != "#" ] && [ ${#v} -ge 8 ] || continue
    if grep -rqF -- "$v" dist-demo; then echo "ALTO: el valor de $k aparece en dist-demo" >&2; exit 1; fi
  done < .env.local
fi

npx -y wrangler@4 pages project list 2>/dev/null | grep -q lazo-demo || npx -y wrangler@4 pages project create lazo-demo --production-branch main
npx -y wrangler@4 pages deploy dist-demo --project-name lazo-demo --branch main --commit-dirty=true
