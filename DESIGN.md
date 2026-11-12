# DESIGN.md · Lazo

Este es el sistema visual de Lazo v0.4, **«El catálogo de juguetes»**, tal como está construido en `src/styles.css`. La estructura sigue la de los DESIGN.md de [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md); de allí se toma solo el orden de las secciones, no ninguna marca.

- **Dirección:** la eligió Fable entre tres exploraciones; el razonamiento está en [docs/design/v0.4/FABLE-DIRECCION.md](docs/design/v0.4/FABLE-DIRECCION.md).
- **Referencias:** [docs/design/referencias/v0.4/README.md](docs/design/referencias/v0.4/README.md).
- **Capturas:** las de antes, las de después y las del modo oscuro están en `docs/design/v0.4/`.

## Visión general

Lazo es el catálogo de Navidad de una juguetería, abierto sobre la mesa de envolver:

- Las **personas** aparecen en grande, con su cara y su presupuesto.
- Los **regalos** aparecen en grande, en fotos con una etiqueta de precio redonda.
- Lo que ya está cogido **lleva una cinta y un lazo**.

Se rechazan dos cosas:

- El panel de administración: raíl lateral, cabecera oscura y filas grises.
- La Navidad de manual: rojo y verde, copos y Papá Noel.

Principios:

1. **Las personas y los regalos mandan.** Avatares de 80 a 96 px y fotos 1:1 a todo lo ancho de la tarjeta.
2. **Texto antes que símbolo.** Cada estado se dice con palabras («Lo reserva Samira»). La cinta y la etiqueta lo refuerzan, pero nunca lo sustituyen.
3. **La sorpresa es sagrada.** En tu propia lista no hay cinta, ni etiqueta, ni progreso. Lo que una persona no ve, la interfaz lo dice con su nombre: «Mamá no ve esto».
4. **Un toque para lo frecuente.** Reservar es un botón y se puede deshacer.

## Colores

### Marca y acento

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--terracota` | `#b4532e` | `#e39468` | Botón primario y etiqueta de precio (con `--sobre-terracota`: 4,98 y 7,5:1) |
| `--terracota-pulsado` | `#963f20` | `#eda67f` | Hover y pulsado |
| `--terracota-tinta` | `#9a4222` | `#e39468` | Terracota como texto o icono (5,8:1 sobre papel) |
| `--abeto` | `#23493b` | `#9ccdb6` | «Es tuyo», progreso y foco |
| `--abeto-fondo` | `#23493b` | `#2c5a49` | Tarjeta «Tu lista» |
| `--oro` | `#c9a24a` | `#dcb866` | Solo cinta, lazo y filetes. **Nunca** texto en claro (2,1:1) |
| `--oro-tinta` | `#7a5a12` | `#dcb866` | Dorado como texto |

### Superficies

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--papel` | `#f6efe2` | `#1b1612` | Fondo de página |
| `--tarjeta` | `#fffaf0` | `#27201a` | Tarjetas, hojas y barra inferior |
| `--hundido` | `#efe5d2` | `#332a21` | Pistas, píldora de pestaña activa y deshabilitado |

### Texto y líneas

| Token | Claro | Oscuro | Contraste |
|---|---|---|---|
| `--tinta` | `#2a1d14` | `#f4ecdd` | 14,3:1 sobre papel |
| `--tinta-2` | `#5c4a3c` | `#cbbda8` | 7,4:1 sobre papel |
| `--linea` | `#e0d3bb` | `#40362b` | Separadores decorativos |
| `--linea-fuerte` | `#857059` | `#8f7d68` | Borde de campos (≥ 3:1) |

### Semánticos

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--oro-suave` / `--sobre-oro-suave` | `#f1e1b5` / `#4a3608` | `#4a3a14` / `#f3e2b4` | «Mamá no ve esto», «Sorpresa» y avisos |
| `--peligro` / `--sobre-peligro` | `#a3261f` / `#fff` | `#f0907f` / `#20140c` | Borrar y excedido |

### Colores de persona

Cada persona tiene un color fijo, el mismo en claro y en oscuro, siempre con la inicial en blanco (≥ 5,5:1). Llevan un aro de 2 px en `--aro` para separarse del fondo.

| Clave | Hex | Clave | Hex |
|---|---|---|---|
| `cielo` | `#3a6789` | `violeta` | `#6a4c99` |
| `menta` | `#4a7336` | `limon` | `#1f6f6b` |
| `fresa` | `#a2445a` | `almendra` | `#55606e` |
| `canela` | `#96591f` | | |

## Tipografía

