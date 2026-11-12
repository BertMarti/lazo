# Lazo · Dirección de arte y UX (v0.2)

Autor: dirección de arte / UX. Fecha: 2026-11-11. Ámbito: toda la app, con foco en la pantalla de grupo y la lista de una persona.
Prioridad del encargo: **sencilla e intuitiva, UI/UX práctica**. Todo lo decorativo que no ayude a reservar, añadir o entender la sorpresa, sobra.

Familia de ejemplo en todo el documento: **Alberto** (quien mira, salvo que se diga otra cosa), **Javier**, **Samira**, **Marta**, **Papá**. Grupo: «Navidad en familia», 24 de diciembre.

> Nota de estado. Las capturas de `docs/design/v0.1/` están desfasadas: muestran la familia Robles. `src/api/seed.ts` ya tiene la familia nueva y `src/core/budget.ts` + `Api.setBudget` + `ListDetail.budget` ya existen, pero **ninguna pantalla pinta el presupuesto todavía**. Esta dirección especifica esa interfaz. Los contrastes citados están calculados con la fórmula WCAG 2.x sobre los hex exactos (no estimados).

---

## A) Crítica de lo actual

Escala: **P0** rompe un requisito o el uso · **P1** fricción seria · **P2** calidad visual / coherencia · **P3** pulido.

### A.0 Transversal

| # | Pri | Problema | Evidencia |
|---|-----|----------|-----------|
| T1 | P0 | **Reservar cuesta 2 toques** (abrir ficha → «Reservar»). El requisito es 1. | `GiftTag` es un botón que solo abre `ItemSheet`. |
| T2 | P0 | **No se ve quién ha reservado/comprado** sin abrir la ficha («Lo tiene: …» solo vive en `ItemSheet`). El requisito 2 pide verlo en la lista. | `Gift.tsx` solo pinta banda «Reservado»/«Comprado». |
| T3 | P0 | **El presupuesto no existe en la interfaz** (ni en grupo, ni en lista). | Sin uso de `budgetProgress` en `src/ui`. |
| T4 | P0 | **La barra azul se estira sola**: en inicio, lista ajena, compras y amigo invisible la cabecera ocupa ~400 px vacíos. `.app` declara `grid-template-rows: auto 1fr auto` pero en la demo tiene 4 hijos (`demo-bar`, `topbar`, `main`, `tabbar` fija): la cabecera cae en la fila `1fr`. | `movil/inicio.png`, `lista-ajena.png`, `compras.png`, `amigo-invisible.png`. |
| T5 | P1 | **El sello festoneado sin texto no se entiende**. Un círculo punteado = «libre», uno con raya = «reservado», uno medio relleno = «a medias»: hay que aprenderlo. Incumple «sin depender solo de la forma»: el texto solo está en `aria-label`. | Todas las tarjetas. |
| T6 | P1 | **El 45 % de cada tarjeta es un bloque pastel con una letra** (monograma del título). No informa de nada, empuja el contenido y hace la página de grupo de 6 479 px de alto en móvil. | `movil/grupo.png`. |
| T7 | P1 | **La regla de la sorpresa se explica con un párrafo**, y solo en la lista propia. En las listas ajenas no hay nada que diga «Marta no ve esto», que es justo donde da miedo tocar. | `List.tsx` `.secret`. |
| T8 | P2 | **Bodoni en precios pequeños** (17–20 px): las astas finas se pierden en pantallas baratas y con vista cansada; los ceros con barra del cuerpo de texto conviven con cifras Didone → dos sistemas de números. | `.price`. |
| T9 | P2 | **Contrastes que no llegan**: `--ink-3` sobre `--sunken` = 4,45:1 (texto «Ponen: …», «Reunido…» en la ficha) < 4,5. Relleno de la barra `--foil-fill` sobre `--sunken` = 1,32:1 (< 3:1 exigido a gráficos). Borde de campos `--line-strong` sobre blanco = 1,95:1 (< 3:1). | Calculado. |
| T10 | P2 | **Título duplicado**: «Mis compras» y «Amigo invisible» salen en la cabecera azul y otra vez como `h2` debajo. | `compras.png`, `amigo-invisible.png`. |
| T11 | P2 | **Escritorio vacío**: contenido pegado a la izquierda y 50–60 % de lienzo en blanco; la barra «Demo» solo cubre la columna derecha. | `escritorio/lista-ajena.png`. |
| T12 | P3 | Pestaña «Grupo» marcada como activa en Inicio, donde no hay grupo abierto. | `inicio.png`. |

### A.1 Inicio

- **P0** Cabecera estirada (T4): «Lazo» flota sobre 300 px de azul vacío.
- **P1** «Crear grupo» es la acción principal para alguien que casi siempre **llega invitado a un grupo que ya existe**. La acción principal real es entrar en su grupo: las tarjetas de grupo deben ir primero y «Crear grupo» pasar a secundario al final.
- **P2** «Una caja por ocasión. Dentro, la lista de cada uno.» explica una metáfora en vez de decir qué hacer. Sobra.
- **P2** Las tarjetas de grupo no dicen cuánta gente hay ni si me queda algo por hacer (p. ej. «5 personas · tu lista: 4 regalos»).
- **P3** Con un solo grupo, Inicio debería saltar directo al grupo.

### A.2 Grupo

- **P0** No hay tarjetas de miembro: cada persona es una cabecera + un carril horizontal de regalos. El requisito 4 pide tarjetas con avatar que abren la lista.
- **P0** Sin presupuesto (T3).
- **P1** Los carriles horizontales **cortan** títulos y precios en el borde («Cafetera italiana de 6…», «65,0…»), esconden contenido sin indicio y obligan a deslizar en dos ejes. 6 carriles = 6 479 px de alto: nadie ve a toda la familia de un vistazo.
- **P1** La pantalla mezcla dos trabajos (elegir persona / elegir regalo). Resultado: ninguno se hace rápido.
- **P1** «Tu lista» se pinta igual que las demás (cuatro tarjetas rosas mudas). La sorpresa se reduce a un subtítulo gris de 15 px.
- **P2** «Añadir a mi lista» (48 px, relleno) e «Invitar» (48 px, contorno) están alineados, pero «Invitar» compite con la acción principal en la primera línea de la pantalla. Invitar es ocasional: va al menú de cabecera.
- **P2** Tarjetas del mismo carril con alturas distintas (2 o 3 líneas de pie): el carril baila.
- **P3** «5 personas · 18 regalos en 6 listas» es un dato de administración, no de uso.

### A.3 Lista ajena

- **P0** Reservar en 2 toques (T1). No se ve quién (T2). Sin presupuesto ni progreso (T3). Cabecera estirada (T4).
- **P1** La banda «RESERVADO» en diagonal **tapa el monograma** y el sello tapa la banda: tres capas para decir una palabra.
- **P1** Rejilla de 2 columnas de 173 px en móvil: los títulos se truncan a 2 líneas cortas («Guantes de ciclismo de…») y no cabe un botón con texto. Para gente mayor, una fila ancha se lee mejor que dos tarjetas estrechas.
- **P2** «Me encantaría» en dorado de 13 px es la única señal de prioridad y parece un enlace.
- **P2** Las tarjetas libres y las cogidas pesan lo mismo: no se ve de un vistazo qué queda por regalar.

### A.4 Lista propia

- **P1** El aviso de sorpresa es largo y con chiste («es la gracia»): tres líneas para una idea que cabe en una.
- **P1** **Botones descuadrados**: «Añadir regalo» (≈330 px) e «Importar Excel» (≈347 px) apilados con anchos distintos dentro del bloque rosa. Es literalmente el defecto que el encargo prohíbe.
- **P1** Las tarjetas alternan «precio en línea con la tienda» y «precio en línea aparte» según quepa (`flex-wrap`): filas de la rejilla con composición distinta.
- **P2** El bloque rosa de cabecera + aviso translúcido + botones es una tarjeta dentro de una tarjeta.
- **P2** No se puede reordenar ni ver la prioridad salvo «Me encantaría».

### A.5 Ficha de regalo / a medias

