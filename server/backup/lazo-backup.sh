#!/bin/sh
# Copias de seguridad de pb_data con rotación (lo lanza el cron del contenedor lazo-backup).
#   lazo-backup                      → copia en caliente: /backups/lazo-AAAAMMDD-HHMMSS.tar.gz
#   lazo-backup restore <archivo>    → restaura (con PocketBase PARADO); antes guarda lo que hubiera
# Con BACKUP_PASSPHRASE en .env las copias salen cifradas (AES-256, openssl con PBKDF2) como .tar.gz.enc (V-22).
# Sin la clave no se pueden restaurar: guárdala también fuera del servidor.
set -eu
SRC=${PB_DATA:-/pb_data}
DST=${BACKUP_DIR:-/backups}
KEEP=${BACKUP_KEEP:-14}
PB_UID=1000 # usuario «lazo» de server/Dockerfile
umask 077   # las copias llevan datos de la familia: solo las lee root
ts=$(date +%Y%m%d-%H%M%S)
ENC="enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -salt -pass env:BACKUP_PASSPHRASE"
EXT=tar.gz
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then EXT=tar.gz.enc; fi

# seal <tar.gz> <destino>: cifra si hay clave; si no, lo deja tal cual.
seal() {
  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then openssl $ENC -in "$1" -out "$2" && rm -f "$1"; else mv "$1" "$2"; fi
}

if [ "${1:-}" = restore ]; then
  f=${2:?Uso: lazo-backup restore /backups/lazo-AAAAMMDD-HHMMSS.tar.gz[.enc]}
  [ -f "$f" ] || { echo "No existe $f" >&2; exit 1; }
  plain="$DST/.restaurar-$ts.tar.gz"
  trap 'rm -f "$plain" "$DST/.antes-$ts.tar.gz"' EXIT
  case $f in
    *.enc)
      [ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "$f va cifrada: falta BACKUP_PASSPHRASE en .env" >&2; exit 1; }
      openssl $ENC -d -in "$f" -out "$plain" || { echo "No se ha podido descifrar $f: ¿es la clave correcta?" >&2; exit 1; } ;;
    *) cp "$f" "$plain" ;;
  esac
  tar -tzf "$plain" | grep -qx './data.db' || { echo "$f no parece una copia de Lazo" >&2; exit 1; }
  if [ -n "$(ls -A "$SRC")" ]; then
    tar -czf "$DST/.antes-$ts.tar.gz" -C "$SRC" .
    seal "$DST/.antes-$ts.tar.gz" "$DST/antes-de-restaurar-$ts.$EXT"
    echo "Lo que había está en $DST/antes-de-restaurar-$ts.$EXT"
    # Se guardan las tres últimas (V-22): llevan los mismos datos que una copia.
    ls -1t "$DST"/antes-de-restaurar-*.tar.gz* | tail -n +4 | xargs -r rm -f
  fi
  find "$SRC" -mindepth 1 -delete
  tar -xzf "$plain" -C "$SRC"
  chown -R "$PB_UID:$PB_UID" "$SRC" 2>/dev/null || true
  echo "Restaurado $f. Ahora: docker compose start pocketbase"
  exit 0
fi

[ -f "$SRC/data.db" ] || { echo "No hay $SRC/data.db: ¿ha arrancado PocketBase alguna vez?" >&2; exit 1; }
tmp="$DST/.tmp-$ts"
trap 'rm -rf "$tmp" "$tmp.tar.gz" "$DST/lazo-$ts.$EXT.part"' EXIT
mkdir -p "$tmp"
# .backup de SQLite: copia coherente aunque PocketBase esté escribiendo (copiar el .db a pelo no lo es).
for db in data.db auxiliary.db; do
  if [ -f "$SRC/$db" ]; then sqlite3 "$SRC/$db" ".backup '$tmp/$db'"; fi
done
[ "$(sqlite3 "$tmp/data.db" 'PRAGMA integrity_check;')" = ok ] || { echo "La copia no pasa integrity_check" >&2; exit 1; }
if [ -d "$SRC/storage" ]; then cp -a "$SRC/storage" "$tmp/"; fi
tar -czf "$tmp.tar.gz" -C "$tmp" .
seal "$tmp.tar.gz" "$DST/lazo-$ts.$EXT.part"
mv "$DST/lazo-$ts.$EXT.part" "$DST/lazo-$ts.$EXT"
# Rotación: se quedan las KEEP más recientes (cifradas o no).
ls -1t "$DST"/lazo-*.tar.gz* | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "$(date '+%F %T') copia lista: $DST/lazo-$ts.$EXT; se guardan las $KEEP últimas"
