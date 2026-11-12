# Prueba real en 15 minutos

Lazo en tu casa y la familia dentro esta misma semana. Es la versión corta de [HOMELAB.md](HOMELAB.md); si algo no cuadra, la guía larga lo explica con más calma.

**Necesitas:**
- Una Raspberry Pi 4/5 o un PC con Linux y Docker (`docker compose version` responde).
- Tu móvil.
- Una forma de entrar desde fuera:
  - **DuckDNS** (gratis), si puedes abrir los puertos 80 y 443 del router.
  - **Cloudflare Tunnel**, si no puedes abrirlos o tu operador usa CG-NAT. Necesitas un dominio en Cloudflare.

## 1. Dirección pública (3 min)

**DuckDNS:**
1. En [duckdns.org](https://www.duckdns.org) crea un subdominio, por ejemplo `milazo`, y copia el token.
2. En el router, redirige TCP 80 y 443 a la IP de la Raspberry y dale a esa IP una reserva fija.

**Cloudflare Tunnel:**
1. En Zero Trust → Networks → Tunnels, crea un túnel y copia su token.
2. Añade el Public Hostname `lazo.tudominio.es` → `HTTP` → `caddy:80`. No toques el router.

## 2. Instala y arranca (5 min)

```bash
git clone https://github.com/BertMarti/lazo && cd lazo/server
cp .env.example .env
mkdir -p data/pb data/caddy data/backups && sudo chown 1000:1000 data/pb
nano .env
```

En `.env` rellena:

| Variable | DuckDNS | Cloudflare Tunnel |
|---|---|---|
| `LAZO_DOMAIN` | `milazo.duckdns.org` | `http://lazo.tudominio.es` |
| `LAZO_BIND` | `0.0.0.0` | `127.0.0.1` |
| `COMPOSE_PROFILES` | `duckdns` | `tunnel` |
| `DUCKDNS_SUBDOMAIN` y `DUCKDNS_TOKEN` | Los tuyos | — |
| `TUNNEL_TOKEN` | — | El tuyo |
| `UNFURL_KEY` | Pega el resultado de `openssl rand -hex 32` | Igual |

```bash
docker compose up -d --build
docker compose ps                      # todo «running»; lazo-pb «healthy» al minuto
docker compose logs caddy | tail -5    # DuckDNS: «certificate obtained successfully»
```

Abre `https://milazo.duckdns.org` (o tu dominio) en el móvil **con los datos móviles, sin wifi**. Si ves Lazo, ya está en Internet.

## 3. Crea tu grupo y entra (2 min)

```bash
docker compose exec pocketbase pocketbase lazo-alta "Tu nombre" "Navidad en familia" 2026-12-24 \n  --dir=/pb/pb_data --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks
```

El comando crea tu cuenta y el grupo, en el que eres quien organiza, e imprime un código de 8 letras válido durante 60 minutos. En el móvil, abre tu Lazo, pulsa **«Tengo un código»**, escríbelo y entra. En la app de Android te pedirá también la dirección de tu Lazo (`https://milazo.duckdns.org`). Si caduca, vuelve a ejecutar el comando: crea otro grupo, así que borra el viejo desde el panel (paso 5 de HOMELAB.md) o úsalo para pruebas.

## 4. Invita a la familia por WhatsApp (2 min)

1. En el grupo, pulsa el icono de **Invitar** (arriba a la derecha).
2. Para cada persona que ya sabes que viene (Marta, Papá, los abuelos), pulsa **«Añadir a alguien»**, escribe su nombre y pulsa **«Enviar enlace»**. Se abre WhatsApp con su enlace, que es **personal y de un solo uso**: mándaselo por privado.
3. Para el resto está **«Enlace para todos»**: cada uno elige su nombre o lo escribe, y tú lo aceptas comprobando el código de 4 cifras que le sale («Alguien quiere entrar como Tía Loli · código 4821»).

> Mensaje que puedes copiar: «Este año hacemos la lista de regalos con Lazo, que es de casa. Toca el enlace y elige tu nombre: no hace falta contraseña. Lo que te regalen será sorpresa 🎁 [enlace]».

## 5. Comprueba que la sorpresa funciona (3 min)

Necesitas dos móviles, o un móvil y una ventana de incógnito del ordenador.

1. **Como Marta:** entra con su enlace personal y añade dos regalos a su lista.
2. **Como tú:** abre la lista de Marta, reserva uno y marca el otro como «Ya comprado». Ponle presupuesto («Cambiar» en su lista).
3. **Vuelve a Marta** y recarga:
   - En su lista **no aparece** ni la cinta, ni «Reservado», ni «Comprado», ni el presupuesto. Solo lo que pidió.
   - Apunta una sorpresa para ella desde tu móvil: a Marta **no le aparece**, ni contada.
   - En su campana de avisos no hay nada sobre su propia lista.
4. Si los tres puntos se cumplen, la regla funciona. Lo garantiza el servidor, no solo la pantalla, y las pruebas automáticas (`server/test/rules.test.mjs` y `flujo.test.mjs`) lo comprueban persona a persona.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| No carga desde fuera, sí en casa | DuckDNS: revisa los puertos 80 y 443 del router y que la IP de DuckDNS es la de casa (`docker compose logs duckdns`). Si tu operador usa CG-NAT, pasa a Cloudflare Tunnel |
| «certificate» con errores en `logs caddy` | El puerto 80 no llega desde Internet. Ábrelo y ejecuta `docker compose restart caddy` |
| `lazo-pb` no pasa a «healthy» | Ejecuta `docker compose logs pocketbase`. Si dice «permission denied», repite `sudo chown 1000:1000 data/pb` |
| «Ese código no vale o ha caducado» | Han pasado más de 60 minutos o ya se usó: ejecuta `lazo-alta` otra vez |
| «Ese enlace ya no vale» | Los enlaces personales son de un solo uso y caducan a los 14 días. Genera otro desde «Invitar» |
| Pegar un enlace de una tienda no rellena nada | Esa tienda no deja ver sus datos. El enlace queda guardado: escribe tú el nombre y el precio |
| Alguien cambia de móvil | En el móvil viejo: Ajustes → **«Entrar en otro móvil»** da un código de 10 minutos que se escribe en el nuevo con «Tengo un código». Si perdió el móvil viejo, la app aún no permite recuperar su plaza (está en la cola de tareas): avísame y lo hacemos desde el panel |
| Quiero empezar de cero | `docker compose down`, borra `data/pb` y repite desde el paso 2. Las copias quedan en `data/backups` |

¿Algo que no está aquí? Revisa [HOMELAB.md](HOMELAB.md), que tiene problemas frecuentes, restaurar una copia y actualizar.

## Modelos y su función

| Modelo | Qué hizo en esta guía |
|---|---|
| Claude Opus 5.5 | Redacción, el comando `lazo-alta` y la entrada con código |
| Claude Fable 5.2 (`claude-fable-5-2`) | Revisión de los recorridos en el móvil que dieron forma a los pasos 4 y 5 |