- **P1** 200 px de bloque verde con una «B» antes de llegar a nada útil. En un móvil pequeño el estado queda bajo el pliegue.
- **P1** Cuando ya aporto, **desaparece el pie de acciones** y la única acción es un «Quitar mi aportación» centrado (el resto va alineado a la izquierda). No puedo cambiar mi parte sin quitarla y volver a ponerla.
- **P1** «Hacerlo a medias» es un botón fantasma perdido dentro del panel de estado; para un regalo de 549 € debería ser la acción propuesta.
- **P2** `--ink-3` sobre `--sunken` no pasa AA (T9). La barra dorada sobre lila claro apenas se distingue.
- **P2** «Pagado» es una casilla que cualquiera puede marcar por otro sin aviso.
- **P3** `confirm()` nativo para quitar un regalo: rompe el estilo y en PWA de iOS se ve ajeno.

### A.6 Nuevo regalo

- **P0** Añadir cuesta **mínimo 4 interacciones** (pegar, «Rellenar», desplazarse, «Añadir a la lista») con 9 campos a la vista. El requisito son 2 toques pegando un enlace.
- **P1** «Rellenar» parece deshabilitado (gris) y es un paso que el usuario no debería dar: pegar ya es la orden.
- **P1** Al abrir, el foco cae en la «X» de cerrar (anillo azul visible) en vez de en el campo del enlace.
- **P2** Segmentado «¿Cuántas ganas?»: «Me encantaría» parte en dos líneas y las otras dos opciones no → alturas ópticas distintas.
- **P2** Talla, color, cantidad y notas tienen el mismo peso que el título. Deben ir plegados en «Más detalles».

### A.7 Mis compras

- **P0** Cabecera estirada (T4) + título duplicado (T10).
- **P1** **Fugas de caja**: los sellos salen por el borde izquierdo del panel y los precios tocan el borde derecho (la lista no hereda el relleno del panel).
- **P1** No hay acción en la fila: para marcar «comprado» hay que abrir la lista de la persona. Esta pantalla es la lista de la compra; debe permitir tachar.
- **P2** Sin agrupar por persona ni por estado («por comprar» / «comprado»). El total mezcla reservas y aportaciones sin desglose.
- **P2** «Para Marta · Navidad en fam…» se trunca; el grupo es redundante si solo hay uno.

### A.8 Amigo invisible

- **P0** Cabecera estirada (T4) + título duplicado (T10).
- **P1** **«Repetir el sorteo» es el único botón de la pantalla** y es destructivo: cambia a quién regala todo el mundo. Debe ser solo para quien organiza, en estilo `danger`, con confirmación dentro de una hoja.
- **P2** El nombre se revela sin gesto; el sobre con tapa existe en CSS (`.envelope .cover`) pero la captura lo muestra ya abierto. Un «Toca para ver a quién regalas» evita que lo lea quien mira por encima del hombro.
- **P3** «Presupuesto: 30,00 €» no enlaza con la lista de la persona que te ha tocado, que es el siguiente paso obvio («Ver su lista»).

---

## B) Tres exploraciones

Las tres resuelven lo mismo (pantalla de grupo con tarjetas de miembro + lista de una persona) con decisiones materialmente distintas.

### B.1 «La bandeja» — evolución de la caja de confitería

**Tesis.** La caja ya está abierta: ahora se ve la bandeja. Cada persona es **una pieza envuelta en su papel** (tarjeta de miembro), y al abrirla salen sus regalos como **filas anchas** con el botón a la derecha. Se conserva el mundo (azul turrón, dorado, sabores, precinto) y se elimina todo lo que no trabaja (monogramas gigantes, carriles, sello mudo).

- **Retícula móvil 390.** 4 columnas, margen 16, medianil 12 → ancho útil 358. Todo va a 1 columna de 358. Tarjeta de miembro 128 px de alto: las 5 caben en ≈688 px, una pantalla.
- **Retícula escritorio 1440.** Raíl 264 + lienzo 1176; 12 columnas de 72 con medianil 24 → 1128. Módulo único de **360 px (4 columnas)**. Grupo: 3 tarjetas por fila. Lista: dos paneles, miembros a la izquierda (360) + regalos a la derecha (744 = 2 × 360 + 24).
- **Tarjeta de miembro.** Avatar de sabor 48 · nombre en Bodoni 22 · «6 regalos · 4 libres» · barra de presupuesto con «124,90 € de 200,00 €» y «Quedan 75,10 €». Fondo blanco; el sabor vive solo en el avatar y en un filo superior de papel de 6 px.
- **Tarjeta de regalo.** Fila: miniatura 72 (foto o papel del sabor con frunces, sin letra) · título 2 líneas · precio + tienda · pie con estado en texto («Lo reserva Samira») a la izquierda y **botón a la derecha**.
- **Reservar en 1 toque.** Botón `primary` «Reservar» en el pie de cada fila libre, siempre en la misma esquina (abajo-derecha), 44 px de alto, 128 de ancho mínimo. Sin confirmación; «Deshacer» en el aviso durante 6 s.
- **Presupuesto.** Barra horizontal de 10 px, relleno dorado oscuro sobre pista lila; cifras encima. Excedido: relleno granate + «Os pasáis 35,00 €» con icono.
- **Microcopy de visibilidad.** Etiqueta con ojo tachado **«Marta no ve esto»** pegada al presupuesto y a la cabecera de la lista. En mi tarjeta: «Tu presupuesto y tus reservas son sorpresa».
- **Riesgo honesto.** Es la menos espectacular: filas blancas con botón pueden leerse como «lista de la compra con buen gusto». La identidad descansa en tres cosas pequeñas (sabores, precinto, Bodoni en nombres); si se ejecutan flojas, queda genérica. Además, a 1 columna las listas de 15+ regalos son largas.

### B.2 «La libreta» — libro de cuentas de la abuela

**Tesis.** Nada de tarjetas: una **libreta de tapas azules con renglones**. La familia es una tabla; el dinero manda. Tipografía y filetes hacen todo el trabajo, cero sombras.

- **Retícula móvil 390.** Margen 20, una columna de 350 con renglones cada 56 px; columna de cifras a la derecha de 96 px alineada a la coma decimal.
- **Retícula escritorio 1440.** Dos páginas enfrentadas de 540 px centradas (como un cuaderno abierto): izquierda familia, derecha lista.
- **Tarjeta de miembro.** No es tarjeta: renglón con avatar 32, nombre en Bodoni 20, «4 libres» y a la derecha «75,10 €» restantes en cifras grandes; debajo, un filete que se rellena (barra de 3 px sobre el propio renglón).
- **Tarjeta de regalo.** Renglón sin miniatura: título · tienda · precio en columna; estado como anotación al margen en cursiva («Samira», «a medias 63 %»).
- **Reservar en 1 toque.** Casilla cuadrada de 28 px al inicio del renglón: tocarla escribe tus iniciales dentro («A»).
- **Presupuesto.** El filete del renglón + suma al pie de página («Comprometido 124,90 · Quedan 75,10»), como una cuenta.
- **Microcopy de visibilidad.** Nota al pie de página: «Marta no lee esta página».
- **Riesgo honesto.** Incumple el requisito 4 al pie de la letra (tarjetas con avatar). Una casilla sin palabra no dice «reservar» y un toque accidental reserva sin enterarte. Sin fotos, los regalos de Amazon pierden lo que mejor los identifica. Y se siente contabilidad: frío para Navidad.

### B.3 «El calendario» — calendario de adviento

**Tesis.** El grupo es un **calendario de adviento**: cada persona es una puerta cuadrada a todo color con su sabor; abrirla despliega sus regalos como ventanitas con foto. Máxima fiesta.

