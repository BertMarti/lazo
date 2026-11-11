# Lazo v0.4 · Dirección de arte

Revisadas las doce capturas de `direcciones/` (A, B y C; grupo y lista; 375 y 1280 px), tres de la v0.3 (grupo móvil, lista de Mamá y hucha en escritorio) y cinco referencias de `referencias/v0.4/` (gift-people, visual-wishlist, gift-organizer, search-christmas, pinterest-gift-list-app).

**Elección: A «El catálogo de juguetes» manda.** Se le corrigen seis defectos concretos y toma dos préstamos menores de C (la línea «Se abren el 24 de diciembre» y la idea de un sello con texto para el estado, convertido en etiqueta de regalo). De B no se toma nada estructural.

Los contrastes citados están calculados con la fórmula WCAG 2.x sobre los hex de este documento. Las familias tipográficas están comprobadas en npm (`@fontsource/young-serif` 5.3.0, `@fontsource-variable/nunito` 5.3.0).

---

## 1. Crítica

### Lo que hay hoy (v0.3)

El problema no es el azul marino, es la estructura: cabecera oscura a sangre, raíl lateral, filas con barra de progreso y miniaturas de 72 px. Es una tabla de seguimiento. Las personas son filas y los regalos son registros. Cualquier dirección que conserve esa estructura cambiando el color fallará igual.

### Lo que enseñan las referencias

Las tomas de Dribbble son casi todas lo mismo: blanco, violeta o azul, iconos 3D, tarjetas pastel. Sirven por lo que confirman (rejilla de fotos a dos columnas en móvil, foto por encima del texto, estado como etiqueta sobre la foto) y por lo que hay que esquivar (el aire de plantilla, el botón flotante «+», los degradados). Ninguna tiene mundo propio. Ahí está el hueco de Lazo.

### A · El catálogo de juguetes

- **Jerarquía.** La mejor de las tres. Título, cuenta atrás, personas, deseos: se lee en ese orden sin esfuerzo. Los avatares de 84 px y las fotos cuadradas grandes cumplen la pauta de protagonistas.
- **Ilusión.** La etiqueta redonda de precio girada es el único elemento de las tres direcciones que alguien recordaría al cerrar la app. Remite al catálogo que se hojeaba en diciembre: regalo e infancia a la vez, sin Papá Noel ni rojo y verde. La cinta con lazo sobre lo reservado dice «esto ya está envuelto» sin explicación.
- **Mayores.** Nunito es ancha y abierta; los botones son grandes. Fallan los metadatos (13 px en gris) y que «reservado» y «comprado» se distinguen solo por una línea pequeña.
- **¿Genérica?** La que menos. Young Serif tiene personalidad sin ser la serif de todas las plantillas.
- **Defectos que hay que corregir:**
  1. La etiqueta de precio cabalga entre foto y texto y roba ancho al título: en móvil «Marco digital de fotos» ocupa tres líneas.
  2. La cinta cruza el centro de la foto y tapa el producto; el lazo dorado oscuro sobre banda dorada casi no se ve.
  3. Reservado y comprado llevan la misma cinta.
  4. En escritorio el masonry deja un hueco enorme bajo tres columnas, y la fila de personas no llena el ancho mientras la cuenta atrás queda huérfana a la derecha.
  5. La tarjeta de persona no muestra el presupuesto (solo una barra sin cifra) y sus miniaturas de 28 px no se leen.
  6. «Ver todo» y «Añadir sorpresa» son botones con texto subrayado: o botón o enlace.
- **Escala.** Bien. Hucha y Mis compras son cifras y filas, y el lenguaje de catálogo (precios grandes, etiquetas, fichas) las viste sin forzar. El sorteo y los estados vacíos tienen un recurso natural: el lazo y el paquete.

### B · La mesa de Nochebuena

