# AGENTS.md · Lazo

Guía para agentes (Claude Code, OpenCode, Codex…) y personas que trabajen en el código.

## Qué es

Lazo es una app de listas de regalos en familia: PWA + Android (Capacitor) sobre React 19, Vite 8 y TypeScript, con un backend PocketBase autoalojado. El diseño completo está en `docs/superpowers/specs/2026-11-11-lazo-design.md` y el plan en `docs/superpowers/plans/2026-11-11-lazo-mvp.md`.

## Reglas que no se rompen

1. **La sorpresa (también el presupuesto).** Ningún código, pantalla, endpoint, evento en tiempo real, recuento ni caché puede revelar a X el estado ni el presupuesto de su propia lista: `canSeeStatus(viewer, list)` en `src/core/visibility.ts` y las reglas de API de PocketBase dicen lo mismo. `items` no lleva nunca campos de estado. Cualquier cambio en `claims`, `contributions` o `assignments` necesita una prueba que demuestre que el dueño no ve nada.
2. **Dinero en céntimos enteros** (`Cents`). Para repartir, `byWeights` (mayor resto); nunca `Math.round` por persona.
3. **Un único sistema de botones** (`src/ui/Button.tsx`): `Button`, `ButtonLink`, `FileButton`, `IconButton` y `ButtonGroup`. Prohibido escribir `<button className="btn…">` a mano.
4. **Sin HTML inyectado:** nada de `dangerouslySetInnerHTML` ni `innerHTML`.
5. **Menores:** solo el nombre de pila y, opcional, el año de nacimiento. A la IA, solo una franja de edad.
6. **IA opcional y apagada por defecto.** En producción solo Ollama (en casa) o una clave de pago del usuario (Claude, Gemini con facturación). Gemini gratuito, Groq, OpenRouter y NVIDIA: solo desarrollo y pruebas (`docs/legal/proveedores.md`). Las claves, solo en el dispositivo; las de `.env.local` son de desarrollo.
7. **Enlaces:** solo metadatos públicos (Open Graph y JSON-LD). Nada de selectores propios de cada tienda. La descarga siempre pasa por el servicio `unfurl` con la protección anti-SSRF.

## Cómo se trabaja

- **Este PC (Windows con Smart App Control):** npm, Vite, Vitest y Playwright se ejecutan en WSL. Desde Git Bash: `bash scripts/wsl.sh npm run check`.
- `npm run check` pasa lint, tipos y tests unitarios. `npx playwright test` pasa los E2E. Para las capturas de diseño: `CAPTURAS=docs/design/vX npx playwright test e2e/capturas.spec.ts`.
- **Demo:** `npm run dev:demo` y `npm run build:demo` usan `DemoApi`, con la familia Alberto, Javier, Samira, Marta y Papá, y sin backend.
- **Servidor:** `npm run build:server` (genera `meta.mjs` y `pb_hooks/lib/draw.cjs`), `npm run test:server` y, con el binario, `PB_BIN=… node --test server/test/rules.test.mjs`.
- **APK:** `bash scripts/wsl.sh bash scripts/build-apk.sh`.
- **IA en vivo (opcional):** con las claves gratuitas en `.env.local` (ignorado por git): `set -a; . ./.env.local; set +a; npm run test:live`. Sin claves, esas pruebas se saltan. Nunca imprimas ni subas las claves; el pre-commit y gitleaks las bloquean.
- **Secretos:** `git config core.hooksPath .githooks` activa el pre-commit con gitleaks. Las claves van en `.env` (ver `.env.example`), nunca en git.
- **Versiones:** semver. Cada cambio visible para el usuario va al CHANGELOG (Keep a Changelog, sección «Sin publicar»). Al publicar: subir `package.json`, tag `vX.Y.Z` y GitHub Release con las notas del CHANGELOG.
- **Commits** pequeños, en español, con la línea `Co-Authored-By` del agente.
- **CI:** el repo es público y GitHub Actions no cuesta nada, pero los workflows llevan `concurrency` con cancel-in-progress y caché.

## Mapa del código

| Ruta | Qué hay |
|---|---|
| `src/core/` | Lógica pura y testeada: dinero, visibilidad, estado, reparto, sorteo, columnas, metadatos y Amazon |
| `src/api/` | `Api` (interfaz), `DemoApi` (memoria, misma regla que el servidor) y `PocketBaseApi` |
| `src/ai/` | IA opcional: `provider.ts` (Gemini por defecto, Groq, OpenRouter, NVIDIA, Ollama y Claude de pago), `tasks.ts` (mapeo de Excel e ideas por franja de edad) y `catalog.ts` (ideas sin IA) |
| `src/ui/` | Pantallas, `Button.tsx`, `kit.tsx` (sello, hoja, avisos con «Deshacer», `VisibilityNote`), `Gift.tsx` (`GiftCard`), `MemberCard.tsx`, `BudgetBar.tsx` y `statusText.ts` (frases de estado) |
| `server/` | PocketBase (`pb_migrations` con las reglas y `pb_hooks`), `unfurl` (anti-SSRF), Docker y Caddy. Tests: `server/test/rules.test.mjs` (PocketBase real, en CI) |
| `android/` | Capacitor (se genera con `scripts/build-apk.sh`) |
| `test/`, `e2e/` | Vitest y Playwright |
| `DESIGN.md`, `PRODUCT.md`, `.impeccable/` | Sistema visual, verdad de producto y contrato de diseño |

## Modelos y su función

**En el producto** (todos opcionales):

| Modelo | Proveedor | Función |
|---|---|---|
| `gemma3` (u otro) | Ollama en casa (recomendado en producción) | Mapear columnas de un Excel, sugerir ideas |
| `gemini-3.8-flash` | Google; en la UE solo de pago | Lo mismo; la capa gratuita, solo pruebas |
| `qwen/qwen3.8-27b` | Groq, gratis | Respaldo del anterior |
| `nvidia/nemotron-3.5-super-vl:free` | OpenRouter, gratis | Respaldo |
| `nvidia/nemotron-3.5-super-vl-120b-a12b` | NVIDIA NIM, gratis (solo Android: sin CORS) | Respaldo |
| `claude-haiku-5-5` | Anthropic, de pago | Opción de calidad elegida por el usuario |

**En el desarrollo:**

| Modelo | Función |
|---|---|
| Claude Opus 5.5 | Diseño, implementación, pruebas y documentación |
| Claude Fable 5.2 (`claude-fable-5-2`) | Solo revisiones clave: diseño final y seguridad (gasta mucha cuota) |
| `opencode/deepseek-v4.1-flash-free` (OpenCode, en silencio y con `--agent plan`) | Tareas mecánicas: datos de catálogo y tests repetitivos. Devuelve un diff que revisa Opus |