- **Retícula móvil 390.** 2 columnas de 173 con medianil 12; puertas cuadradas 173 × 173; ventanas de regalo 173 × 216.
- **Retícula escritorio 1440.** 5 puertas en una fila (208 px) sobre un tablero central de 1128; al abrir una, la fila se compacta y debajo aparece una rejilla de 4 columnas de 264.
- **Tarjeta de miembro.** Puerta rellena del color de sabor, avatar 72 centrado con **anillo de presupuesto** alrededor, nombre en Bodoni 22 debajo, «4 libres» como número de puerta en la esquina.
- **Tarjeta de regalo.** Foto a sangre 173 × 130, título 2 líneas, precio; estado como precinto dorado que cruza la foto con el nombre («SAMIRA»).
- **Reservar en 1 toque.** Botón a todo el ancho en el pie de cada ventana («Reservar», 44 px).
- **Presupuesto.** Anillo alrededor del avatar + «Quedan 75 €» bajo el nombre. Excedido: anillo granate completo.
- **Microcopy de visibilidad.** Tu propia puerta sale cerrada con lazo: «Tu puerta no se abre para ti».
- **Riesgo honesto.** El anillo se lee peor que una barra para dinero (el encargo pide barra) y no deja sitio a «comprometido / objetivo / restante». 5 puertas de color lleno compiten con el dorado y con las fotos de producto. La metáfora solo vale en diciembre: Lazo también es cumpleaños, bodas y bebés. Dos columnas de 173 px truncan títulos y nombres («Lo reserva Javier» no cabe). Es la más vistosa y la menos práctica.

### Veredicto

| Criterio (peso) | B.1 Bandeja | B.2 Libreta | B.3 Calendario |
|---|---|---|---|
| Sencilla e intuitiva (×3) | 5 | 3 | 3 |
| Reservar en 1 toque sin errores (×2) | 5 | 2 | 4 |
| Presupuesto legible (×2) | 5 | 4 | 2 |
| Sorpresa entendida sin explicar (×2) | 5 | 3 | 4 |
| Carácter propio (×1) | 3 | 4 | 5 |
| Vale todo el año (×1) | 4 | 5 | 1 |
| **Total (máx. 55)** | **52** | **35** | **35** |

**Se elige B.1 «La bandeja».** Toma una sola cosa de B.2: las cifras de dinero en sans tabular alineadas a la derecha. De B.3 no toma nada.

---

## C) Especificación de «La bandeja»

### C.1 Principios de ejecución (5)

1. **Una pantalla, un trabajo.** Grupo = elegir persona. Lista = elegir regalo. Ficha = detalles y a medias.
2. **Texto antes que símbolo.** Todo estado se lee en una frase con sujeto: «Lo reserva Samira». El sello acompaña, nunca sustituye.
3. **El botón vive siempre abajo a la derecha** de su tarjeta, misma altura, mismo ancho mínimo. Un primario por tarjeta como máximo.
4. **Lo que X no ve, lo dice la interfaz con su nombre:** «Marta no ve esto».
5. **Lo libre pesa, lo cogido descansa.** Blanco con sombra = disponible; plano con filete = ya cogido; dorado claro = lo tuyo.

### C.2 Tokens

Se conserva `:root` de `src/styles.css` salvo lo marcado. **Cambia** = editar valor; **Nuevo** = añadir.

#### Color (claro)

| Token | Hex | Uso | Contraste verificado |
|---|---|---|---|
| `--box` | `#1b2545` | cáscara, botón primario | — |
| `--box-2` | `#27335c` | hover primario, pestaña activa | `--on-box` 10,95 · `--foil` 6,74 |
| `--on-box` | `#f3f1fa` | texto sobre azul | 13,44 sobre `--box` |
| `--on-box-2` | `#b9c0dc` | texto secundario sobre azul | 8,33 sobre `--box` |
| `--foil` | `#dcbd6e` | titulares/acentos sobre azul | 8,26 sobre `--box` |
| `--foil-fill` | `#e6cc86` | precinto, sello lleno | texto `#241c05` 10,73 · `--ink` 9,86 |
| `--foil-ink` | `#7c5e14` | texto dorado sobre claro | 6,06 blanco · 5,48 `--ground` · 5,14 `--foil-tint` · 5,07 `--sunken` |
| `--foil-tint` | `#f6ecd1` | fondo de «lo mío», avisos | `--ink` 13,17 · `--ink-2` 6,49 · `--ink-3` 5,23 |
| **`--bar`** (Nuevo) | `#96741a` | relleno de barras (presupuesto, a medias) | 3,66 sobre `--sunken` · 4,37 sobre blanco (gráfico ≥ 3:1) |
| `--ground` | `#f4f3f8` | fondo | — |
| `--surface` | `#ffffff` | tarjetas | — |
| `--sunken` | `#ebeaf2` | pista de barras, paneles hundidos | — |
| `--ink` | `#1b2242` | texto | 15,51 blanco · 14,05 `--ground` |
| `--ink-2` | `#4a5274` | texto secundario | 6,92 `--ground` · 6,39 `--sunken` |
| **`--ink-3`** (Cambia) | `#636a88` → **`#596080`** | metadatos | 6,16 blanco · 5,58 `--ground` · **5,16 `--sunken`** (antes 4,45: fallaba) |
| `--line` | `#dddfea` | filetes decorativos | — |
| `--line-strong` | `#b4b9cf` | solo decorativo (1,95: no vale como borde de control) | — |
| **`--edge`** (Nuevo) | `#747b9c` | borde de campos, botón secundario, casillas | 4,15 blanco · 3,76 `--ground` · 3,48 `--sunken` (≥ 3:1) |
| `--danger` | `#a3263a` | excedido, quitar | 7,25 blanco · 6,57 `--ground` · 6,07 `--sunken` · 5,91 `--danger-tint` |
| `--danger-tint` | `#f8e3e6` | fondo de error | — |
| `--ok` | `#24614a` | comprado | 7,28 blanco · 6,60 `--ground` · 6,10 `--sunken` · 6,16 `--ok-tint` |
| `--ok-tint` | `#dff0e7` | — | — |
| `--focus` | `#2f62d6` | anillo de foco 3 px | 4,96 sobre `--ground` |

Sabores (sin cambios; tinta sobre su papel): limón 6,53 · canela 6,02 · menta 6,13 · fresa 6,02 · violeta 7,04 · almendra 7,03 · cielo 6,53. Asignación de la demo (ya en `seed.ts`): Alberto cielo, Javier menta, Samira fresa, Marta violeta, Papá canela.

#### Color (oscuro)

Se conserva el bloque `prefers-color-scheme: dark`. Añadir:

| Token | Hex | Contraste |
|---|---|---|
| `--bar` | `#dcbd6e` | 8,29 sobre `--sunken` `#1d2541` |
| `--edge` | `#7d87b0` | 4,72 sobre `--surface` `#161d36` · 5,29 sobre `--ground` |
| `--ink-3` | `#9198b6` (sin cambio) | 5,84 `--surface` · 5,29 `--sunken` |

Comprobados también: `--ink` 13,98 · `--ink-2` 8,94 · `--foil-ink` 9,89 · `--danger` 6,97 · `--ok` 9,62 sobre `--surface`; `--danger` 6,32 sobre `--sunken`; sabores oscuros entre 6,50 y 8,29.

#### Tipografía

Familias sin cambio: **Bodoni Moda Variable** (`--f-display`) y **Atkinson Hyperlegible Next Variable** (`--f-ui`).

**Regla nueva:** Bodoni solo en titulares de **≥ 22 px** (nombre de persona, título de pantalla, cuenta atrás, total de «Mis compras», nombre del amigo invisible). **Todo el dinero va en Atkinson 700 con `tabular-nums`**. `.price` deja de usar `--f-display`.

| Token | rem / px | Altura de línea | Peso | Uso |
|---|---|---|---|---|
| `--t-xs` | 0,8125 / 13 | 1,3 | 700 | solo etiquetas en mayúsculas del precinto. Nunca texto corrido. |
| `--t-sm` | 0,9375 / 15 | 1,4 | 400 / 700 | metadatos, línea de estado, cifras de la barra |
| `--t-md` | 1,0625 / 17 | 1,5 (cuerpo) · 1,3 (título de regalo) | 400 / 700 | cuerpo, título de regalo, botones, precio |
| `--t-lg` | 1,25 / 20 | 1,3 | 700 | precio en ficha, botón `lg` |
| **`--t-name`** (Nuevo) | 1,375 / 22 | 1,15 | Bodoni 500 | nombre en tarjeta de miembro |
| `--t-xl` | 1,625 / 26 | 1,15 | Bodoni 500 | títulos de sección y de hoja |
| `--t-2xl` | 2,125 / 34 | 1,1 | Bodoni 500 | título de cabecera |
| `--t-3xl` | 2,875 / 46 | 1 | Bodoni 500 | cuenta atrás, total, amigo invisible |