- **Jerarquía.** La cabecera burdeos se lleva el peso y las personas quedan debajo como tarjetas blancas. En móvil las seis personas van en una columna: cinco pantallas de scroll antes de ver un solo regalo.
- **Ilusión.** Elegante, pero de restaurante o de boda. La «tarjeta de sitio» es un filete dorado sobre una tarjeta blanca; sin que te lo cuenten no se entiende. No hay nada que diga regalo.
- **Mayores.** Gloock es una didona de contraste alto: en los precios («349 €», «34,95 €») los trazos finos desaparecen y las cifras se confunden. La píldora «Cogido» es texto blanco sobre dorado, alrededor de 3:1: no pasa AA.
- **¿Genérica?** Sí en estructura. Es la v0.3 con el azul marino cambiado por burdeos: banda oscura arriba y tarjetas flotando sobre el borde. Justo lo que el usuario detesta.
- **Estados.** Reservado y comprado idénticos; la sorpresa no lleva ninguna marca.
- **Escala.** Fácil pero sosa: cada pantalla sería cabecera burdeos más tarjetas.

### C · La carta a los Reyes

- **Jerarquía.** El concepto más redondo y el sello de correos es precioso como idea. Pero convierte los regalos en una lista con miniaturas de 104 px, y eso incumple una pauta fijada (fotos grandes en tablero).
- **Ilusión.** Mucha, y muy nuestra. Dos problemas de fondo: el propio mockup dice «Se abren el 24 de diciembre» mientras el mundo visual es del 6 de enero, y la metáfora ata la app a una fecha y a una tradición (un cumpleaños o un amigo invisible no son una carta a los Reyes).
- **Mayores.** El título tachado de lo cogido es lo peor de las tres direcciones: resta legibilidad y se lee como «eliminado». El matasellos «COGIDO» es texto rojo girado de unos 9 px. Abril Fatface, tan negra, cansa en cuanto hay más de un titular por pantalla («Cartas abiertas» y «Lo más deseado» seguidos).
- **¿Genérica?** No, pero el esqueumorfismo sale caro: el dentado del sello ya se ve borroso en la captura y cada pantalla nueva pediría su objeto postal (¿qué es la hucha en una carta?).
- **Escala.** La peor. Obliga a inventar metáforas para pantallas que son cuentas.

### Resumen

| | A catálogo | B mesa | C carta |
|---|---|---|---|
| Jerarquía | Alta | Media (cabecera manda) | Media (lista, no tablero) |
| Legible para mayores | Buena, con arreglos | Floja (Gloock, píldora dorada) | Floja (tachado, matasellos) |
| Regalo, familia, ilusión | Sí | Familia sí, regalo no | Sí, pero fecha equivocada |
| Aire genérico | Bajo | Alto en estructura | Bajo |
| Escala a más pantallas | Bien | Bien pero plana | Mal |
| Cumple «fotos grandes» | Sí | Sí | No |

---

## 2. Decisión

**A, entera, como único mundo: el catálogo de la juguetería y la mesa de envolver.** Papel crema, etiquetas de precio, cinta, lazo, etiqueta colgante.

Préstamos, todos traducidos al mundo de A:

- De C, la frase bajo el título: «Se abren el 24 de diciembre · faltan 43 días». Sustituye al «43 días para el 24» suelto y resuelve la cuenta atrás huérfana.
- De C, el estado como marca con palabra encima de la foto. Aquí no es un matasellos sino una **etiqueta de regalo** opaca con icono y texto.
- De B, nada visual. Solo la lección de que el presupuesto junto al avatar en la cabecera de la lista funciona; A ya lo tiene.

Se descartan sin vuelta: cabecera de color a sangre, títulos tachados, didonas, sellos dentados.

---

## 3. Especificación

### 3.1 Paleta

