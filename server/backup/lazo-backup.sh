#!/bin/sh
# Copias de seguridad de pb_data con rotación (lo lanza el cron del contenedor lazo-backup).
#   lazo-backup                      → copia en caliente: /backups/lazo-AAAAMMDD-HHMMSS.tar.gz
#   lazo-backup restore <archivo>    → restaura (con PocketBase PARADO); antes guarda lo que hubiera
set -eu
SRC=${PB_DATA:-/pb_data}
DST=${BACKUP_DIR:-/backups}
KEEP=${BACKUP_KEEP:-14}
PB_UID=1000 # usuario «lazo» de server/Dockerfile
umask 077   # las copias llevan datos de la familia: solo las lee root
ts=$(date +%Y%m%d-%H%M%S)

if [ "${1:-}" = restore ]; then
  f=${2:?Uso: lazo-backup restore /backups/lazo-AAAAMMDD-HHMMSS.tar.gz}
  [ -f "$f" ] || { echo "No existe $f" >&2; exit 1; }
  tar -tzf "$f" | grep -qx './data.db' || { echo "$f no parece una copia de Lazo" >&2; exit 1; }
  if [ -n "$(ls -A "$SRC")" ]; then
    tar -czf "$DST/antes-de-restaurar-$ts.tar.gz" -C "$SRC" .
    echo "Lo que había está en $DST/antes-de-restaurar-$ts.tar.gz"
  fi
  find "$SRC" -mindepth 1 -delete
  tar -xzf "$f" -C "$SRC"
  chown -R "$PB_UID:$PB_UID" "$SRC" 2>/dev/null || true
  echo "Restaurado $f. Ahora: docker compose start pocketbase"
  exit 0
fi

[ -f "$SRC/data.db" ] || { echo "No hay $SRC/data.db: ¿ha arrancado PocketBase alguna vez?" >&2; exit 1; }
tmp="$DST/.tmp-$ts"
trap 'rm -rf "$tmp" "$DST/lazo-$ts.tar.gz.part"' EXIT
mkdir -p "$tmp"
# .backup de SQLite: copia coherente aunque PocketBase esté escribiendo (copiar el .db a pelo no lo es).
for db in data.db auxiliary.db; do
  if [ -f "$SRC/$db" ]; then sqlite3 "$SRC/$db" ".backup '$tmp/$db'"; fi
done
[ "$(sqlite3 "$tmp/data.db" 'PRAGMA integrity_check;')" = ok ] || { echo "La copia no pasa integrity_check" >&2; exit 1; }
if [ -d "$SRC/storage" ]; then cp -a "$SRC/storage" "$tmp/"; fi
tar -czf "$DST/lazo-$ts.tar.gz.part" -C "$tmp" .
mv "$DST/lazo-$ts.tar.gz.part" "$DST/lazo-$ts.tar.gz"
# Rotación: se quedan las KEEP más recientes.
ls -1t "$DST"/lazo-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "$(date '+%F %T') copia lista: $DST/lazo-$ts.tar.gz; se guardan las $KEEP últimas"
