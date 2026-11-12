# Copias de seguridad de Lazo: cron + sqlite3, sin red.
FROM alpine:3.22@sha256:49340b346798875b5592e5d420241f2f9cfba5f47e62ebb1446a1b34734e898f
RUN apk add --no-cache sqlite tzdata openssl
COPY lazo-backup.sh /usr/local/bin/lazo-backup
RUN chmod 755 /usr/local/bin/lazo-backup
# La salida de cada copia va a los logs del contenedor (docker compose logs backup).
CMD ["/bin/sh", "-c", "echo \"${BACKUP_CRON:-30 3 * * *} /usr/local/bin/lazo-backup > /proc/1/fd/1 2>&1\" > /etc/crontabs/root && exec crond -f -l 8"]