Tokens semánticos. El modo oscuro no invierte: es la misma mesa con la luz baja (marrones cálidos, nunca gris ni negro puro).

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--papel` | `#f6efe2` | `#1b1612` | Fondo de página |
| `--tarjeta` | `#fffaf0` | `#27201a` | Tarjetas, hojas, barra inferior |
| `--hundido` | `#efe5d2` | `#332a21` | Pistas de progreso, campos, deshabilitado |
| `--tinta` | `#2a1d14` | `#f4ecdd` | Texto principal |
| `--tinta-2` | `#5c4a3c` | `#cbbda8` | Texto secundario |
| `--linea` | `#e0d3bb` | `#40362b` | Separadores decorativos |
| `--linea-fuerte` | `#857059` | `#8f7d68` | Borde de campos y controles |
| `--terracota` | `#b4532e` | `#e39468` | Relleno de botón primario y etiqueta de precio |
| `--terracota-pulsado` | `#963f20` | `#eda67f` | Hover y pulsado |
| `--sobre-terracota` | `#ffffff` | `#20140c` | Texto sobre terracota |
| `--terracota-tinta` | `#9a4222` | `#e39468` | Terracota usada como texto o icono |
| `--abeto` | `#23493b` | `#9ccdb6` | Progreso, «es tuyo», foco |
| `--sobre-abeto` | `#ffffff` | `#10241c` | Texto sobre abeto |
| `--abeto-fondo` | `#23493b` | `#2c5a49` | Tarjeta «Tú» (texto `#f6efe2` / `#f4ecdd`) |
| `--oro` | `#c9a24a` | `#dcb866` | Cinta, lazo, filetes. Nunca texto en claro |
| `--oro-tinta` | `#7a5a12` | `#dcb866` | Dorado como texto |
| `--oro-suave` | `#f1e1b5` | `#4a3a14` | Fondo de la marca «Sorpresa» y avisos |
| `--sobre-oro-suave` | `#4a3608` | `#f3e2b4` | Texto sobre oro suave |
| `--peligro` | `#a3261f` | `#f0907f` | Botón y texto de peligro |
| `--sobre-peligro` | `#ffffff` | `#20140c` | Texto sobre peligro |

Contrastes clave (claro / oscuro):

- Tinta sobre papel 14,3 · tinta sobre tarjeta 13,7 en oscuro.
- Tinta-2 sobre papel 7,4, sobre tarjeta 8,1, sobre hundido 6,7 · en oscuro 8,7 y 7,6.
- Blanco sobre terracota 4,98 · en oscuro, tinta `#20140c` sobre `#e39468` 7,5.
- Terracota-tinta sobre papel 5,8, sobre hundido 5,3 · en oscuro 6,7.
- Blanco sobre abeto 10,1 · abeto sobre papel 8,8 · en oscuro `#9ccdb6` sobre tarjeta 9,0.
- Oro-tinta sobre papel 5,6 · en oscuro 8,5.
- Sobre oro suave 8,9 · en oscuro 8,6.
- Blanco sobre peligro 7,4 · en oscuro 7,7.
- Línea fuerte contra papel 4,1 y contra tarjeta en oscuro 4,1 (se pide 3:1).
- El oro `#c9a24a` contra papel da 2,1: por eso es solo adorno y **nunca** carga significado por sí solo.

**Colores de persona.** Ocho, fijos por miembro, iguales en claro y oscuro, siempre con la inicial en blanco:

| Nombre | Hex | Blanco encima |
|---|---|---|
| Azul | `#3a6789` | 6,0 |
| Musgo | `#4a7336` | 5,5 |
| Frambuesa | `#a2445a` | 6,0 |
| Canela | `#96591f` | 5,6 |
| Ciruela | `#6a4c99` | 6,8 |
| Petróleo | `#1f6f6b` | 5,9 |
| Pizarra | `#55606e` | 6,4 |
| Berenjena | `#8a3f7a` | 6,8 |

Son más oscuros que los del mockup a propósito: el ocre de Papá (`#a8672a`) se quedaba en 4,5 con blanco, sin margen. En oscuro estos colores caen a 2,4–2,9 contra la tarjeta, así que el avatar lleva siempre un aro de 2 px en `--papel` (claro) o `--tinta` (oscuro). El color de persona no se usa como texto ni como única señal de quién es: el nombre va siempre al lado.

### 3.2 Tipografía

- **Títulos: Young Serif**, `@fontsource/young-serif`, peso 400 (el único que tiene). Se usa para títulos, nombres de persona y cifras grandes. Nunca en párrafos ni por debajo de 20 px.
- **Interfaz: Nunito**, `@fontsource-variable/nunito` (eje de peso). Pesos en uso: 500 texto, 700 etiquetas y títulos de regalo, 800 botones y precios. `font-variant-numeric: tabular-nums` en todo lo que sea dinero.
- Importar solo los subconjuntos `latin` y `latin-ext`. Fallbacks: `Georgia, serif` y `system-ui, sans-serif`.

