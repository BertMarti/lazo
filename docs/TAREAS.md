# TAREAS.md · Cola de trabajo de Lazo

Cola priorizada. Cada tarea indica quién la hace y con qué modelo. Las que no comparten archivos se lanzan en paralelo como subagentes, y cada una encadena con la siguiente sin esperar al usuario, salvo las marcadas como «bloqueada: usuario».

**Quién hace qué:**
- **Fable 5.2** (`claude-fable-5-2`): diseño, seguridad y revisiones (`.claude/agents/revisor-diseno.md` y `revisor-seguridad.md`).
- **Opus 5.5:** implementación (`.claude/agents/implementador.md`).
- **OpenCode**, en silencio (`opencode-cli run --archived --agent plan`, sin `--auto`): lo mecánico. Devuelve un diff que revisa Opus.

**Estados:** `hecha`, `en curso`, `pendiente` y `bloqueada: usuario`.

## Ahora (v0.4.0 «El catálogo de juguetes»)

| # | Tarea | Responsable | Modelo | Estado |
|---|---|---|---|---|
| 1 | Tres direcciones de arte y elección | revisor-diseno | Fable 5.2 | hecha |
| 2 | Implementar «El catálogo de juguetes» en todas las pantallas | implementador | Opus 5.5 | hecha |
| 3 | Revisión final y sus 10 arreglos (`docs/design/v0.4/FABLE-REVISION.md`) | revisor-diseno → implementador | Fable 5.2 → Opus 5.5 | hecha |
| 4 | Veredicto «apto» sobre las capturas nuevas | revisor-diseno | Fable 5.2 | en curso |
| 5 | DESIGN.md, SKILLS.md, CHANGELOG y README | implementador | Opus 5.5 | hecha |
| 6 | Merge a `main` y release v0.4.0 con el APK | implementador | Opus 5.5 | pendiente |
| 7 | Demo en Cloudflare Pages (`scripts/pages-deploy.sh` → `lazo-demo.pages.dev`), porque GitHub Pages y Actions están bloqueados por facturación | implementador | Opus 5.5 | pendiente |

## Siguiente (v0.5)

| # | Tarea | Responsable | Modelo | Paralelo con |
|---|---|---|---|---|
| 8 | Avatares de la familia en la entrada por enlace: `inviteInfo` devuelve nombres y colores, y se revisa que no filtre nada a quien tiene un enlace usado | revisor-seguridad → implementador | Fable 5.2 → Opus 5.5 | 9, 10 |
| 9 | Selector propio de claro u oscuro en Ajustes (hoy sigue al sistema) | implementador | Opus 5.5 | 8, 10 |
| 10 | Regenerar `e2e/capturas.spec.ts` con las pantallas v0.4 (selectores nuevos) | OpenCode | `deepseek-v4.1-flash-free` | 8, 9 |
| 11 | Hoja de detalle del regalo con foto 4:3 y estados de la tabla de DESIGN.md | implementador | Opus 5.5 | 12 |
| 12 | Auditoría de seguridad de la v0.4 (lo que muestra el grupo en «Lo más deseado») | revisor-seguridad | Fable 5.2 | 11 |
| 13 | Ilustraciones propias para los estados vacíos (el lazo deshecho) | revisor-diseno → implementador | Fable 5.2 → Opus 5.5 | — |

## Cómo se encadena

1. Al cerrar una tarea, se marca como `hecha` aquí y se lanza la siguiente de la cola.
2. Las tareas de una misma fila de «Paralelo con» van en subagentes a la vez, cada una con sus archivos.
3. Antes de cada versión: `revisor-diseno` si cambió la interfaz y `revisor-seguridad` si cambió el servidor o los datos. Sin «apto» no se publica.
4. Lo que necesita al usuario (cuentas, claves, facturación, aprobar un merge que el control de seguridad bloquea) se marca como «bloqueada: usuario» y la cola sigue con lo demás.

## Modelos y su función

| Modelo | Función en esta cola |
|---|---|
| Claude Fable 5.2 (`claude-fable-5-2`) | Dirección de arte, revisiones de diseño y auditorías de seguridad |
| Claude Opus 5.5 | Implementación, pruebas, documentación y publicación |
| OpenCode (`deepseek-v4.1-flash-free`, `--agent plan`) | Tareas mecánicas acotadas, con diff revisado |
