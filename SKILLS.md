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

`frontend-design`, `taste-skill` y `ui-ux-pro-max` no estaban instaladas en esta máquina; `impeccable` cubre su función.

## Modelos y su función

| Quién | Skills que ejecuta |
|---|---|
| Claude Opus 5.5 | Todas las de proceso y construcción |
| Claude Fable 5.1 | La revisión final de diseño (`impeccable` critique) y la de seguridad |
| OpenCode (`deepseek-v4.1-flash-free`) | Ninguna skill: solo encargos mecánicos acotados (`--agent plan`, sin `--auto`) |