| Token | Móvil | Escritorio | Familia y peso |
|---|---|---|---|
| `display` | 40/44 | 64/66 | Young Serif. Título del grupo, nombre en la lista |
| `titulo-1` | 32/36 | 40/44 | Young Serif. Título de pantalla |
| `titulo-2` | 24/30 | 28/34 | Young Serif. Secciones |
| `titulo-3` | 20/26 | 20/26 | Young Serif. Nombre en tarjeta de persona |
| `cifra` | 48/48 | 56/56 | Young Serif. Cuenta atrás, «te falta poner» |
| `cuerpo-g` | 18/28 | 18/28 | Nunito 500. Textos de entrada y vacíos |
| `cuerpo` | 16/24 | 16/24 | Nunito 500. Base |
| `regalo` | 16/22 | 17/24 | Nunito 700. Título de un regalo |
| `meta` | 15/22 | 15/22 | Nunito 500, en `--tinta-2` |
| `marca` | 14/20 | 14/20 | Nunito 700. Etiquetas de estado, barra inferior |
| `boton` | 16/20 | 16/20 | Nunito 800 |

Nada por debajo de 14 px, y 14 solo en etiquetas de una o dos palabras en negrita. Sin mayúsculas sostenidas ni interletrado abierto. Todo en `rem` para respetar el tamaño de letra del teléfono.

### 3.3 Radios, sombras, espaciado

- Radios: `--r-s: 10px` (marcas, miniaturas), `--r-m: 14px` (campos, fotos dentro de fila), `--r-l: 20px` (tarjetas, hojas), `--r-pildora: 999px` (botones, precio, pestañas).
- Sombras cálidas, tintadas de marrón, nunca gris:
  - `--sombra-1: 0 1px 2px rgba(74,45,20,.08), 0 2px 8px rgba(74,45,20,.06)` · tarjetas en reposo.
  - `--sombra-2: 0 4px 10px rgba(74,45,20,.10), 0 12px 28px rgba(74,45,20,.10)` · hojas, tarjeta levantada, etiqueta de precio.
  - En oscuro no hay sombra: las tarjetas se separan con borde de 1 px `--linea`.
- Espaciado en pasos de 4: 4, 8, 12, 16, 20, 24, 32, 48, 64. Margen lateral 20 px en móvil; contenedor de 1140 px en escritorio.
- Foco: `outline: 3px solid var(--abeto); outline-offset: 2px` en todo lo interactivo. Sobre la tarjeta «Tú» el contorno pasa a `--oro`.

### 3.4 Botones

Todos: alto 48 px en móvil y 44 px en escritorio (mínimo absoluto 44), radio píldora, Nunito 800 de 16 px, relleno horizontal de 20 px, una sola línea (si no cabe, se acorta el texto, no se parte como «Poner mi / parte» en el mockup). Sin subrayado. Pulsado: `transform: scale(.98)` en 80 ms.

| Variante | Reposo | Hover / pulsado | Para qué |
|---|---|---|---|
| Primario | Fondo `--terracota`, texto `--sobre-terracota` | Fondo `--terracota-pulsado` | Una vez por tarjeta o pantalla: Reservar, Ya comprado, Entrar |
| Secundario | Transparente, borde 2 px `--tinta`, texto `--tinta` | Fondo `--hundido` | Poner mi parte, Invitar, Ver todo |
| Fantasma | Sin borde, texto `--tinta`, icono opcional | Fondo `--hundido` | Soltar, Cancelar, Cambiar |
| Peligro | Fondo `--peligro`, texto `--sobre-peligro` | Oscurecer un 10 % | Solo dentro de la confirmación: Borrar regalo, Salir del grupo |

El disparador de una acción destructiva es un fantasma con texto `--peligro`; el botón de peligro relleno aparece solo en el diálogo de confirmación. Deshabilitado: fondo `--hundido`, texto `--tinta-2` y, debajo, una línea que dice por qué. En carga: el texto cambia («Reservando…») y el ancho no salta.

### 3.5 Marca

- Símbolo: un lazo propio de dos bucles llenos y dos cabos, dibujado en rejilla de 24 px, relleno, en `--terracota`. El icono del mockup es fino y a 20 px se confunde con unas tijeras: hay que redibujarlo con bucles gruesos y nudo marcado.
- Logotipo: el lazo más «Lazo» en Young Serif, en `--terracota-tinta`.
- El mismo lazo, sin variantes de estilo, aparece en cuatro sitios: logotipo, cinta de lo reservado, estados vacíos y favicon (lazo terracota sobre crema). Es el único ornamento de la app.

