# SKILLS.md · Lazo

Qué skills de agente se han usado en Lazo y para qué, por si alguien quiere repetir el proceso.

| Skill | Cuándo | Resultado en el repo |
|---|---|---|
| `superpowers:brainstorming` (modo autónomo) | Antes de escribir código | `docs/superpowers/specs/2026-11-11-lazo-design.md` |
| `superpowers:writing-plans` | Tras la spec | `docs/superpowers/plans/2026-11-11-lazo-mvp.md` |
| `impeccable` (init + new-work, guiado por código) | Identidad visual | `PRODUCT.md`, `.impeccable/surfaces/`, `DESIGN.md` |
| `emil-design-eng` | Movimiento y detalle | Curvas `--ease-*`, pulsación a 0,97, animaciones del precinto y del sobre |
| `ponytail` | Siempre | Lo mínimo que funciona; atajos marcados con `ponytail:` |
| `superpowers:test-driven-development` | Núcleo | `test/core/*` |
| Revisión de seguridad (Fable) | Antes de cada versión con servidor | `docs/security/AUDIT.md` |
| Referencias reales (Playwright headless) + Fable | Antes de cerrar la interfaz | `docs/design/referencias/*.png`, `docs/design/REFERENCIAS.md` |

**Skills de terceros que pidió el usuario:** leí su `SKILL.md` antes de usarlas.

| Skill | Estado | Por qué |
|---|---|---|
| `pbakaus/impeccable` | Instalada y en uso | Detector de patrones de IA (`impeccable detect`), proceso de dirección y crítica. Se pasa antes de cada versión |
| `emilkowalski/skills` (`emil-design-eng`) | Instalada y en uso | Curvas, duraciones y microinteracciones |
| `Leonxlnx/taste-skill` | Evaluada, **no instalada** | Está pensada para webs de empresa (landing pages con fotos y escenas) y al instalarse añade un hook `Stop`. Su criterio útil (bordes iguales, una sola familia de botones, nada de capturas con pie) ya está en DESIGN.md. Instalarla y añadir hooks es decisión del usuario |
| «Hallmark» / «Pckable» | No existen como detectores de diseño | `pckable` es un plugin de Godot; no se encontró ningún «Hallmark» fiable |

## Modelos y su función

| Quién | Skills que ejecuta |
|---|---|
| Claude Opus 5.5 | Todas las de proceso y construcción |
| Claude Fable 5.1 | La revisión final de diseño (`impeccable` critique) y la de seguridad |
| OpenCode (`deepseek-v4.1-flash-free`) | Ninguna skill: solo encargos mecánicos acotados (`--agent plan`, sin `--auto`) |
