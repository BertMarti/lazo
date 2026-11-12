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
| 4 | Veredicto «apto» sobre las capturas nuevas | revisor-diseno | Fable 5.2 | hecha |
| 5 | DESIGN.md, SKILLS.md, CHANGELOG y README | implementador | Opus 5.5 | hecha |
| 6 | Merge a `main` y release v0.4.0 con el APK | implementador | Opus 5.5 | hecha |
| 7 | Demo v0.4 publicada en GitHub Pages (https://bertmarti.github.io/lazo/), con el bundle nuevo comprobado. Alternativa en Cloudflare Pages lista en `scripts/pages-deploy.sh` (`lazo-demo.pages.dev`): el control de seguridad deniega crear esa superficie pública, así que la lanza el usuario si la quiere | implementador / usuario | Opus 5.5 | hecha (Cloudflare: bloqueada: usuario) |

## Ahora: v0.5 «Lista para Navidad»

Las tareas A a D van en paralelo, cada una en su worktree y su rama. No comparten archivos, salvo `docs/TAREAS.md`, que solo actualiza Opus al integrar.

| # | Tarea | Responsable | Modelo | Rama | Estado |
|---|---|---|---|---|---|
| A | **Puesta en marcha real.** Guía `docs/HOMELAB.md` y `server/docker-compose.yml` de PocketBase en el homelab (al estilo de SHIELD-DNS y HEIMDALL): copias de seguridad, HTTPS con Caddy y acceso desde fuera para la familia. E2E contra PocketBase real del flujo completo: crear grupo → invitar → reclamar plaza → reservar → hucha → ajuste de cuentas | implementador | Opus 5.5 | `v05-homelab` | hecha |
| B | **Importación robusta.** Enlaces de Amazon.es, El Corte Inglés, PcComponentes, Zara y Decathlon (metadatos públicos, fallback manual, tests con fixtures HTML) y Excel o CSV con mapeo de columnas asistido sin IA | implementador | Opus 5.5 | `v05-importar` | hecha |
| C | **Avisos del grupo.** «Papá ha añadido 3 regalos», «faltan 10 días»… respetando la regla de la sorpresa, con un test que garantiza que ningún aviso filtra datos de la propia lista | implementador | Opus 5.5 | `v05-avisos` | hecha |
| D | **Amigo invisible.** Animación de revelado y opción de reenviar el resultado en privado | implementador | Opus 5.5 | `v05-sorteo` | hecha |
| E | Integrar A a D en `main` y pasar todas las pruebas | Opus | Opus 5.5 | — | hecha |
| F | Revisión de seguridad y de UX de todo lo nuevo, accesibilidad (axe) y capturas | revisor-seguridad + revisor-diseno | Fable 5.2 | — | hecha (seguridad: V-16 a V-19 corregidos; UX: apto, con 8 arreglos aplicados) |
| G | Release v0.5.0: CHANGELOG, APK, demo, README y CI mínimo | implementador | Opus 5.5 | — | hecha |

## Después

| # | Tarea | Responsable | Modelo |
|---|---|---|---|
| 14 | Hallazgos bajos V-20 a V-25 de `docs/security/AUDIT.md` (pruebas de avisos contra el servidor, `og:url`, permisos y cifrado de copias, túnel, `.xlsx` comprimido, número de sorteo en el mensaje) | revisor-seguridad → implementador | Fable 5.2 → Opus 5.5 |
| 15 | Validar en el homelab real: `caddy validate`, `docker compose up` y las comprobaciones de `docs/HOMELAB.md` §7 | usuario | — |
| 8 | Avatares de la familia en la entrada por enlace (`inviteInfo` con nombres y colores, revisado por seguridad) | revisor-seguridad → implementador | Fable 5.2 → Opus 5.5 |
| 9 | Selector propio de claro u oscuro en Ajustes | implementador | Opus 5.5 |
| 10 | Regenerar `e2e/capturas.spec.ts` con las pantallas v0.4 | OpenCode | `deepseek-v4.1-flash-free` |
| 11 | Hoja de detalle del regalo con foto 4:3 | implementador | Opus 5.5 |
| 13 | Ilustraciones propias para los estados vacíos | revisor-diseno → implementador | Fable 5.2 → Opus 5.5 |

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