### 3.6 Navegación

- **Móvil:** barra inferior fija sobre `--tarjeta` con borde superior `--linea`, cuatro destinos (Grupo, Hucha, Mis compras, Sorteo), icono de 24 px y etiqueta de 14 px siempre visible. Activo: icono y texto en `--terracota-tinta`, peso 800, y una píldora `--hundido` detrás del icono. Zona táctil de 64 px de alto más `env(safe-area-inset-bottom)`. El contenido lleva relleno inferior para que nada quede debajo.
- **Escritorio:** cabecera sobre el mismo papel, sin banda de color: logotipo a la izquierda, pestañas en píldora centradas (activa: fondo `--tinta`, texto `--papel`), avatar propio a la derecha.
- Volver: flecha con texto («‹ Navidad en familia») encima del título, no un icono suelto.

### 3.7 Pantallas

**Inicio del grupo**

1. Título del grupo en `display`. Debajo, una línea: «Se abren el 24 de diciembre · faltan **43** días», con la cifra en Young Serif.
2. Rejilla de personas: 2 columnas en móvil, `repeat(auto-fit, minmax(170px, 1fr))` en escritorio para que llenen el ancho. Cada tarjeta: avatar de 80 px, nombre en `titulo-3`, «3 regalos · 1 libre», barra de progreso de 8 px en `--abeto` y debajo la cifra «65 € de 150 €». Sin miniaturas. Toda la tarjeta es un enlace.
3. Tu tarjeta va primera, en `--abeto-fondo`: «Tu lista · 3 regalos» y «Lo que te regalan es sorpresa». Sin barra ni cifras, por la regla de oro.
4. Plaza sin ocupar: borde discontinuo `--linea-fuerte`, nombre, «Aún no ha entrado» y botón secundario «Invitar».
5. «Lo más deseado»: tablero de regalos libres del grupo (2 columnas en móvil, 4 en escritorio) con «Ver todo» secundario. Nunca incluye regalos de tu propia lista.

**Lista de otra persona**

1. Cabecera: avatar de 96 px, nombre en `display`, «5 regalos · 1 libre» y la marca «Mamá no ve esto» (oro suave, icono de ojo tachado).
2. Tira de presupuesto en tarjeta: «374,90 € de 400 €», barra, «Quedan 25,10 €».
3. «Su lista» con «Añadir sorpresa» (secundario con icono «+»; el primario se reserva para Reservar).
4. Tablero. **Rejilla uniforme, no masonry**: foto 1:1, título a dos líneas como máximo, acciones ancladas abajo, tarjetas de igual alto por fila. Columnas: 1 por debajo de 340 px, 2 en móvil, 3 desde 768 px, 4 desde 1100 px. Orden: libres, a medias, reservados, comprados.
5. Pulsar la foto abre el detalle: hoja inferior en móvil, diálogo centrado de 560 px en escritorio, con foto grande, tienda, enlace, nota y las mismas acciones.

**Tarjeta de regalo (pieza base)**

- Foto 1:1 con radio `--r-l` arriba.
- **Etiqueta de precio**: círculo de 56 px en `--terracota`, texto 15 px 800, girado −6°, con `--sombra-2`, **dentro** de la foto en la esquina superior derecha a 10 px del borde. Si el precio es largo («1.299 €») crece a cápsula. No invade el texto.
- **Etiqueta de estado**: abajo a la izquierda de la foto, opaca (ver 3.8).
- Debajo: título `regalo`, línea `meta`, botones.

**Tu propia lista**

Mismo tablero sin cinta, sin etiquetas de estado, sin progreso. Arriba, aviso en oro suave: «Lo que te regalan es sorpresa. Aquí solo ves lo que has pedido.» Primario «Añadir un deseo». Las sorpresas que otros apuntan para ti no existen en esta vista, ni contadas.

**Añadir un deseo o una sorpresa**

Una columna de 560 px como máximo. Primero la foto (zona grande para pegar enlace o subir imagen), luego nombre, precio, tienda y nota. Etiquetas encima del campo, campos de 48 px de alto con borde `--linea-fuerte` sobre `--tarjeta`. Primario a todo el ancho, fijo abajo en móvil.

