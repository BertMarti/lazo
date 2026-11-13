# Cómo está hecho Lazo

La parte técnica de Lazo. La guía para usarlo está en el [README](../README.md).

## Stack

- **App:** PWA y Android ([Capacitor](https://capacitorjs.com/)) sobre React 19, Vite 8 y TypeScript.
- **Servidor:** [PocketBase](https://pocketbase.io/) autoalojado, con las reglas de acceso en `server/pb/pb_migrations` y la lógica en `server/pb/pb_hooks`.
- **Enlaces de tiendas:** el servicio `server/unfurl` descarga solo los metadatos públicos (Open Graph y JSON-LD), con protección anti-SSRF.
- **Delante:** Caddy (HTTPS) y Docker Compose. Copias de seguridad con `server/backup`.
- **Pruebas:** Vitest (unitarias), Playwright (E2E y accesibilidad con axe) y `node --test` para el servidor.

## Ejecutarlo

En este PC (Windows con Smart App Control) npm, Vite, Vitest y Playwright solo funcionan en **WSL**:

```bash
# Desde Git Bash, en la raíz del repo
bash scripts/wsl.sh npm ci
bash scripts/wsl.sh npm run dev:demo     # la demo, sin servidor (DemoApi en memoria)
bash scripts/wsl.sh npm run dev          # contra un PocketBase
```

`scripts/wsl.sh` entra en `/mnt/d/Desarrollos/lazo`. Desde un worktree, usa la ruta del worktree:

```bash
wsl -e bash -lc "cd $(wslpath -a '<ruta del worktree>') && export PATH=\$HOME/.local/node/bin:\$PATH && npm ci && npm run check"
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run check` | Lint, tipos y pruebas unitarias |
| `npx playwright test` | E2E en móvil (Pixel 7) y escritorio |
| `npm run build` / `npm run build:demo` | App y demo pública (`dist-demo/`, sin servidor ni claves) |
| `npm run build:server` | Genera `meta.mjs` y las librerías de `pb_hooks/lib/` desde `src/core` |
| `npm run test:server` | Pruebas del servicio `unfurl` |
| `PB_BIN=… node --test server/test/rules.test.mjs` | Reglas de PocketBase contra un binario real (en CI) |
| `npm run test:live` | IA en vivo, con las claves de `.env.local` (sin claves se saltan) |
| `npm run rendimiento` | Mide la demo en un Android modesto y escribe [RENDIMIENTO.md](RENDIMIENTO.md) |
| `bash scripts/wsl.sh bash scripts/build-apk.sh` | APK de Android |
| `node scripts/capturas-readme.mjs` | Regenera las capturas del README en `docs/capturas/` (ver abajo) |

## Pruebas

- `test/`: Vitest. `test/core` cubre la lógica pura (dinero, visibilidad, reparto, sorteo, columnas de Excel, listas de Amazon).
- `e2e/`: Playwright contra la demo (`VITE_DEMO=1`). `PW_PORT` cambia el puerto para correr varias suites a la vez.
- `server/test/`: reglas, altas, plazas, copias y Caddyfile contra PocketBase real.

### Capturas del README

`scripts/capturas-readme.mjs` recorre la demo en un móvil de 390 × 844 (Pixel 7, modo claro) y escribe `docs/capturas/*.png`. Arranca la demo con Vite en el puerto 5513, o usa una que ya esté en marcha:

```bash
node scripts/capturas-readme.mjs
LAZO_URL=http://127.0.0.1:5173 node scripts/capturas-readme.mjs
```

## Arquitectura

| Ruta | Qué hay |
|---|---|
| `src/core/` | Lógica pura y testeada: dinero, visibilidad, estado, reparto, sorteo, columnas, metadatos y Amazon |
| `src/api/` | `Api` (interfaz), `DemoApi` (memoria, misma regla que el servidor) y `PocketBaseApi` |
| `src/ai/` | IA opcional: proveedores, mapeo de Excel, ideas por franja de edad y catálogo sin IA |
| `src/ui/` | Pantallas (`screens/`), sistema de botones (`Button.tsx`), `kit.tsx`, tarjetas y frases de estado |
| `server/` | PocketBase, `unfurl`, Docker, Caddy y copias de seguridad |
| `android/` | Capacitor (se genera con `scripts/build-apk.sh`) |

Las reglas que no se rompen (la sorpresa, el dinero en céntimos, un único sistema de botones, nada de HTML inyectado, menores, IA opcional) están en [AGENTS.md](../AGENTS.md). El diseño completo, en [la especificación](superpowers/specs/2026-11-11-lazo-design.md); el sistema visual, en [DESIGN.md](../DESIGN.md).

## Seguridad

- **La sorpresa también la protege el servidor:** las reglas de PocketBase no envían a nadie el estado ni el presupuesto de su propia lista. `canSeeStatus` en `src/core/visibility.ts` dice lo mismo en la app.
- Política y cómo avisar de un fallo: [SECURITY.md](../SECURITY.md).
- Última auditoría: [security/AUDIT.md](security/AUDIT.md).
- Secretos: `git config core.hooksPath .githooks` activa el pre-commit con gitleaks. Las claves van en `.env`, nunca en git.

## Servidor

- Guía completa (Raspberry o mini PC, HTTPS, acceso desde fuera, copias, actualizar): [HOMELAB.md](HOMELAB.md).
- Versión corta, en 15 minutos: [PRUEBA-REAL.md](PRUEBA-REAL.md).

## Modelos y su función

La IA es **opcional** y está **apagada por defecto**: Lazo funciona entero sin ella.

| Motor | Para qué | Cuándo elegirlo |
|---|---|---|
| **Sin IA** | Columnas de Excel por sinónimos y ajuste a mano; ideas de un catálogo por edades | Siempre disponible |
| **Ollama** (en tu casa) | Entender Excel raros y sugerir ideas por edad, gustos y presupuesto | Lo recomendado: gratis y nada sale de tu red |
| **Claude** o **Gemini de pago** | Lo mismo, con tu clave | Si no tienes Ollama |
| Groq, OpenRouter, NVIDIA y la capa gratuita de Gemini | Lo mismo | Solo para probar: sus condiciones no encajan con el uso diario en la UE ([detalles](legal/proveedores.md)) |

La clave de la IA se queda en tu dispositivo: el servidor de Lazo nunca la ve. A la IA nunca le llega el nombre de un niño ni su año de nacimiento, solo una franja de edad («6–8 años»).

Los modelos concretos de cada proveedor y los que se usan para desarrollar están en [AGENTS.md](../AGENTS.md#modelos-y-su-función).

## Colaborar

[CONTRIBUTING.md](../CONTRIBUTING.md) · [AGENTS.md](../AGENTS.md) · [CHANGELOG.md](../CHANGELOG.md) · licencia [MIT](../LICENSE)