Mínimo de texto legible: 15 px. `letter-spacing`: −0,01em en ≥ 34 px; 0,08em solo en el precinto.

#### Espaciado, radios, sombras

- Espacio: escala actual `--s-1…--s-12` (4, 8, 12, 16, 20, 24, 32, 40, 48). Sin valores sueltos.
- Relleno de tarjeta: 16 (miembro), 12 (regalo). Separación entre tarjetas: 12 en móvil, 24 en escritorio. Entre secciones: 32.
- Radios: `--r-sm` 8 (miniatura, campo pequeño) · `--r-md` 12 (botón, campo, aviso) · `--r-lg` 16 (tarjeta, hoja 20 arriba). Píldora (999) solo en barra, chip y avatar.
- Sombras: `--shadow-1` (tarjeta disponible) y `--shadow-2` (hoja, aviso, hover en escritorio). Sin cambio. Las tarjetas «ya cogidas» no llevan sombra: `border: 1px solid var(--line)` y fondo `transparent`.
- Objetivo táctil: `--touch` 44. **Cambia** `--btn-h-sm` 40 → **44** y se elimina el truco `.btn-sm::after`.
- Retícula: **Cambia** `--max` 1120 → **1128**. **Nuevo** `--col: 360px`.

### C.3 Retícula y pantallas

#### Móvil (390 × 844)

```
┌──────────────────────────────────────┐
│ ←  Navidad                     43    │  cabecera azul, alto = contenido (88–104)
│    Navidad en familia         días   │
├──────────────────────────────────────┤  margen 16
│ ┌──────────────────────────────────┐ │
│ │ (A) Tu lista            [+ Añadir]│ │  tarjeta propia, 128
│ │     4 regalos                     │ │
│ │ ⦸ Tu presupuesto y tus reservas   │ │
│ │   son sorpresa                    │ │
│ └──────────────────────────────────┘ │  separación 12
│ ┌──────────────────────────────────┐ │
│ │ (M) Marta                        › │ │  tarjeta de miembro, 128
│ │     6 regalos · 4 libres          │ │
│ │ 124,90 € de 200,00 €  Quedan 75,10 € │
│ │ ████████████░░░░░░░               │ │
│ └──────────────────────────────────┘ │
│  … Javier · Papá · Samira       │
├──────────────────────────────────────┤
│  Grupo     Mis compras   Amigo inv.  │  barra inferior 64
└──────────────────────────────────────┘
```

- Orden: **mi tarjeta primero**, luego el resto por nombre (`localeCompare('es')`), como ahora.
- 5 tarjetas × 128 + 4 × 12 = 688 px: la familia entera en una pantalla.
- «Invitar» sale de la primera línea: va como `IconButton` (`UserPlus`, `onBox`) en la cabecera azul, solo para admin.
- Se elimina la línea «5 personas · 18 regalos en 6 listas».

Lista de Marta (vista por Alberto):

```
┌──────────────────────────────────────┐
│ ←  Navidad en familia                │
│    (M) Marta                          │
├──────────────────────────────────────┤
│ Presupuesto para Marta      [Cambiar] │  BudgetPanel
│ 124,90 € de 200,00 €                 │
│ ████████████░░░░░░░                  │
│ Quedan 75,10 € · 2 de 6 regalos cogidos │
│ ⦸ Marta no ve esto                    │
│                                      │
│ Disponibles · 4                      │
│ ┌──────────────────────────────────┐ │
│ │ ▓▓▓▓  Marco digital de fotos      │ │  GiftCard 148
│ │ ▓▓▓▓  129,00 € · Amazon           │ │
│ │ ▓▓▓▓  Me encantaría               │ │
│ │ ◌ Libre               [ Reservar ]│ │
│ └──────────────────────────────────┘ │
│ …                                    │
│ Ya cogidos · 2                       │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ │ ▓▓▓▓  Chal de lana merino         │ │  plano, sin sombra, 120
│ │ ▓▓▓▓  49,00 € · Lanas Norte       │ │
│ │ ⊖ Lo reserva Samira               │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└──────────────────────────────────────┘
```

Mi lista (Alberto): sin `BudgetPanel`. En su lugar una sola línea `VisibilityNote` y debajo los regalos en filas de 96 px sin pie de estado. Barra de acción fija sobre la barra inferior: **[+ Añadir regalo]** (`primary`, `wide`, 48 px); «Importar Excel» pasa a `ghost sm` al final de la lista.

#### Tableta (720–959)

Barra inferior. Tarjetas de miembro y de regalo a 2 columnas (`repeat(2, 1fr)`, separación 16).

#### Escritorio (1440 × 900)

```
┌────────┬───────────────────────────────────────────────────────────────┐
│ Lazo   │ ←  Navidad · Navidad en familia                       43 días │
│        ├───────────────────────────────────────────────────────────────┤
│ Grupo  │  24 px                                                         │
│ Mis c. │  ┌─ 360 ─────┐ 24 ┌─ 360 ─────┐ 24 ┌─ 360 ─────┐                │
│ Amigo  │  │ Tu lista  │    │ Javier│    │ Marta      │                │
│        │  └───────────┘    └───────────┘    └───────────┘                │
│ 264 px │  ┌───────────┐    ┌───────────┐                                 │
│        │  │ Papá      │    │ Samira    │                                 │
│        │  └───────────┘    └───────────┘                                 │
└────────┴───────────────────────────────────────────────────────────────┘
```

Lienzo: 1440 − 264 = 1176; relleno lateral 24 → **1128** = 3 × 360 + 2 × 24. Rejilla: `grid-template-columns: repeat(auto-fill, var(--col)); gap: 24px`.

Lista en escritorio (≥ 1200): **dos paneles**.

```
│        │  ┌─ 360 ──────────┐ 24 ┌─ 744 ─────────────────────────────┐   │
│        │  │ (A) Tu lista    │    │ Presupuesto para Marta   [Cambiar] │   │
│        │  │ (J) Javier │    │ 124,90 € de 200,00 € ██████░░░    │   │
│        │  │▌(M) Marta       ▐│    │ ⦸ Marta no ve esto                 │   │
│        │  │ (P) Papá        │    │ Disponibles · 4                   │   │
│        │  │ (S) Samira      │    │ ┌─ 360 ────┐ 24 ┌─ 360 ────┐      │   │
│        │  └─────────────────┘    │ │ regalo   │    │ regalo   │      │   │
│        │   pegajoso, top 24      │ └──────────┘    └──────────┘      │   │
```

- Panel izquierdo: las mismas `MemberCard` en variante `compact` (72 px: avatar 40, nombre, barra de 6 px sin cifras; las cifras ya están a la derecha). La activa lleva `aria-current="true"`, fondo `--surface` y sombra; el resto, planas.
- Entre 960 y 1199: sin panel izquierdo; regalos a 2 columnas.
- La barra «Demo» ocupa las dos columnas de la cáscara (`grid-column: 1 / -1`).
- `:hover` en escritorio: tarjetas `--shadow-1` → `--shadow-2`, sin desplazamiento.

### C.4 Componentes

#### MemberCard (`src/ui/MemberCard.tsx`, nuevo)

```ts
interface MemberCardProps {
  list: GiftList;
  owner?: Member;             // undefined en listas de niños
  mine: boolean;
  giftCount: number;
  freeCount: number | null;   // null si !canSee
  budget?: BudgetProgress;    // undefined si no hay presupuesto o si !canSee
  canSee: boolean;
  compact?: boolean;          // panel izquierdo de escritorio
  current?: boolean;
  onAdd?: () => void;         // solo en la mía
  onSetBudget?: () => void;   // solo si canSee y no hay presupuesto
}
```

Anatomía (móvil, 358 × 128, relleno 16, radio 16, fondo `--surface`, `--shadow-1`):

1. **Filo de papel**: `::before` de 6 px de alto arriba, `background: var(--fl)`, con los frunces actuales de `.gift-wrap` en los extremos. Es el único color de sabor de la tarjeta aparte del avatar.
2. **Fila 1** (48 px): `Avatar` 48 (nuevo tamaño `md`: 48 px, letra 22) · bloque de texto (`h2` Bodoni `--t-name`; debajo `.meta` 15 px) · a la derecha `CaretRight` 20 `--ink-3` (o el botón «Añadir» en la mía).
3. **Fila 2** (separación 12): `BudgetBar` o su sustituto.