**Hucha**

Lenguaje de tique de caja de la juguetería. Arriba «Te falta poner» y la cifra en `cifra`; barra; primario «Ya se lo di a Alberto». Debajo, «Tu parte, persona a persona» como filas de tique: avatar de 40 px, nombre, detalle en `meta`, importe a la derecha en tabular, separadas por línea de puntos. Aviso en oro suave: «Aquí no sale lo que se gasta en ti». La vista de quien lleva la hucha añade una fila por persona con su marca «Pagado» o «Pendiente» (icono y texto).

**Mis compras**

Filas con foto de 72 px, título, «Para Mamá» con su avatar de 24 px, precio y marca de estado. Dos grupos: «Por comprar» (con primario «Ya comprado») y «Comprado». Arriba el total gastado en `cifra`.

**Sorteo**

Antes: fila de avatares grandes y primario «Hacer el sorteo». Después: una sola tarjeta centrada, cerrada con cinta dorada, «Te ha tocado…» y botón «Abrir»; al abrir, la cinta se suelta y aparece el avatar de 120 px con el nombre en `display` y un enlace a su lista. Es el único otro uso de la animación del lazo.

**Entrar con un enlace (la pantalla de los abuelos)**

Una columna, sin navegación. Lazo grande, «Te han invitado a **Navidad en familia**» en `titulo-1`, los avatares del grupo en fila para reconocer a la familia, una pregunta («¿Quién eres?») con las plazas libres como botones grandes con avatar y nombre, y un primario «Entrar». Texto en `cuerpo-g`. Sin contraseña a la vista ni jerga. Pendiente de aprobación: misma composición con «Hemos avisado a Alberto. Cuando te deje pasar, entrarás con este mismo enlace.»

**Estados vacíos**

El lazo sin anudar (dibujo de línea, 96 px, `--oro`), una frase en `titulo-2`, una línea en `cuerpo-g` y un botón. Ejemplos: «Mamá aún no ha pedido nada» + «Añadir sorpresa»; «Todavía no has reservado nada» + «Ver el grupo». Sin ilustraciones de personajes.

**Errores**

Tono llano y con salida. En línea: texto `--peligro` con icono bajo el campo y borde de 2 px. De página (enlace caducado, sin conexión): misma composición que un vacío, con el lazo deshecho y un primario («Pedir otro enlace», «Reintentar»). Avisos efímeros: abajo, encima de la barra, fondo `--tinta` y texto `--papel`, con «Deshacer» cuando proceda, y `role="status"`.

### 3.8 Estados de un regalo

Cada estado lleva tres señales redundantes: **etiqueta con icono y texto** sobre la foto, **línea de texto** bajo el título y **acciones** distintas. La cinta es un refuerzo, nunca la única señal. La etiqueta es una pastilla opaca de 28 px de alto, radio `--r-s`, texto `marca`.

| Estado | Etiqueta sobre la foto | Cinta | Línea bajo el título | Acciones |
|---|---|---|---|---|
| **Libre** | Ninguna | No | «Libre» | Primario «Reservar»; en el detalle, secundario «Comprarlo a medias» |
| **Reservado por otro** | «Reservado», icono de lazo. Fondo `--tarjeta`, texto `--tinta` | Una banda horizontal `--oro` de 16 px en el tercio inferior, con lazo | «Lo reserva Samira» | Ninguna |
| **Reservado por mí** | «Lo llevas tú», icono de lazo. Fondo `--abeto`, texto `--sobre-abeto` | La misma banda, en `--abeto`; borde de tarjeta 2 px `--abeto` | «Lo has reservado tú» | Primario «Ya comprado», fantasma «Soltar» |
| **A medias** | «A medias», icono de dos mitades. Fondo `--tarjeta`, texto `--tinta` | No | «Faltan 140 € de 349 €», barra fina y avatares de quien ya puso | Secundario «Poner mi parte»; si ya pusiste: «Tu parte: 70 €» y fantasma «Cambiar» |
| **Comprado** | «Comprado», icono de visto. Fondo `--tinta`, texto `--papel` | Dos bandas `--oro` en cruz (paquete envuelto) con lazo en el cruce | «Ya comprado por Papá» o «Ya lo has comprado» | Ninguna; si es tuyo, fantasma «Deshacer» |
| **Sorpresa** | «Sorpresa», icono de ojo tachado. Fondo `--oro-suave`, texto `--sobre-oro-suave`, arriba a la izquierda | La del estado que tenga | «Idea de Papá · Mamá no la ha pedido» | Las del estado que tenga |

