# Lazo en casa (homelab)

Guía para tener tu propio Lazo en una Raspberry Pi o cualquier ordenador con Docker, con el mismo estilo que [SHIELD-DNS](https://github.com/BertMarti/SHIELD-DNS) y [HEIMDALL](https://github.com/BertMarti/HEIMDALL).

## Qué se instala

| Contenedor | Para qué | Expuesto |
|---|---|---|
| `lazo-caddy` | HTTPS con Let's Encrypt y cabeceras de seguridad | Puertos 80 y 443 |
| `lazo-pb` | PocketBase: datos, reglas de la sorpresa, invitaciones, sorteo y la propia app (PWA) | Solo a través de Caddy |
| `lazo-unfurl` | Lee el título, la foto y el precio de los enlaces, con protección anti-SSRF | Nada (red interna) |

## Por qué PocketBase y no Supabase

La capa gratuita de Supabase **pausa el proyecto tras 7 días sin uso**, y Lazo se usa por temporadas (Navidad, cumpleaños). Con PocketBase los datos, incluidos los de los niños, se quedan en casa: un contenedor y una carpeta `data/` que se copia para hacer la copia de seguridad. La comparación completa está en la [spec](superpowers/specs/2026-11-11-lazo-design.md#2-backend-pocketbase-autoalojado-frente-a-supabase).

## Pasos

1. **Dominio.** Tu familia entra desde fuera de casa, así que hace falta una dirección pública. Gratis con [DuckDNS](https://www.duckdns.org): crea, por ejemplo, `milazo.duckdns.org`. Si ya usas HEIMDALL con DuckDNS, puedes usar otro subdominio de la misma cuenta.
2. **Router.** Redirige los puertos TCP 80 y 443 a la IP de la Raspberry.
   - Si prefieres no abrir puertos, usa Cloudflare Tunnel: quita los `ports` de Caddy y apunta el túnel a `lazo-caddy:80`.
3. **Configurar:**
   ```bash
   git clone https://github.com/BertMarti/lazo && cd lazo/server
   cp .env.example .env
   ```
   - En `LAZO_DOMAIN`, tu dominio.
   - En `UNFURL_KEY`, el resultado de `openssl rand -hex 32`.
4. **Arrancar:**
   ```bash
   docker compose up -d --build
   ```
5. **Crear el administrador de PocketBase.** Es solo para ti, para mantenimiento:
   ```bash
   docker compose exec pocketbase pocketbase superuser upsert tu@correo.es 'una-contraseña-larga' --dir=/pb/pb_data
   ```
   El panel `/_/` **no está publicado en Internet**: entra desde casa (`http://IP-de-la-raspberry:8090/_/` si publicas ese puerto solo en la LAN) o por la VPN de HEIMDALL.
6. **Primer grupo.** Hasta que exista el alta pública, crea tu usuario y tu primer grupo desde el panel y genera la invitación con «Invitar» en la app.

## Copias de seguridad

Basta con copiar `server/data/pb`. PocketBase también hace copias desde su panel (Settings → Backups).

## Actualizar

```bash
git pull && docker compose up -d --build
```

Las migraciones se aplican solas al arrancar.

## Modelos y su función

El servidor **no ejecuta ningún modelo de IA** ni guarda claves de IA: cada persona configura la suya en su móvil. El servidor solo lee los metadatos públicos de los enlaces (servicio `unfurl`). Quién hizo qué en el desarrollo está en [AGENTS.md](../AGENTS.md#modelos-y-su-función).