Toda la tarjeta navega a `#/l/{id}`: el `<a>` envuelve el `h2` y se estira con `::after { position:absolute; inset:0 }`; los botones internos llevan `position: relative; z-index: 1`. Nunca un `<button>` dentro de un `<a>`.

Variantes de la fila 2:

| Caso | Contenido |
|---|---|
| Ajena con presupuesto | `BudgetBar` completo |
| Ajena sin presupuesto | «Sin presupuesto» (`.meta`) + `Button ghost sm` «Poner presupuesto» alineado a la derecha |
| **La mía** | `VisibilityNote`: «Tu presupuesto y tus reservas son sorpresa» sobre una banda `--sunken` de 44 px. Sin barra, sin cifras, sin hueco donde «iría» la barra. |
| Lista de niño | `BudgetBar` + meta «La llevan Samira y Alberto» |

Meta de la fila 1: ajena → «6 regalos · 4 libres»; todo cogido → «6 regalos · todo cogido»; vacía → «Aún no ha apuntado nada»; la mía → «4 regalos»; la mía vacía → «Tu lista está vacía».

Estados: `:active` `scale(0.985)` 160 ms; foco: anillo de 3 px `--focus` con desplazamiento 2; `current` (escritorio): fondo `--surface` con `--shadow-1` frente a las demás, planas. Sin filete lateral.

#### BudgetBar (`src/ui/BudgetBar.tsx`, nuevo)

Entrada: `BudgetProgress` de `core/budget.ts` (ya existe: `target`, `committed`, `left`, `over`, `percent`) + `currency` + `size: 'md' | 'sm'`.

```
124,90 € de 200,00 €                 Quedan 75,10 €     ← 15 px; izquierda 700 --ink, derecha 400 --ink-2
████████████████░░░░░░░░░░                               ← pista 10 px, radio 999
```

```css
.budget { display: grid; gap: 6px; }
.budget-figs { display: flex; justify-content: space-between; gap: 12px; font-size: var(--t-sm); }
.budget-figs b { font-weight: 700; color: var(--ink); }
.budget-track { height: 10px; border-radius: 999px; background: var(--sunken); overflow: hidden; }
.budget-fill { height: 100%; width: 100%; border-radius: inherit; background: var(--bar);
  transform-origin: left; transform: scaleX(var(--p)); transition: transform 400ms var(--ease-out); }
.budget[data-over] .budget-fill { background: var(--danger); }
.budget[data-over] .budget-left { color: var(--danger); font-weight: 700; }
.budget-sm .budget-track { height: 6px; }
```

- Se anima `transform: scaleX`, no `width` (sin recalcular maquetación). `--p` = `percent / 100`.
- Accesibilidad: `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax={target}`, `aria-valuenow={min(committed, target)}`, `aria-valuetext="124,90 € de 200,00 €. Quedan 75,10 €"`, `aria-label="Presupuesto para Marta"`.
- Reemplaza a `.meter` también en la ficha de «a medias» (mismo componente, mismas reglas).

Estados y texto exacto:

| Estado | Izquierda | Derecha | Barra |
|---|---|---|---|
| Nada comprometido | **0,00 € de 200,00 €** | Quedan 200,00 € | pista vacía |
| En curso | **124,90 € de 200,00 €** | Quedan 75,10 € | `--bar` al 62 % |
| Justo (left = 0) | **200,00 € de 200,00 €** | Presupuesto completo | `--bar` al 100 % |
| **Excedido** | **235,00 € de 200,00 €** | ⚠ Os pasáis 35,00 € | `--danger` al 100 % |

Excedido se comunica por tres vías: color, icono `Warning` (16 px, `weight="fill"`) y texto. Nunca solo color.

Caso límite: reservas de regalos **sin precio** no suman (así lo hace `committedOn`). Si hay alguna, bajo la barra en la lista (no en la tarjeta): «1 regalo reservado no tiene precio y no cuenta.»

#### BudgetPanel (cabecera de lista ajena)

Bloque sin tarjeta (sobre `--ground`), separación 8:

1. Fila: «Presupuesto para Marta» (`.meta`, 700) · a la derecha `Button ghost sm` «Cambiar» (o «Poner presupuesto» `secondary sm` si no hay).
2. `BudgetBar size="md"`.
3. «2 de 6 regalos cogidos» (`.meta`).
4. `VisibilityNote name="Marta"`.

Hoja «Presupuesto para Marta» (al tocar «Cambiar» / «Poner presupuesto»): un campo `inputMode="decimal"` con foco automático, etiqueta «¿Cuánto os gastáis entre todos?», ayuda «Lo ve todo el grupo menos Marta.», pie con `primary` «Guardar» y, si ya hay, `ghost` «Quitar presupuesto». Llama a `api.setBudget(listId, cents | null)`. Avisos: «Presupuesto guardado.» / «Presupuesto quitado.»

#### VisibilityNote (`src/ui/kit.tsx`, nuevo)

```tsx
<p className="vis"><EyeSlash size={18} weight="bold" aria-hidden /> Marta no ve esto</p>
```

```css
.vis { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px;
  border-radius: 999px; background: var(--foil-tint); color: var(--ink); font-size: var(--t-sm); font-weight: 700; }
```

`--ink` sobre `--foil-tint` = 13,17:1. Es **el único chip dorado** de la app: dorado claro + ojo tachado = «esto es secreto para alguien». No se usa ese fondo con ese icono para nada más.

#### GiftCard (`src/ui/Gift.tsx`, reescribir `GiftTag` → `GiftCard`)

```ts
interface GiftCardProps {
  item: Item;
  flavor: Flavor;
  status?: ItemStatus;        // undefined = mi lista (no pinta estado)
  meId: Id;
  nameOf: (id: Id) => string; // «tú» / nombre
  recipient: string;          // «Marta», para los avisos
  fresh?: boolean;            // acaba de cambiar: anima precinto y sello
  busy?: boolean;
  onOpen: () => void;         // cuerpo → ficha
  onAction?: () => void;      // botón de 1 toque
}
```

Anatomía (358 de ancho, relleno 12, radio 16):

```
┌────────────────────────────────────────────┐
│ ┌──────┐  Marco digital de fotos            │  título 17/700, 2 líneas máx.
│ │ 72×72│  129,00 € · Amazon                 │  precio 17/700 --ink · tienda 15 --ink-2
│ └──────┘  Me encantaría                     │  prioridad 1: 15/700 --foil-ink; 2 y 3 no se pintan
│ ─────────────────────────────────────────── │  filete 1 px --line
│ ◌ Libre                        [ Reservar ] │  pie 44: sello 24 + estado 15/700 · botón sm 44, min 128
└────────────────────────────────────────────┘
```

- Rejilla interna: `grid-template-columns: 72px 1fr; column-gap: 12px;` y el pie `grid-column: 1 / -1; display:flex; justify-content: space-between; align-items:center; min-height:44px; margin-top:12px; padding-top:12px; border-top:1px solid var(--line)`.
- **Miniatura** 72 × 72, radio 8: foto (`object-fit: cover`) o, sin foto, papel del sabor (`--fl`) con los frunces de `.gift-wrap`. **Sin monograma**. Cuando está cogido, el **precinto** (`.band`, 20 px de alto, sin texto a este tamaño) cruza la miniatura.
- **Precio sin decimales forzados fuera**: `formatMoney` tal cual. Sin precio → «Sin precio» en `--ink-3`.
- **Zona de toque**: el cuerpo (miniatura + textos) es un `<button class="gift-open">` que abre la ficha; el botón de acción es hermano, no hijo. Dos objetivos, ambos ≥ 44 px, separados por el filete.
- Alturas: 148 con pie; 96 sin pie (mi lista). Dentro de una misma sección todas miden lo mismo (título reservado a 2 líneas con `min-height: 2.6em`).

**Tres pesos de tarjeta** (`data-tone`):

