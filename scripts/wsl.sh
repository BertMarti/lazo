#!/usr/bin/env bash
# Ejecuta un comando de npm en WSL (Smart App Control bloquea rolldown y esbuild en Windows).
# Uso desde Git Bash: bash scripts/wsl.sh npm test
exec wsl -e bash -lc "cd /mnt/d/Desarrollos/lazo && export PATH=\$HOME/.local/node/bin:\$PATH && $*"
