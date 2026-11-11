# AGENTS.md · Lazo

Guía para agentes (Claude Code, OpenCode, Codex…) y personas que trabajen en el código.

## Qué es

Lazo es una app de listas de regalos en familia: PWA + Android (Capacitor) sobre React 19, Vite 8 y TypeScript, con un backend PocketBase autoalojado. El diseño completo está en `docs/superpowers/specs/2026-11-11-lazo-design.md` y el plan en `docs/superpowers/plans/2026-11-11-lazo-mvp.md`.

## Reglas que no se rompen

1. **La sorpresa.** Ningún código, pantalla, endpoint ni registro puede revelar el estado de la propia lista: `canSeeStatus(viewer, list)` en `src/core/visibility.ts` y las reglas de API de PocketBase dicen lo mismo. `items` no lleva nunca campos de estado. Cualquier cambio en `claims`, `contributions` o `assignments` necesita una prueba que demuestre que el dueño no ve nada.
2. **Dinero en céntimos enteros** (`Cents`). Para repartir, `byWeights` (mayor resto); nunca `Math.round` por persona.
3. **Un único sistema de botones** (`src/ui/Button.tsx`): `Button`, `ButtonLink`, `FileButton`, `IconButton` y `ButtonGroup`. Prohibido escribir `<button className="btn…">` a mano.
4. **Sin HTML inyectado:** nada de `dangerouslySetInnerHTML` ni `innerHTML`.
5. **Menores:** solo el nombre de pila y, opcional, el año de nacimiento. A la IA, solo una franja de edad.
6. **IA gratuita por defecto.** Claude solo como opción de pago elegida por el usuario. Las claves, solo en el dispositivo.
7. **Enlaces:** solo metadatos públicos (Open Graph y JSON-LD). Nada de selectores propios de cada tienda. La descarga siempre pasa por el servicio `unfurl` con la protección anti-SSRF.

## Cómo se trabaja

- **Este PC (Windows con Smart App Control):** npm, Vite, Vitest y Playwright se ejecutan en WSL. Desde Git Bash: `bash scripts/wsl.sh npm run check`.
- `npm run check` pasa lint, tipos y tests unitarios. `npx playwright test` pasa los E2E. Para las capturas de diseño: `CAPTURAS=docs/design/vX npx playwright test e2e/capturas.spec.ts`.
- **Demo:** `npm run build:demo` usa `DemoApi`, con datos ficticios y sin backend.
- **Versiones:** semver. Cada cambio visible para el usuario va al CHANGELOG (Keep a Changelog, sección «Sin publicar»). Al publicar: subir `package.json`, tag `vX.Y.Z` y GitHub Release con las notas del CHANGELOG.
- **Commits** pequeños, en español, con la línea `Co-Authored-By` del agente.
- **CI:** el repo es público y GitHub Actions no cuesta nada, pero los workflows llevan `concurrency` con cancel-in-progress y caché.

## Mapa del código

| Ruta | Qué hay |
|---|---|
| `src/core/` | Lógica pura y testeada: dinero, visibilidad, estado, reparto, sorteo, columnas, metadatos y Amazon |
| `src/api/` | `Api` (interfaz), `DemoApi` (memoria) y, desde la 0.2, `PocketBaseApi` |
| `src/ui/` | Pantallas, `Button.tsx`, `kit.tsx` (sello, hoja, avisos), `Gift.tsx` (etiqueta de regalo) |
| `server/` | Desde la 0.2: PocketBase (migraciones y hooks), `unfurl` y compose |
| `test/`, `e2e/` | Vitest y Playwright |
| `DESIGN.md`, `PRODUCT.md`, `.impeccable/` | Sistema visual, verdad de producto y contrato de diseño |

## Modelos y su función

**En el producto** (todos opcionales):

| Modelo | Proveedor | Función |
|---|---|---|
| `gemini-3.8-flash` | Google, gratis con clave (por defecto) | Mapear columnas de un Excel, normalizar productos, sugerir ideas |
| `qwen/qwen3.8-27b` | Groq, gratis | Respaldo del anterior |
| `nvidia/nemotron-3.5-super-vl:free` | OpenRouter, gratis | Respaldo |
| `nvidia/nemotron-3.5-super-vl-120b-a12b` | NVIDIA NIM, gratis (solo Android: sin CORS) | Respaldo |
| `gemma3` | Ollama local | Privacidad total |
| `claude-haiku-5-5` | Anthropic, de pago | Opción de calidad elegida por el usuario |

**En el desarrollo:**

| Modelo | Función |
|---|---|
| Claude Opus 5.5 | Diseño, implementación, pruebas y documentación |
| Claude Fable 5.1 | Solo revisiones clave: diseño final y seguridad (gasta mucha cuota) |
| `opencode/deepseek-v4.1-flash-free` (OpenCode, en silencio y con `--agent plan`) | Tareas mecánicas: datos de catálogo y tests repetitivos. Devuelve un diff que revisa Opus |