| `data-tone` | Cuándo | Fondo | Borde / sombra |
|---|---|---|---|
| `open` | libre, a medias, cubierto sin comprar | `--surface` | `--shadow-1` |
| `mine` | lo he reservado/comprado yo o aporto | `--foil-tint` | sin sombra |
| `taken` | lo tiene otro | `transparent` | `1px solid var(--line)` |

**Estados** (quien mira: Alberto; lista de Marta). El sello (`Seal`, 24 px en la fila) acompaña siempre al texto.

| Estado | Sello | Línea de estado | Botón del pie (1 toque) | `data-tone` |
|---|---|---|---|---|
| Libre | trazo punteado | **Libre** | `primary` **Reservar** | `open` |
| Libre, varias unidades | trazo punteado | **Quedan 2 de 3** | `primary` **Reservar 1** | `open` |
| Reservado por mí | raya dorada | **Lo reservas tú** | `secondary` **Ya lo compré** | `mine` |
| Reservado por otro | raya dorada | **Lo reserva Samira** | — | `taken` |
| Comprado por mí | lleno ✓ | **Lo compraste tú** | — | `mine` |
| Comprado por otro | lleno ✓ | **Lo compró Papá** | — | `taken` |
| A medias, no participo | arco al % | **A medias · 63 % · ponen Samira y Papá** | `secondary` **Poner dinero** | `open` |
| A medias, participo | arco al % | **A medias · 63 % · ponéis Samira y tú** | `secondary` **Cambiar mi parte** | `mine` |
| Cubierto, participo | lleno ✓ | **Cubierto · ponéis Samira, Papá y tú** | `secondary` **Ya lo compré** | `mine` |
| Cubierto, no participo | lleno ✓ | **Cubierto · ponen Samira y Papá** | — | `taken` |
| Mi lista (sin estado) | — | — (sin pie) | — | `open`, 96 px |

Reglas de redacción del estado:
- Siempre **sujeto + verbo**: «Lo reserva…», «Lo compró…», «ponen…». Nunca solo «Reservado».
- Yo soy «tú», y voy el último en las enumeraciones: «Samira y tú».
- Más de 3 personas: «ponen Samira, Papá y 2 más».
- Color del texto de estado: `--ink` siempre (el color no codifica el estado; lo hace la frase y el sello). «Me encantaría» es lo único dorado de la tarjeta.

**Acción de 1 toque — comportamiento**

1. Toque en **Reservar** → `api.claim(item.id, 'reserved')`. **Optimista**: la tarjeta cambia al instante a «Lo reservas tú», entra el precinto, el botón pasa a «Ya lo compré» y la barra de presupuesto crece.
2. Aviso (toast) 6 s: **«Reservado. Marta no lo verá.»** con botón **Deshacer** (→ `releaseClaim`). Sin diálogo de confirmación.
3. Si la API falla: se revierte la tarjeta y aviso de error «No se ha podido reservar. Inténtalo otra vez.» Si otro se adelantó: «Samira lo acaba de reservar.» y la tarjeta pasa a `taken`.
4. La tarjeta **no cambia de sección** hasta la siguiente carga: no se mueve nada bajo el dedo.
5. **Ya lo compré** → `setClaimStatus(id, 'bought')`; aviso «Apuntado como comprado.» + Deshacer.
6. **Poner dinero / Cambiar mi parte** → abre la ficha con el campo «¿Cuánto pones?» enfocado (no es 1 toque: hay que escribir una cifra).
7. Mientras `busy`: el botón muestra el spinner existente (`aria-busy`) y el resto de botones de la lista siguen activos.

El aviso (`ToastProvider`) necesita aceptar una acción: `toast(text, { action?: { label: string; run: () => void } })`. Duración 6 s con acción, 3 s sin ella. `role="status"`.

**Secciones de la lista ajena**: «Disponibles · N» (libre y a medias sin cubrir; orden: prioridad, luego título) y «Ya cogidos · N» (el resto; primero lo mío). Cabeceras: Bodoni `--t-xl`. Si no queda nada disponible: «Todo cogido. Marta va servida.» Si la lista está vacía: «Marta aún no ha apuntado nada.»

#### Ficha de regalo (`ItemSheet`, ajustar)

- Imagen: 2:1 solo si hay foto. **Sin foto no se pinta el bloque de color**.
- Orden: precio (Atkinson 700, 20 px) + tienda + talla/color → notas → «Ver en la tienda» (`secondary`, `wide`) → bloque de estado → `VisibilityNote`.
- Bloque de estado: sello 44 + frase de estado (la misma de la tarjeta) + `BudgetBar` reutilizado para «a medias» («350,00 € de 549,00 €» / «Faltan 199,00 €») + filas de aportaciones.
- Pie fijo, **siempre presente** en lista ajena, dos botones a partes iguales (`ButtonGroup align="stretch"`):

| Situación | Izquierda (principal) | Derecha |
|---|---|---|
| Libre | `primary` Reservar | `secondary` Poner a medias |
| Lo reservo yo | `primary` Ya lo compré | `secondary` Soltar |
| Lo compré yo | `secondary` Deshacer compra | — |
| A medias, no participo | `primary` Poner dinero | — |
| A medias, participo | `primary` Cambiar mi parte | `danger` Quitar mi parte |
| Lo tiene otro | (sin pie) | |
| Mi lista | `secondary` Editar | `danger` Quitar |

- «Quitar» pide confirmación **dentro de la hoja** (el pie cambia a «¿Quitar este regalo de tu lista?» + `danger` «Sí, quitar» + `secondary` «No»), no con `confirm()`.

#### Añadir por enlace en 2 toques (`ItemForm` → `AddGift` para alta; `ItemForm` queda para editar)

**Toque 1:** «Añadir regalo» (barra fija de mi lista) o «Añadir» (mi tarjeta en el grupo). Abre la hoja «Añadir a tu lista».
**Toque 2:** «Pegar enlace». Lee el portapapeles, rellena y **guarda sin más pasos**.

Hoja en reposo:

```
Añadir a tu lista                                   ✕
┌───────────────────────────────────────────────────┐
│  [ 🔗  Pegar enlace ]                              │  primary, lg (56), wide
│  Copia el enlace en Amazon o en cualquier tienda   │  15 px --ink-2
│  y pégalo aquí.                                    │
│  ───────────────  o  ───────────────               │
│  [ Escribirlo a mano ]   [ Importar Excel ]        │  secondary · ghost, misma altura 48
└───────────────────────────────────────────────────┘
```

Lógica (orden estricto):

