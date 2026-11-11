# Novedades

Todas las novedades de Lazo. Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones [semver](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- **Presupuesto por persona.** El grupo fija cuánto se gasta en cada uno y una barra muestra lo comprometido (reservas, compras y aportaciones) y lo que queda, o cuánto os pasáis. Lo ve todo el grupo **menos el destinatario**.
- **Reservar en un toque**, directamente desde la lista y con «Deshacer» durante 6 segundos.
- **Añadir en dos toques:** «Añadir» y después «Pegar enlace». Lazo lee la tienda y lo guarda. También vale pegar en cualquier punto de la hoja.
- **Cada regalo dice quién lo tiene** sin abrirlo: «Lo reserva Samira», «Lo compró Papá», «A medias · 71 % · ponen Juan Carlos y Papá».
- **«Mamá no ve esto»:** la regla de la sorpresa se explica sola donde hace falta.
- **Servidor para casa** (PocketBase, Docker y Caddy), con guía en `docs/HOMELAB.md`. La regla se impone en el servidor: el destinatario no recibe ni reservas, ni aportaciones, ni presupuesto por ninguna vía de la API.
- Vista previa segura de enlaces (servicio `unfurl`, con protección anti-SSRF).
- Escaneo de secretos (gitleaks) en el pre-commit y en CI.

### Cambiado
- **Nuevo diseño «La bandeja»:**
  - la familia aparece en tarjetas con su presupuesto;
  - las listas se dividen en «Disponibles» y «Ya cogidos»;
  - el texto es más grande y con mejor contraste;
  - los botones tienen tres alturas fijas.
- La demo es ahora la familia de Alberto, Juan Carlos, Samira, Mamá y Papá.
- «Mis compras» se agrupa por persona, tiene «Ya lo compré» en cada reserva y separa lo que falta por comprar, lo comprado y lo que va a medias.
- En el amigo invisible, el sobre se abre con un toque y lleva a la lista de la persona que te ha tocado.

## [0.1.0] - 2026-11-11 · Primera caja

Primera versión para probar en la demo pública, con datos ficticios y sin servidor.

### Añadido
- **Grupos por ocasión** (Navidad, cumpleaños, boda, bebé), con su cuenta atrás.
- **Una lista por persona**, con talla, color, cantidad, notas y tres niveles de ganas.
- **Sorpresa garantizada:** ves libre, reservado, comprado o a medias en las listas ajenas, y nada en la tuya.
- **Reservar, marcar comprado y soltar.** Las reservas respetan la cantidad de cada regalo.
- **Regalos a medias:** cada uno apunta lo que pone, se ve cuánto falta, se propone el reparto a partes iguales (cuadra al céntimo) y quién debe qué a quién.
- **Amigo invisible** con exclusiones y presupuesto; cada persona abre solo su sobre.
- **Listas de niños** llevadas por sus padres.
- **Rellenar desde un enlace** (Amazon o cualquier tienda) con los datos públicos de la página. En la demo, con datos de ejemplo.
- **Importar desde Excel o CSV**, adivinando las columnas, con vista previa y hasta 300 filas.
- **Mis compras:** todo lo reservado y lo comprado, con el total.
- **Invitar** por WhatsApp, copiando el enlace o con el panel de compartir del móvil.
- **Demo con «Ver como…»** para comprobar la sorpresa desde cada persona.
- Funciona sin conexión (PWA) y tiene modo oscuro.

## Modelos y su función

| Versión | Desarrollo | IA en el producto |
|---|---|---|
| Sin publicar | Fable 5.1: dirección de arte («La bandeja») y auditoría de la regla y de seguridad. Opus 5.5: implementación. OpenCode (`deepseek-v4.1-flash-free`): catálogo de ideas | Ninguna todavía |
| 0.1.0 | Claude Opus 5.5 | Ninguna todavía: el mapeo de Excel va por sinónimos |

[Sin publicar]: https://github.com/BertMarti/lazo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BertMarti/lazo/releases/tag/v0.1.0
