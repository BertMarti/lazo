# Lazo en casa (homelab)

Guía para tener tu propio Lazo en una Raspberry Pi o en cualquier ordenador con Docker, con el mismo estilo que [SHIELD-DNS](https://github.com/BertMarti/SHIELD-DNS) y [HEIMDALL](https://github.com/BertMarti/HEIMDALL). Tardas unos 20 minutos.

## Qué se instala

| Contenedor | Para qué | Expuesto |
|---|---|---|
| `lazo-caddy` | HTTPS con Let's Encrypt, cabeceras de seguridad y bloqueo del panel de administración | Puertos 80 y 443 |
| `lazo-pb` | PocketBase: datos, reglas de la sorpresa, invitaciones, sorteo y la propia app (PWA) | Solo a través de Caddy (y `127.0.0.1:8090` para ti) |
| `lazo-unfurl` | Lee el título, la foto y el precio de los enlaces, con protección anti-SSRF | Nada (red interna) |
| `lazo-backup` | Copia diaria de los datos, con rotación | Nada (sin red) |
| `lazo-duckdns` *(opcional)* | Mantiene tu subdominio de DuckDNS con la IP de casa | Nada |
| `lazo-cloudflared` *(opcional)* | Cloudflare Tunnel, si no quieres abrir puertos | Nada |

## Por qué PocketBase y no Supabase

La capa gratuita de Supabase **pausa el proyecto tras 7 días sin uso**, y Lazo se usa por temporadas (Navidad, cumpleaños). Con PocketBase los datos, incluidos los de los niños, se quedan en casa: un contenedor y una carpeta `data/`. La comparación completa está en la [spec](superpowers/specs/2026-11-11-lazo-design.md#2-backend-pocketbase-autoalojado-frente-a-supabase).

## Antes de empezar

- Una Raspberry Pi 4/5 (64 bits) o un PC con Linux, Docker y el plugin `docker compose`.
- Acceso a la configuración de tu router **o** una cuenta gratuita de Cloudflare con un dominio propio.
- Unos minutos para elegir cómo entrará tu familia desde fuera de casa (paso 1).

## 1. Elige cómo se entra desde fuera

Tu familia usa Lazo desde su móvil, en casa o fuera, así que hace falta una dirección pública con HTTPS. Elige **una** opción:

| | A. DuckDNS + puertos | B. Dominio propio + puertos | C. Cloudflare Tunnel |
|---|---|---|---|
| Coste | Gratis | El dominio (~10 €/año) | Gratis + el dominio |
| Abrir puertos en el router | Sí, 80 y 443 | Sí, 80 y 443 | **No** |
| Certificado HTTPS | Caddy (Let's Encrypt) | Caddy (Let's Encrypt) | Cloudflare |
| Si tu operador usa CG-NAT | No funciona | No funciona | Funciona |
| Quién ve el tráfico | Solo tu servidor | Solo tu servidor | Cloudflare descifra en su red |

**A. DuckDNS** (lo más sencillo)
1. Entra en [duckdns.org](https://www.duckdns.org) con tu cuenta y crea un subdominio, por ejemplo `milazo` → `milazo.duckdns.org`. Si ya usas HEIMDALL con DuckDNS, crea otro subdominio en la misma cuenta.
2. Copia el **token** que aparece arriba en la página. Lo usarás en el paso 3.
3. En el router, redirige los puertos **TCP 80 y 443** a la IP local de la Raspberry (por ejemplo, `192.168.1.50`). Dale a la Raspberry una IP fija (reserva DHCP) para que no cambie.

**B. Dominio propio**
1. En tu proveedor de DNS, crea un registro `A` (por ejemplo, `lazo.tudominio.es`) con la IP pública de casa. Si tu IP cambia, usa el DNS dinámico de tu proveedor o la opción A.
2. Redirige los puertos TCP 80 y 443 como en A.3.

**C. Cloudflare Tunnel** (sin abrir puertos)
1. Pon tu dominio en Cloudflare (plan Free).
2. En **Zero Trust → Networks → Tunnels**, crea un túnel de tipo *Cloudflared* y copia su **token**.
3. En **Public Hostname**, añade `lazo.tudominio.es` → servicio `HTTP` → `caddy:80`.
4. No toques el router.

> El puerto 80 hace falta en A y B: Let's Encrypt lo usa para comprobar que el dominio es tuyo, y Caddy redirige solo a HTTPS.

## 2. Descarga Lazo

```bash
git clone https://github.com/BertMarti/lazo && cd lazo/server
cp .env.example .env
mkdir -p data/pb data/caddy data/backups
sudo chown 1000:1000 data/pb   # PocketBase corre como el usuario 1000 dentro del contenedor
```

## 3. Configura `.env`

Abre `server/.env` (por ejemplo, `nano .env`) y rellena:

| Variable | A. DuckDNS | B. Dominio propio | C. Cloudflare Tunnel |
|---|---|---|---|
| `LAZO_DOMAIN` | `milazo.duckdns.org` | `lazo.tudominio.es` | `http://lazo.tudominio.es` |
| `LAZO_BIND` | `0.0.0.0` | `0.0.0.0` | `127.0.0.1` |
| `COMPOSE_PROFILES` | `duckdns` (vacío si HEIMDALL ya actualiza la IP) | vacío | `tunnel` |
| `DUCKDNS_SUBDOMAIN` y `DUCKDNS_TOKEN` | Los del paso 1 | — | — |
| `TUNNEL_TOKEN` | — | — | El del paso 1 |

Y siempre:
- `UNFURL_KEY`: pega el resultado de `openssl rand -hex 32`.
- `TZ`: tu zona horaria (`Europe/Madrid` por defecto).

`.env` no se sube nunca a git (está en `.gitignore`), y el repositorio es público: **no pongas tokens en ningún otro archivo.**

## 4. Arranca

```bash
docker compose up -d --build
docker compose ps        # todos «running»; lazo-pb «healthy» al minuto
docker compose logs -f caddy   # A y B: espera a «certificate obtained successfully»
```

Abre `https://tu-dominio` en el móvil. Si carga Lazo, ya está en Internet.

## 5. Crea el administrador de PocketBase

Es solo para ti, para mantenimiento:

```bash
docker compose exec pocketbase pocketbase superuser upsert tu@correo.es 'una-contraseña-larga' --dir=/pb/pb_data
```

El panel `/_/` y la API de administración **no están publicados en Internet**: Caddy responde 404 a `/_/`, `/api/settings`, `/api/logs`, `/api/backups`, `/api/crons` y a todo `/api/collections` salvo las colecciones y rutas que usa la app (lista blanca: así no se cuela el login de superusuario por su id). PocketBase solo escucha en `127.0.0.1:8090` de la propia Raspberry. Para entrar desde tu ordenador:

```bash
ssh -L 8090:127.0.0.1:8090 usuario@IP-de-la-raspberry
# y abre http://localhost:8090/_/
```

Fuera de casa, haz lo mismo a través de la VPN de HEIMDALL.

## 6. Primer grupo

Crea tu cuenta y tu primer grupo con un comando (tú quedas como quien organiza):

```bash
docker compose exec pocketbase pocketbase lazo-alta "Tu nombre" "Navidad en familia" 2026-12-24   --dir=/pb/pb_data --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks
```

Imprime un código de 8 letras válido durante 60 minutos: en el móvil, abre tu Lazo, pulsa «Tengo un código» y escríbelo. Después genera las invitaciones con «Invitar» en la app. Cada persona recibe **su enlace personal** (de un solo uso) y reclama su plaza.

## 7. Comprueba la seguridad

```bash
curl -sI https://tu-dominio | grep -iE 'strict-transport|x-frame|content-security'   # cabeceras presentes
curl -s -o /dev/null -w '%{http_code}\n' https://tu-dominio/_/                        # 404
curl -s -o /dev/null -w '%{http_code}\n' https://tu-dominio/api/settings              # 404
curl -s https://tu-dominio/api/health                                                 # {"message":"API is healthy."…}
# El login de superusuario tampoco se publica, ni por nombre ni por su id fijo:
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://tu-dominio/api/collections/pbc_3142635823/auth-with-password   # 404
```

Desde la wifi de casa, inventarse la IP no sirve para saltarse los límites: tras diez intentos seguidos, los últimos deben dar 429.

```bash
for i in $(seq 1 12); do curl -s -o /dev/null -w '%{http_code} ' -X POST -H "CF-Connecting-IP: 203.0.113.$i" -H 'content-type: application/json' -d '{"token":"x"}' https://tu-dominio/api/lazo/join; done; echo
```

Opcional: pasa tu dominio por [securityheaders.com](https://securityheaders.com) y [SSL Labs](https://www.ssllabs.com/ssltest/).

## Copias de seguridad

`lazo-backup` hace cada día (a las 3:30 por defecto, `BACKUP_CRON`) una copia **en caliente y coherente** de `data/pb` con `sqlite3 .backup`, comprueba su integridad y la guarda en `server/data/backups/lazo-AAAAMMDD-HHMMSS.tar.gz`. Se quedan las 14 últimas (`BACKUP_KEEP`); las más antiguas se borran solas. Las copias son legibles solo por root, porque llevan los datos de tu familia.

```bash
docker compose logs backup                                   # resultado de cada copia
docker compose exec backup lazo-backup                       # hacer una copia ahora
ls -lh data/backups/
```

**Fuera de casa.** Una copia en el mismo disco no te salva si el disco muere. Copia `data/backups` a otro sitio, por ejemplo con un cron del sistema a un NAS o un disco USB:

```bash
# crontab -e  (del usuario root de la Raspberry)
0 5 * * * rsync -a --delete /ruta/a/lazo/server/data/backups/ /mnt/nas/lazo-backups/
```

### Restaurar

```bash
docker compose stop pocketbase
docker compose run --rm backup lazo-backup restore /backups/lazo-AAAAMMDD-HHMMSS.tar.gz
docker compose start pocketbase
```

Antes de restaurar, el script guarda lo que hubiera en `data/backups/antes-de-restaurar-….tar.gz`, por si te equivocas de copia. Para llevar Lazo a otra máquina: instala hasta el paso 3, copia el `.tar.gz` a `server/data/backups/` y restaura.

## Actualizar

```bash
cd lazo && git pull && cd server
docker compose exec backup lazo-backup      # copia antes de actualizar
docker compose up -d --build
```

Las migraciones se aplican solas al arrancar.

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| Caddy no obtiene el certificado | Los puertos 80/443 no llegan (router, CG-NAT del operador) o el DNS aún no apunta a tu IP. Prueba la opción C |
| `lazo-pb` se reinicia con «permission denied» | Falta `sudo chown 1000:1000 data/pb` |
| Funciona en casa pero no fuera | Tu router no hace *NAT loopback*, o la IP de DuckDNS no está al día (`docker compose logs duckdns` debe decir `OK`) |
| Con el túnel, «Bad gateway» | En Public Hostname, el servicio debe ser `http://caddy:80` y `LAZO_DOMAIN` empezar por `http://` |

## Modelos y su función

El servidor **no ejecuta ningún modelo de IA** ni guarda claves de IA: cada persona configura la suya en su móvil. El servidor solo lee los metadatos públicos de los enlaces (servicio `unfurl`). Quién hizo qué en el desarrollo está en [AGENTS.md](../AGENTS.md#modelos-y-su-función).