1. **Al tocar «Pegar enlace»**: `navigator.clipboard.readText()` dentro del gestor del clic (gesto del usuario). Se extrae la primera URL con `/https?:\/\/\S+/i` (Amazon comparte «Mira esto… https://amzn.eu/…»: se toma solo la URL).
2. **Hay URL** → estado «Leyendo la tienda…» (el botón entra en `loading`; `aria-busy`) → `api.unfurl(url)`.
   - **Con título** → `api.saveItem(listId, { title, url, priceCents, store, image, priority: 2, quantity: 1 })` **inmediato** → la hoja pasa a «Añadido»:
     ```
     ✓ Añadido a tu lista
     [foto 72]  Auriculares inalámbricos con cancelación…
                89,99 € · Amazon
     ¿Cuántas ganas?   [Me encantaría] [Me gustaría] [Si sobra]   ← cambia y guarda al tocar
     [ Añadir otro ]                 [ Listo ]                    ← secondary · primary
     Más detalles (talla, color, notas)                           ← ghost: abre ItemForm en edición
     ```
   - **Sin título** (la tienda no publica datos) → mismo formulario con la URL ya puesta y el foco en «Regalo»: «No hemos podido leer la tienda. ¿Qué regalo es?» + `primary` «Añadir a mi lista». Es el único caso con un tercer paso.
3. **No hay URL en el portapapeles** → aparece el campo con foco y el mensaje «No hay ningún enlace copiado. Pégalo aquí.»
4. **El navegador no deja leer** (permiso denegado, API ausente) → mismo campo con foco y el texto «Mantén pulsado y elige Pegar.»
5. **Evento `paste`** en ese campo o **en cualquier punto de la hoja** (`onPaste` en el `dialog`; en escritorio, Ctrl/Cmd + V sin enfocar nada): si el texto contiene una URL, se ejecuta el paso 2 sin más toques. No hay botón «Rellenar».
6. **Pegado automático al abrir** (solo si no cuesta nada al usuario): si `navigator.permissions.query({ name: 'clipboard-read' })` devuelve `granted` y el portapapeles contiene una URL, el botón cambia a **«Pegar amazon.es/…»** (dominio visible, truncado). Nunca se guarda sin que el usuario toque; nunca se dispara el permiso del navegador al abrir.
7. Duplicado (misma URL ya en mi lista): no se guarda; «Ya lo tienes en tu lista.»
8. Aviso tras guardar: «Añadido a tu lista.» + Deshacer (→ `deleteItem`).

Además (P2, barato y muy natural en Android): declarar `share_target` en `manifest.webmanifest` para que «Compartir → Lazo» desde la app de Amazon abra `#/compartir?url=…` y ejecute el paso 2.

«Escribirlo a mano» abre el formulario corto: **Regalo** (obligatorio), **Precio**, **¿Cuántas ganas?**; «Más detalles» despliega enlace, tienda, talla, color, cantidad y notas. El segmentado usa textos de una línea a 390 px: «Me encantaría» · «Me gustaría» · «Si sobra» con `font-size: var(--t-sm)` y `white-space: nowrap` (caben en 3 × 108 px).

Foco al abrir cualquier hoja: en el primer control útil (`autoFocus` en «Pegar enlace» o en el primer campo), nunca en la «✕».

#### Botones (un único sistema: `src/ui/Button.tsx`)

Se conserva el componente y su API. Cambios:

| | Antes | Ahora |
|---|---|---|
| Variantes | `primary`, `foil`, `secondary`, `ghost`, `danger`, `on-box` | **`primary`, `secondary`, `ghost`, `danger`** + `on-box` (solo sobre azul). **Se elimina `foil`**: el dorado relleno queda reservado al precinto y al sello. |
| Alturas | 40 / 48 / 56 | **44 / 48 / 56** |
| Borde `secondary` | `--line-strong` (1,95:1) | **`--edge`** (4,15:1) |
| Borde de campos | `--line-strong` | **`--edge`** |

Reglas de colocación (obligatorias):
- **Un `primary` por vista y, en listas, uno por tarjeta como máximo.**
- En tarjeta: abajo a la derecha, `size="sm"`, `min-width: 128px`. Todos los botones de una columna quedan alineados a la misma vertical.
- En hoja: en el pie, `ButtonGroup align="stretch"` (anchos iguales). Principal a la izquierda.
- Barra fija de página (mi lista): un solo `primary wide` de 48.
- Dos botones juntos tienen **siempre la misma altura** y, si están apilados, **el mismo ancho** (`wide`). Prohibido apilar botones de ancho intrínseco.
- Etiquetas: verbo en infinitivo o frase hecha en primera persona («Reservar», «Ya lo compré»), 1–3 palabras, sin puntos.

### C.5 Microcopy de la regla de visibilidad (exacto)

`{X}` = nombre del dueño de la lista, tal como aparece en el grupo.

| Dónde | Texto |
|---|---|
| Chip en presupuesto y cabecera de lista ajena | **{X} no ve esto** |
| Bajo el chip, solo la primera vez que se abre una lista ajena (se descarta al tocar; `localStorage`) | {X} ve su lista, pero no quién reserva, qué se ha comprado ni cuánto os gastáis. Los demás sí lo veis. |
| Aviso tras reservar | Reservado. {X} no lo verá. |
| Aviso tras aportar | Apuntado. {X} no lo verá. |
| Hoja de presupuesto, ayuda del campo | Lo ve todo el grupo menos {X}. |
| Mi tarjeta en el grupo | Tu presupuesto y tus reservas son sorpresa |
| Cabecera de mi lista | Tú no ves quién te regala qué. Los demás sí. |
| Mi ficha de regalo | Si alguien lo reserva, tú no lo verás. |
| Lista de niño (`{N}` = su nombre) | {N} no usa Lazo: esto lo veis todos los mayores. |
| Mis compras, subtítulo | Solo lo ves tú |
| Amigo invisible | Solo tú sabes a quién regalas. |
| Barra de demo | Demo · Ver como [Alberto ▾] — cambia de persona y mira qué deja de verse |

Se retiran: «Aquí no verás lo que te han reservado ni comprado. Ni tú ni nadie desde tu cuenta: es la gracia.» y «aquí no verás lo que te reservan».

Otros textos fijos:

| Situación | Texto |
|---|---|
| Carga de grupo / lista | Cargando… (se retira «Abriendo la caja…») |
| Soltar | Lo has soltado. Vuelve a estar libre. |
| Error genérico | Algo ha fallado. Inténtalo otra vez. |
| Sin conexión | Sin conexión. No se ha guardado. |
| Lista ajena vacía | {X} aún no ha apuntado nada. |
| Mi lista vacía | Tu lista está vacía. Pega un enlace y listo. |

### C.6 Movimiento

Curvas (ya en `:root`): `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` (entradas, respuesta), `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` (sobre del amigo invisible), `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` (hojas).

| Qué | Propiedad | Duración | Curva |
|---|---|---|---|
| Pulsar botón | `transform: scale(0.97)` | 140 ms | `--ease-out` |
| Pulsar tarjeta | `transform: scale(0.985)` | 160 ms | `--ease-out` |
| Cambio de tono de tarjeta (`open`→`mine`) | `background-color`, `box-shadow` | 200 ms | `ease` |
| **Precinto** al reservar | `clip-path: inset(0 100% 0 0)` → `inset(0)` | 280 ms | `--ease-out` |
| **Sello** al cambiar de estado | `rotate(-24deg) scale(0.86)`, opacidad 0 → reposo | 320 ms, retraso 80 ms | `--ease-out` |
| Texto de estado y botón | fundido cruzado de opacidad | 160 ms | `ease` |
| Barra de presupuesto | `transform: scaleX` | 400 ms | `--ease-out` |
| Hoja móvil | `translateY(100%)` → 0 | 320 ms | `--ease-drawer` |
| Hoja escritorio | `translateY(12px) scale(0.98)` + opacidad | 240 ms | `--ease-out` |
| Aviso (toast) | opacidad + `translateY(8px)` | 240 ms entrada / 160 ms salida | `--ease-out` |
| Sobre del amigo invisible | `clip-path` | 420 ms | `--ease-in-out` |

- Solo se animan `transform`, `opacity` y `clip-path`. Nunca `width`, `height` ni `top/left`.
- Nada se anima al cargar la página (ni entradas escalonadas de tarjetas). El movimiento responde a un toque.
- Nada de rebotes ni confeti. El precinto + el sello son **la** celebración.
- `prefers-reduced-motion: reduce`: todo pasa a fundido de 160–200 ms; la barra cambia sin transición.

### C.7 Qué conservar y qué cambiar del código

**Conservar tal cual**
- Paleta base, sabores, modo oscuro, familias tipográficas, escala de espacio, radios, sombras y curvas de `styles.css`.
- `Button.tsx` (API y estructura), `ButtonGroup`, `IconButton`.
- `Seal` (geometría del festón) y `.band` (precinto): son la firma. Añadir a `Seal` una prop `size` (24 / 44).
- `Sheet` sobre `<dialog>` nativo, `ToastProvider`, `useLoad`.
- `core/status.ts`, `core/visibility.ts`, `core/budget.ts`, `core/split.ts`: la lógica ya es la correcta. La interfaz solo debe pintarla.
- Avatar de sabor con inicial en Bodoni.
- Navegación: Grupo · Mis compras · Amigo invisible; raíl de 264 px en escritorio.

**Cambiar**

| Archivo | Cambio |
|---|---|
| `src/styles.css` `.app` | Arreglar T4: `display:flex; flex-direction:column; min-height:100dvh` y `main { flex: 1 }` en móvil; en escritorio, filas explícitas `auto auto 1fr` y `.demo-bar { grid-column: 1 / -1 }`. |
| `src/styles.css` tokens | `--ink-3: #596080`; nuevos `--edge`, `--bar`, `--t-name`, `--col`; `--btn-h-sm: 44px`; `--max: 1128px`; quitar `.btn-foil` y `.btn-sm::after`; `.price` a `--f-ui` 700; campos y `.btn-secondary` con `--edge`. |
| `src/styles.css` | Quitar `.rail`, `.person*`, `.monogram`, `.list-head`, `.secret`, `.meter`. Añadir `.member`, `.budget*`, `.vis`, `.gift[data-tone]`, `.gift-foot`, `.list-layout`. `.gifts` pasa a `grid-template-columns: 1fr` (móvil), `repeat(2, 1fr)` (≥ 720). |
| `src/ui/Gift.tsx` | `GiftTag` → `GiftCard` (fila con pie, estado en frase, botón de 1 toque). `statusWord` → `statusSentence(status, claims, meId, nameOf)`. |
| `src/ui/kit.tsx` | `Avatar` tamaño `md` (48); `Seal` con `size`; `VisibilityNote`; `toast` con acción «Deshacer». |
| `src/ui/MemberCard.tsx`, `src/ui/BudgetBar.tsx` | Nuevos. |
| `src/ui/screens/Group.tsx` | `PersonRow` + carriles → rejilla de `MemberCard`. Deja de abrir `ItemSheet`. Calcula `budgetProgress` por lista con `ListDetail.budget`. «Invitar» a la cabecera. |
| `src/ui/screens/List.tsx` | `BudgetPanel` + secciones «Disponibles» / «Ya cogidos» + acciones de 1 toque optimistas; en ≥ 1200, panel izquierdo de miembros; barra fija «Añadir regalo» en la mía. |
| `src/ui/screens/ItemSheet.tsx` | Pie siempre presente (tabla de C.4), sin bloque de color sin foto, `BudgetBar` en lugar de `.meter`, confirmación dentro de la hoja, «Cambiar mi parte». |
| `src/ui/screens/ItemForm.tsx` | Queda para editar y para «Escribirlo a mano» (3 campos + «Más detalles»). Alta por enlace en `AddGift` nuevo. Sin botón «Rellenar». |
| `src/ui/screens/Purchases.tsx` | Quitar `h2` duplicado; relleno correcto en filas; agrupar por persona; botón `secondary sm` «Ya lo compré» en cada fila reservada; total con desglose (p. ej. «Por comprar 163,95 € · Comprado 0,00 € · A medias 350,00 €»). |
| `src/ui/screens/Draw.tsx` | Quitar `h2` duplicado; sobre cerrado por defecto («Toca para ver a quién regalas»); `ButtonLink primary` «Ver la lista de {nombre}»; «Repetir el sorteo» → `danger sm`, solo admin, con confirmación en hoja. |
| `src/ui/screens/Home.tsx` | Grupos primero; «Crear grupo» `secondary` al final; con un solo grupo, redirigir a él; pestaña «Grupo» sin `aria-current` si no hay grupo abierto. |
| `src/App.tsx` | Cabecera de lista con avatar del dueño; botón «Invitar» en cabecera de grupo. |
| `public/manifest.webmanifest` | `share_target` (P2). |
| `.impeccable/surfaces/src-app-tsx.md` | Actualizar FIRST VIEWPORT: tarjetas de miembro con presupuesto en lugar de filas con carril. |
| `docs/design/v0.1/` | Regenerar capturas como `v0.2/` con la familia nueva. |

**Orden de trabajo recomendado:** (1) arreglo de `.app` y tokens → (2) `BudgetBar` + `MemberCard` + `Group` → (3) `GiftCard` + 1 toque + aviso con Deshacer → (4) `AddGift` → (5) `ItemSheet`, `Purchases`, `Draw`, `Home`.

### C.8 Comprobación de aceptación

- [ ] Como Alberto, veo 5 tarjetas; 4 con barra de presupuesto y la mía con «Tu presupuesto y tus reservas son sorpresa».
- [ ] «Ver como Marta»: la tarjeta de Marta no muestra barra ni cifras, y la petición de su lista no trae `budget`, `claims` ni `contributions`.
- [ ] Desde la lista de Marta, reservar un regalo libre es **un** toque y se puede deshacer durante 6 s.
- [ ] Cada regalo cogido dice quién lo tiene sin abrir nada.
- [ ] Con un enlace copiado: «Añadir regalo» → «Pegar enlace» = regalo guardado (2 toques).
- [ ] Presupuesto excedido: barra granate + icono + «Os pasáis 35,00 €».
- [ ] Ningún texto por debajo de 15 px salvo el precinto; ningún objetivo táctil por debajo de 44 px.
- [ ] A 390 px no hay desplazamiento horizontal en ninguna pantalla.
- [ ] Todos los botones de una misma fila o columna comparten altura y, apilados, ancho.

---

## D) Reglas «anti-IA» para Lazo

Qué **no** hacer. Si algo de esta lista aparece en un PR, se devuelve.

1. **Nada de degradados** de fondo, de texto ni en botones. Los únicos degradados permitidos son los frunces de 18 px del papel de seda.
2. **Nada de morado-azul eléctrico, neón ni «glow»**. El único azul es `#1b2545` (y su hover); el único acento, el dorado.
3. **Nada de vidrio esmerilado** (`backdrop-filter`), ni tarjetas translúcidas sobre color.
4. **Nada de emojis** como iconos ni en textos (🎁🎄✨). Iconos: solo Phosphor, peso `bold`, un tamaño por contexto (18 en texto, 20–22 en botones).
5. **Nada de filete de color en el lateral** de tarjetas o avisos (`border-left: 4px`). El estado va en la frase, el sello y el tono de fondo.
6. **Nada de tarjetas dentro de tarjetas.** Un nivel de superficie; dentro, filetes de 1 px.
7. **Nada de tres tarjetas iguales con icono-título-texto**, ni cuadrícula de «estadísticas» con número gigante y etiqueta gris. El único número grande es la cuenta atrás.
8. **Nada de grises neutros** (`#666`, `#999`, `#eee`). Todo secundario sale de `--ink-2`, `--ink-3`, `--line`, `--sunken`.
9. **Nada de sombras de colores ni sombras grandes y difusas.** Solo `--shadow-1` y `--shadow-2`.
10. **Nada de radios «pastilla» en botones ni en tarjetas.** 12 en botones, 16 en tarjetas. La píldora es solo para barra, chip y avatar.
11. **Nada de bloques de color con una letra o un icono haciendo de foto.** Si no hay imagen, papel del sabor liso, pequeño (72 px).
12. **Nada de ilustraciones genéricas** (personajes planos, formas orgánicas, regalos 3D), ni copos de nieve, ni confeti, ni brillos que parpadean.
13. **Nada de animaciones de entrada al cargar** (tarjetas que suben en cascada), ni rebotes, ni «shimmer» en esqueletos. Movimiento solo como respuesta a un toque.
14. **Nada de etiquetas en MAYÚSCULAS con interletrado** salvo la palabra del precinto. Ni «NUEVO», ni «POPULAR», ni cabeceras de sección versalitas.
15. **Nada de texto centrado** fuera de: estados vacíos, el sobre del amigo invisible y los botones.
16. **Nada de dorado relleno en botones.** El dorado relleno significa «precintado». Si un botón es dorado, la firma deja de significar algo.
17. **Nada de Bodoni por debajo de 22 px, ni en cifras de dinero, ni en botones.**
18. **Nada de microcopy de asistente**: sin «¡Genial!», «¡Listo!», «¡Ups!», sin signos de exclamación, sin «Parece que…», sin explicar metáforas («una caja por ocasión»). Frases con sujeto y verbo, en castellano de casa: «Lo reserva Samira».
19. **Nada de textos de relleno ni cifras inventadas** («Más de 10 000 familias»). La demo se etiqueta «Demo · datos ficticios».
20. **Nada de dos botones primarios juntos, ni botones apilados de anchos distintos, ni un botón más alto que su vecino.** Un sistema: 4 variantes, 3 alturas.
21. **Nada de estados solo por color o solo por icono.** Cada estado lleva su frase.
22. **Nada de diálogos nativos** (`alert`, `confirm`) ni de ventanas modales para confirmar lo reversible: se hace y se ofrece «Deshacer».
23. **Nada de carruseles horizontales** de contenido principal. Si no cabe, baja.
24. **Nada de modo «todo es una insignia»**: una sola etiqueta por tarjeta («Me encantaría»), un solo chip especial en la app («{X} no ve esto»).