- **Familias:**
  - Títulos y cifras: **Young Serif** 400 (`@fontsource/young-serif`), nunca por debajo de 20 px.
  - Interfaz: **Nunito Variable** (`@fontsource-variable/nunito`), con 500 para el texto, 700 para las etiquetas y 800 para botones y precios.
  - Las dos van empaquetadas: la CSP solo permite fuentes propias.
- **Jerarquía:**

| Token | Móvil | Escritorio | Uso |
|---|---|---|---|
| `--t-display` | 40 px | 64 px | Título de pantalla y nombre en la lista |
| `--t-1` | 32 px | 40 px | Título de la entrada por enlace |
| `--t-2` | 24 px | 28 px | Secciones y hojas |
| `--t-3` | 20 px | 20 px | Nombre en la tarjeta de persona |
| `--t-cifra` | 48 px | 56 px | «Te falta poner» y el código de entrada |
| `--t-big` | 18 px | 18 px | Entradilla y estados vacíos |
| `--t-md` | 16 px | 16 px | Base |
| `--t-meta` | 15 px | 15 px | Línea secundaria |
| `--t-mark` | 14 px | 14 px | Etiquetas de estado y barra inferior (solo en negrita) |

- **Principios:**
  - Nada por debajo de 14 px.
  - Sin mayúsculas sostenidas.
  - Interletrado mínimo de −0,02em en los títulos.
  - Cifras tabulares en todo lo que es dinero.

## Composición

- **Espaciado:** pasos de 4 px (4, 8, 12, 16, 20, 24, 32, 48, 64).
- **Márgenes y contenedor:** margen lateral de 20 px en móvil y 32 desde 900 px; contenedor de 1140 px.
- **Personas:** 2 columnas en móvil (1 por debajo de 340 px) y `auto-fill minmax(190px, 1fr)` desde 720 px.
- **Tablero de regalos:** rejilla uniforme, no masonry. 2 columnas en móvil, 3 desde 768 px y 4 desde 1100 px.
- **Cabecera de página:** «‹ Volver» encima del título, el avatar grande cuando es la lista de alguien y la línea «24 de diciembre · faltan **43** días».

## Profundidad

- `--sombra-1` (en reposo) y `--sombra-2` (hover, hojas y precio): sombras cálidas tintadas de marrón, nunca grises.
- En oscuro no hay sombra en reposo: las tarjetas se separan con 1 px de `--linea` (`--borde-tarjeta`).
- Al pasar el ratón, la tarjeta sube 2 px y toma `--sombra-2` en 150 ms.

## Formas

- **Radios:** `--r-s` 10 px para las etiquetas, `--r-m` 14 px para campos y miniaturas, `--r-l` 20 px para tarjetas y hojas, y `--r-pill` para botones, precio y pestañas.
- **Fotos:** siempre 1:1 en el tablero y 4:3 en la hoja de detalle, con `object-fit: cover`.

## Componentes

### Botones (único sistema: `src/ui/Button.tsx`)

Todos los botones son píldoras de 48 px de alto en móvil y 44 px en escritorio, con Nunito 800 de 16 px, en una sola línea, sin subrayado y con `scale(.98)` al pulsar.

| Variante | Aspecto | Para qué |
|---|---|---|
| `primary` | Terracota con texto blanco | Una vez por tarjeta o pantalla: Reservar, Ya comprado, Entrar |
| `secondary` | Borde de 2 px en tinta | Poner mi parte, Invitar, Crear otro grupo |
| `ghost` | Sin borde | Cancelar, Soltar |
| `danger` | Relleno de peligro | Solo dentro de la confirmación |
| `link` | Texto terracota en 800 | Acciones terciarias («Apuntar una sorpresa») |

`IconButton` mide siempre 44 × 44 y lleva un nombre accesible obligatorio.

### Tarjeta de persona (`MemberCard`)

- Avatar de 80 px, nombre en Young Serif, «3 regalos · 1 libre» y barra de presupuesto con la cifra «65 € de 150 €».
- **Tu lista:** fondo abeto, «Lo que te regalan es sorpresa» y botón «Añadir»; nunca lleva cifras.
- **Plaza libre:** borde discontinuo y botón «Invitar».
- Toda la tarjeta es un enlace.

### Tarjeta de regalo (`GiftCard`)

- Foto 1:1 con la **etiqueta de precio** en terracota (círculo de 56 px girado −6°, arriba a la derecha).
- Debajo, el título (dos líneas como máximo), la tienda o «Para Mamá», la frase de estado y las acciones a todo el ancho.
- Las señales de estado son redundantes:

