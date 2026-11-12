---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

Scope: toda la app (Operate). Visitante: familia española, móvil primero, a menudo mayor y con prisa. Tarea: ver a la familia y sus deseos, reservar o comprar sin duplicar y llevar la propia lista sin ver su estado.

## Direction contract

THESIS: La app es el catálogo de Navidad de una juguetería abierto en la mesa de envolver: personas grandes, fotos grandes, etiquetas de precio redondas y un lazo que ata lo que ya está cogido. Rechaza el panel SaaS (raíl lateral, cabecera oscura, filas grises) y la Navidad de manual en rojo y verde.

OWN-WORLD: Papel crema #f6efe2 con tarjetas #fffaf0. Terracota #b4532e como acción y etiqueta de precio, abeto #23493b como «es tuyo» y progreso, y oro #c9a24a solo como cinta y lazo. Young Serif para títulos y cifras, Nunito para la interfaz. Botones en píldora. Sombras cálidas tintadas de marrón. En oscuro, la misma mesa con la luz baja (#1b1612).

STORY: Abres el grupo y ves a tu familia en tarjetas con su cara, sus regalos y su presupuesto; debajo, lo más deseado en fotos. Entras en la lista de Mamá: un tablero de fotos con su precio. Lo cogido lleva la cinta (cruzada si ya está comprado) y una etiqueta que lo dice con palabras. En tu lista no hay cinta ni etiqueta: es sorpresa.

FIRST VIEWPORT: Cabecera sobre papel: lazo y «Lazo» a la izquierda, pestañas en píldora en escritorio y barra inferior de 4 secciones en móvil. Título del grupo en Young Serif grande, con «24 de diciembre · faltan 43 días» debajo. Rejilla de personas (2 columnas en móvil y auto-fill de 190 px en escritorio), con tu tarjeta primero en abeto. Luego «Lo más deseado», 4 fotos en tablero.

FORM: El catálogo de juguetes (posición 3 de 7 en mi lista: 1 papel de envolver, 2 carta a los Reyes, 3 catálogo de juguetería, 4 álbum familiar, 5 mesa de Nochebuena, 6 décimos de Lotería, 7 calendario de adviento). Elegida por Fable entre A, B y C (docs/design/v0.4/FABLE-DIRECCION.md). seed: d671fb943b27e810. Gesto propio: el lazo que se anuda al reservar y el confeti discreto en «Ya comprado», ambos anulados con reduced-motion. Raise del catálogo de personajes (descartado): cada persona tiene su ficha fija, con cara, nombre y una línea.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
