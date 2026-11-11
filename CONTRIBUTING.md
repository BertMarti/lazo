# Cómo colaborar en Lazo

¡Gracias por echar una mano!

1. **Abre antes una issue** si el cambio es grande, para hablarlo.
2. **Prepara el entorno:** Node 24, `npm ci`, `npm run dev`. La demo sin servidor se lanza con `VITE_DEMO=1 npm run dev`.
3. **Comprueba** que pasa `npm run check` (lint, tipos y tests) y, si tocas pantallas, `npx playwright test`.
4. **Respeta las reglas** de [AGENTS.md](AGENTS.md): la sorpresa, el dinero en céntimos, un único sistema de botones y nada de HTML inyectado.
5. **Anota tu cambio en el CHANGELOG**, en «Sin publicar», escrito para quien usa la app y no para quien programa.
6. **Pull request** contra `main`, con capturas si cambia algo visible.

Textos de la interfaz: en español, cercanos y concretos. Cada botón dice lo que hace («Reservar», no «Aceptar») y los errores explican qué ha pasado y cómo arreglarlo.

## Modelos y su función

Puedes usar IA para colaborar, siempre que revises lo que proponga. En este repo:

- **Claude Opus 5.5:** implementación y documentación.
- **Claude Fable 5.1:** revisiones de diseño y de seguridad.
- **OpenCode con modelos gratuitos:** solo para lo mecánico.

Si una IA escribe tu PR, dilo en la descripción.