| Estado | Etiqueta sobre la foto | Cinta | Frase |
|---|---|---|---|
| Libre | — | — | «Libre» |
| Reservado por otra persona | «Reservado» | Una banda dorada en el tercio inferior, con lazo | «Lo reserva Samira» |
| Para la hucha | «Para la hucha» | La misma banda | «Para la hucha · lo apuntó Papá» |
| Lo llevas tú | «Lo llevas tú», en abeto | Banda en abeto y borde de 2 px en abeto | «Lo reservas tú» |
| A medias | «A medias · 60 %» | — | «A medias · Juan Carlos» |
| Comprado | «Comprado», en tinta | Dos bandas en cruz (el paquete atado) | «Lo compró Samira» |
| Sorpresa | «Sorpresa», en oro suave, arriba a la izquierda | La del estado que tenga | — |

- El título nunca se tacha y la foto nunca se atenúa.

### El lazo (`src/ui/Bow.tsx`)

- Un solo dibujo: dos bucles rellenos, el nudo y dos cabos, en `currentColor`.
- Se usa en el logotipo, sobre la cinta, en los estados vacíos (oro, 88 px), en la carga (respira) y en el sorteo.

### Otros

- **Etiqueta** (`.tag`): píldora opaca de 28 px con icono y palabra.
- **Visibilidad** (`.vis`): «Mamá no ve esto», sobre oro suave.
- **Hoja:** `<dialog>` nativo; sube desde abajo en móvil y se centra en 560 px en escritorio.
- **Tique** (`.rows`): filas de la hucha y de «Mis compras», separadas por una línea de puntos, con miniatura de 72 px.
- **Sorteo:** paquete en abeto atado con cinta dorada; al abrirlo, el nombre aparece en `--t-display`.
- **Toast:** tinta sobre papel, encima de la barra inferior, con «Deshacer».

### Navegación

- **Móvil:** barra inferior con Grupo, Hucha, Mis compras y Sorteo. Iconos de 24 px y etiqueta siempre visible; la activa va en terracota con una píldora detrás del icono.
- **Escritorio:** cabecera sobre el papel, con la marca a la izquierda, las pestañas en píldora en el centro (la activa en tinta) y los ajustes a la derecha. Sin raíl lateral.

### Microinteracciones

- **El lazo que se anuda** al reservar (unos 620 ms): la banda entra con `scaleX`, los bucles se dibujan con `stroke-dashoffset` y el nudo se asienta.
- **Confeti discreto** en «Ya comprado»: 18 papelitos en abanico durante 900 ms, solo cuando ocurre en esa tarjeta, sin bloquear toques.
- Con `prefers-reduced-motion`: fundido de 120 ms y sin confeti.

## Lo que sí y lo que no

**Sí:**
- Frases con sujeto.
- Fotos grandes.
- Un único primario por tarjeta.
- Oro solo como adorno.
- Tokens en lugar de hex sueltos.

**No:**
- Raíl lateral, bandas oscuras arriba, grises fríos y azul marino.
- Rojo y verde de manual, emojis como iconos, degradados y vidrio.
- Estado solo por color, por opacidad o por tachado.
- Texto sobre una foto sin pastilla opaca.
- Young Serif en párrafos.
- Botones a dos líneas.
- Fuentes desde un CDN.

## Comportamiento en distintos tamaños

- **Cortes:** 340 px (1 columna), 720 px (rejillas fluidas), 768 px (3 regalos), 900 px (pestañas arriba, botones de 44) y 1100 px (4 regalos).
- **Objetivos táctiles:** al menos 44 px. Lo comprueba `e2e/tactil.spec.ts`, que además verifica que nada se sale de la pantalla a 320 px.
- **Imágenes:** `loading="lazy"`, `referrerPolicy="no-referrer"` y 1:1 con `cover`. Sin foto, se muestra el lazo dorado sobre `--hundido`.

## Cómo iterar

1. Cambia los tokens en `:root` y su bloque oscuro; nunca uses hex sueltos en los componentes.
2. Para un botón nuevo, añade una variante en `Button.tsx`. Está prohibido escribir `className="btn…"` fuera de ese archivo.
3. Para un estado nuevo de regalo, añádelo a `SEAL_LABEL` y `SEAL_ICON` en `kit.tsx` y a la tabla de arriba.
4. Antes de publicar, ejecuta `impeccable detect`, las pruebas e2e (`tactil`, `sorpresa` y `navegacion`) y las capturas con `.impeccable/mocks/capturas.mjs`.

## Huecos conocidos

- El APK sigue el tema del sistema y no tiene un selector propio de claro u oscuro.
- Las fotos de la demo son de Wikimedia Commons; los créditos están en `public/demo/fotos/CREDITOS.md`.

## Modelos y su función

| Quién | Qué hizo en este documento |
|---|---|
| Claude Fable 5.2 (`claude-fable-5-2`) | Dirección de arte, especificación de tokens y estados, y revisión final |
| Claude Opus 5.5 | Mockups, implementación y redacción de este DESIGN.md |