Notas:

- Reservado es una cinta; comprado es el paquete atado en cruz. La diferencia se ve a un metro y además está escrita.
- La sorpresa es una cualidad que se suma a cualquier estado, por eso ocupa otra esquina.
- La foto de lo reservado y lo comprado no se atenúa con opacidad (baja el contraste del texto); la cinta basta.
- El título no se tacha nunca.
- Lector de pantalla: el nombre accesible de la tarjeta incluye el estado («Marco digital de fotos, 129 euros, reservado por Samira»).
- En la lista propia no se pinta ninguno de estos estados ni se envían al cliente.

### 3.9 Microinteracciones

**El lazo que se anuda (al reservar)**

1. Al pulsar «Reservar» el botón pasa a «Reservando…».
2. Con la respuesta, la banda entra de izquierda a derecha (`scaleX` de 0 a 1, origen izquierdo, 240 ms, `cubic-bezier(.2,.8,.2,1)`).
3. El lazo se dibuja en el punto de cruce: los dos bucles con `stroke-dashoffset` (260 ms), luego se rellenan y hacen un asentamiento de escala 1,08 a 1 (120 ms). Total en torno a 620 ms.
4. Aparece la etiqueta «Lo llevas tú» y los botones cambian a «Ya comprado» y «Soltar». Aviso efímero con «Deshacer» durante 5 s; `aria-live="polite"`: «Has reservado Chal de lana merino».

Solo `transform`, `opacity` y `stroke-dashoffset`. Con `prefers-reduced-motion: reduce`: cinta y lazo aparecen en su estado final con un fundido de 120 ms.

**Confeti discreto (en «Ya comprado»)**

- Entre 14 y 18 trocitos de papel (rectángulos de 6×10 px y dos lazos pequeños) en terracota, abeto, oro y `--tinta-2`.
- Salen del botón, suben entre 40 y 120 px en abanico, giran y caen con fundido. 900 ms, una sola vez, sin cubrir la pantalla ni bloquear toques (`pointer-events: none`, `aria-hidden`).
- A la vez, la banda se convierte en cruz y la etiqueta cambia a «Comprado».
- Se hace con elementos y CSS (variables por pieza); no hace falta una librería.
- Con `prefers-reduced-motion: reduce`: no hay confeti; solo el cambio de etiqueta y el aviso «Comprado. ¡Uno menos!».
- Nunca al cargar una página, nunca dos veces por el mismo regalo, nunca en la lista propia.

Lo demás, sin adornos: hover de tarjeta con elevación a `--sombra-2` y 2 px hacia arriba (150 ms), hojas que suben en 220 ms, barras de progreso que crecen una vez al entrar.

### 3.10 Qué evitar

- Raíl lateral, cabecera de color a sangre y cualquier banda oscura superior.
- Grises fríos, azul marino, blanco puro (`#fff`) como fondo y negro puro como texto o como fondo oscuro.
- Rojo y verde de manual, nieve, gorros, abetos dibujados, emojis como iconos.
- Degradados, vidrio esmerilado, iconos 3D, botón flotante «+».
- El oro como texto en claro o como única señal de un estado.
- Estado solo por color, por opacidad o por tachado.
- Texto sobre foto sin pastilla opaca detrás.
- Masonry con tarjetas de alto libre (deja huecos) y miniaturas menores de 64 px.
- Young Serif en párrafos o en tamaños pequeños; texto por debajo de 14 px; mayúsculas sostenidas.
- Botones con texto subrayado, botones a dos líneas, más de un primario por tarjeta.
- Fuentes desde CDN (la CSP lo impide): solo Fontsource empaquetado.
- Confeti a pantalla completa, animaciones en bucle, rebotes largos.
- Metáforas nuevas (sellos, cartas, mesas): el mundo es uno, el catálogo y el lazo.
- Cualquier dato de la lista propia que delate una reserva: contadores, progreso, sorpresas o cambios de orden.
