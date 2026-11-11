# CLAUDE.md

Lee y sigue [AGENTS.md](AGENTS.md): reglas, comandos y mapa del código. Lo esencial:

- **La sorpresa es sagrada:** nadie ve el estado de su propia lista, ni en la interfaz ni por la API.
- npm se ejecuta en WSL (`bash scripts/wsl.sh …`).
- Un único sistema de botones (`src/ui/Button.tsx`) y el diseño fijado en `DESIGN.md`.
- CHANGELOG en cada cambio visible para el usuario.

## Modelos y su función

- **Claude Opus 5.5:** el trabajo diario.
- **Claude Fable 5.1:** solo las revisiones de diseño y de seguridad.
- **OpenCode** (`deepseek-v4.1-flash-free`, `--agent plan`): lo mecánico, siempre revisado.
- **En el producto:** IA gratuita por defecto (Gemini y compañía) y Claude Haiku 5.5 como opción de pago. Tabla completa en [AGENTS.md](AGENTS.md#modelos-y-su-función).
