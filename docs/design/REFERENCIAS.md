# Lazo · Referencias reales y ajuste de «La bandeja»

Fecha: 2026-11-11. Ámbito: lectura de las capturas de `docs/design/referencias/` y de Lazo `docs/design/v0.2/` (móvil y escritorio). Este documento no cambia código: propone cambios a `DESIGN.md`.

**Límites de la evidencia (léase antes):**

- Las referencias son **portadas de marketing**, no la app por dentro. De ninguna tenemos la pantalla de lista real. Lo que se extrae es disciplina (tipografía, peso, foto, bordes), no patrones de lista.
- **Giftster no sirve**: las dos capturas son la página de bloqueo de Cloudflare («Sorry, you have been blocked»). No se analiza. Hay que recapturarla a mano con sesión iniciada.
- **Elfster está tapado** por el aviso de cookies y un velo gris: los colores se leen desaturados. Lo que se dice de su paleta es aproximado a la baja.
- Hex, tamaños y familias de las referencias son **estimaciones a ojo** sobre captura. Las familias son «aparentes», no comprobadas en el CSS.
- Los contrastes de los tokens de Lazo sí están calculados (WCAG 2.x) sobre los hex exactos.
- Las microinteracciones de las referencias se **intuyen** de una imagen fija; ninguna está observada.

---

## 1. Referencias

### 1.1 Zola (registro de boda) — la más útil

| Aspecto | Lo que se ve |
|---|---|
| Paleta | Blanco `#ffffff` de fondo; negro casi puro `#0e0e0e` para texto y botón; granate `#76123f` solo en la franja de oferta; filetes `#d6d6d6`; un único toque aguamarina `#5fe0d6` en la pegatina «Zero-fee». Ningún gris teñido, ningún degradado. |
| Tipografía | Sans geométrica (aparenta Circular) en 15–16 px para navegación y cuerpo, peso regular. Titular ~40 px en escritorio y ~30 px en móvil, **mezclando** la sans ligera con dos palabras en una serif gruesa de contraste medio («wedding registry»). Solo son negrita los botones y el enlace. |
| Espaciado y densidad | Mucho aire vertical (titular–lista–botón con 24–32 px), pero navegación densa: 11 categorías en una línea. Márgenes de 40 px en escritorio y 24 px en móvil. |
| Radios | Botones en píldora completa (56 px de alto). Foto con radio ~16. Nada más lleva radio: las secciones son rectángulos. |
| Sombras y bordes | **Cero sombras.** Las secciones se separan con filetes de 1 px a sangre. El botón secundario es un contorno negro de 1 px. |
| Iconografía | Tres iconos de trazo fino (lupa, carrito, flechas de menú). Ningún icono decorativo junto a los textos. |
| Foto | Fotografía real, de calle, con una caja de cartón de verdad y la cinta de la marca. Encima, trozos de interfaz (píldora con una URL, fila de logos de tiendas) y una pegatina circular con texto en curva, **girada y saliéndose del marco**. |
| Microinteracción intuida | La tira de marcas se desplaza sola; la pegatina probablemente gira. |

**Qué lo hace humano.** La foto no es de banco de imágenes pulido: hay un portal, una reja, una caja con la cinta torcida. La pegatina rompe la retícula a propósito. El titular cambia de familia a mitad de frase, como haría una maquetadora de revista. El texto promete cosas concretas («Curated by humans»), y junto al botón hay un enlace subrayado normal y corriente en vez de un segundo botón.

**Cliché del sector, a evitar.** Franja de oferta arriba, tira de logos en marcha, titular a la izquierda con foto a la derecha, botones en píldora.

### 1.2 Babylist — útil sobre todo como contraejemplo

| Aspecto | Lo que se ve |
|---|---|
| Paleta | Ciruela `#6e2f63` (botón y titulares), rosa coral `#f0567a` (corazón del logo), degradado de portada de rosa `#e77fb2` a azul `#3a8fc2`, blanco, gris de buscador `#f1f1f1`. |
| Tipografía | Sans redondeada de trazo fino, con mucho interletrado. Titular ~56 px en peso ligero, en blanco sobre el degradado. Navegación de 16 px. |
| Espaciado y densidad | Portada a pantalla completa con un solo mensaje. En móvil, texto centrado. |
| Radios | Todo en píldora: botones de 68 px, buscador, aviso de cookies. Borde inferior de la portada en arco. |
| Sombras y bordes | Sombra suave bajo la cabecera. Botón secundario con contorno blanco de 1 px. |
| Iconografía | Trazo fino. Formas geométricas sueltas (arcos, semicírculos, gotas) flotando como adorno. |
| Foto | Retrato real recortado, mirando a cámara, con cazadora vaquera. En móvil, maqueta de teléfono con la lista por categorías y **una barra fina de progreso por categoría**. |
| Microinteracción intuida | Las formas flotan; la maqueta entra al desplazar. |

**Qué lo hace humano.** Solo la persona: una cara concreta, con gesto propio.

**Cliché del sector, a evitar (casi todo lo demás).** Degradado rosa-azul, formas abstractas flotando, separador en curva, maqueta de teléfono inclinada, texto centrado, píldoras de 68 px. Es el catálogo de lo que hoy se lee como plantilla.

**Lo aprovechable.** La lista por categorías con barra fina y cifra a la derecha confirma que la barra horizontal delgada es el lenguaje que la gente ya conoce para «cuánto llevamos».

### 1.3 Elfster (amigo invisible) — útil en dos cosas

| Aspecto | Lo que se ve (bajo el velo de cookies) |
|---|---|
| Paleta | Verde azulado oscuro `#00524f` de fondo, verde `#007d79` en botones, blanco, estrellas ámbar `#e8a317`. |
| Tipografía | Titular en egipcia gruesa (aparenta Roboto Slab) ~44 px, centrado. Cuerpo en Roboto. El aviso de cookies sale en Times por defecto. |
| Radios | Botones en píldora; campos con radio ~4; aviso con radio ~4. |
| Iconografía | Dos insignias **festoneadas** de confianza («4.9 estrellas», «47 millones de personas»). |
| Foto | Foto real de adorno navideño al pie. |

**Lo aprovechable.**

1. **El formulario está en la portada**: «Ingresa Nombre 1, 2, 3» y «Continuar». La primera pantalla ya es la tarea, con nombres de persona. Es el argumento a favor de entrar eligiendo plaza («Soy Mamá») sin pantalla de bienvenida.
2. **Aviso sobre el festón.** La insignia festoneada es, en este sector, el sello de «con la confianza de millones». El sello de Lazo se parece. Solo se sostiene si sigue siendo pequeño (24 px), funcional y pegado a una frase; nunca como medalla.

**Cliché o defecto, a evitar.** Cifras de confianza, estrellas, texto centrado, mayúsculas de título a la inglesa en castellano («Regalar es Divertido y Fácil»: delata traducción automática) y un aviso de cookies sin estilo.

### 1.4 Giftster

Sin datos (página de bloqueo). No se extrae nada.

### 1.5 Godly y One Page Love (índices)

Sirven poco. Dos apuntes:

- **One Page Love**: fondo de papel cálido `#ece8e4` con grano visible, texto pardo casi negro `#2a2422`, un solo acento coral `#d8414f`, filetes de 1 px, palabras del titular subrayadas a mano y etiquetas pequeñas en monoespaciada. Lección: una superficie con textura, filetes y un único acento.
- **Godly**: rejilla de miniaturas oscuras. La muestra es mayoritariamente neón, cromados y 3D, justo lo que Lazo prohíbe. Lo único trasladable es que la interfaz propia del índice (texto de 13–14 px, sin tarjetas, sin sombras) desaparece ante el contenido.

### 1.6 Lo que tienen en común las que se sienten hechas por personas

1. **Hay fotografía real** de una cosa o de una persona concreta. Ninguna usa un bloque de color donde iría la foto.
2. **El peso por defecto es regular.** La negrita se reserva para una o dos cosas por pantalla.
3. **Filetes antes que sombras.** Zola y One Page Love no tienen ni una sombra.
4. **Algo rompe la retícula adrede** (pegatina girada, subrayado, cambio de familia a mitad de frase).
5. **El texto es específico**: nombres, cifras reales, tiendas reales.

---

## 2. Lazo v0.2 frente a las referencias

### 2.1 Lo que ya está a la altura

- **Frases de estado con sujeto**: «Lo compró Samira», «A medias · 71 % · ponen Juan Carlos y Papá». Ninguna referencia escribe tan bien el estado. Es lo más humano de Lazo.
- **«Mamá no ve esto»**: un solo chip, con nombre propio. Concreto como el «Curated by humans» de Zola.
- **Nombres de casa** (Mamá, Papá) y tiendas verosímiles (Lanas Norte, Librería del Puerto).
- **Un solo primario por tarjeta**, siempre abajo a la derecha, con alturas iguales (`lista-de-mama.png`).
- **Tres pesos de tarjeta** (blanco con sombra, dorado claro, plano con filete): se entiende de un vistazo qué queda libre.
- **Paleta con carácter**: azul turrón y dorado, sin degradados ni neón. Mantener.
- **Dinero en cifras tabulares**, alineado a la derecha en las barras.
- **Sin emojis, sin ilustraciones, sin confeti.** Las reglas D se cumplen casi enteras.

### 2.2 Lo que todavía delata «IA»

Ordenado por lo que más canta. Medidas en px de diseño (móvil a 390).

| # | Dónde | Qué se ve | Por qué delata |
|---|---|---|---|
| 1 | GiftCard, todas las listas | **Ningún regalo tiene foto.** La miniatura de 72 px es un cuadrado lila (o azul) vacío con frunces. En `lista-propia.png` son tres cuadrados azules idénticos en columna. | Es el «bloque de color haciendo de foto» que la regla D.11 prohíbe, solo que sin letra. Todas las referencias viven de la foto del producto. |
| 2 | Todo el texto | **Casi todo va en negrita**: título, precio, «Me encantaría», estado, chip, botón, pestañas, «Presupuesto para Mamá», «Os pasáis». En `lista-de-mama.png` solo son regulares la tienda y «2 de 4 regalos cogidos». | Sin contraste de pesos no hay jerarquía. Zola usa regular para todo salvo botón y enlace. |
| 3 | Dinero | **Ceros cruzados y decimales siempre**: «428,00 € de 400,00 €», «Quedan 105,05 €». En una tarjeta de grupo hay hasta siete ceros cruzados. | El cero cruzado en masa se lee como terminal o tabla de datos, no como una nota de familia. |
| 4 | Fondo y tarjetas | **Tarjeta blanca de radio 16 con sombra difusa sobre lila claro** `#f4f3f8`, repetida en todas las pantallas. | Es la combinación por defecto de cualquier panel generado. Las referencias separan con filetes. |
| 5 | MemberCard | **Filo de color de 6 px arriba** en cada tarjeta, que además se curva con el radio. | Es el «filete de color» de la regla D.5 girado 90°. |
| 6 | Lista en escritorio, panel izquierdo | **Filete de color en el lateral** de cada miembro (`escritorio/lista-de-mama.png`). | Incumple D.5 al pie de la letra. |
| 7 | Avatares | Círculo pastel con una inicial en Bodoni, en todas partes y a 5 tamaños. | Es el avatar de relleno universal. Zola y Babylist enseñan caras. |
| 8 | Tu tarjeta (grupo) | La nota «Tu presupuesto y tus reservas son sorpresa» va en una **banda gris redondeada dentro de la tarjeta**, en negrita, partida en dos líneas con «sorpresa» sola. | Tarjeta dentro de tarjeta (D.6) y viuda. |
| 9 | Cabecera de grupo (móvil) | «Navidad / en familia» parte en dos líneas a 34 px; la flecha se alinea con la segunda línea y «43 días» con ninguna. | Tres elementos, tres líneas base distintas. |
| 10 | Hoja «Añadir a tu lista» | **Etiquetas cortadas**: «Escribirlo …» e «Importar E…». El foco sigue cayendo en la ✕ (anillo azul). | Defecto visible; era el P1 de A.6 y sigue ahí. |
| 11 | Mis compras | El sello **se sale por el borde izquierdo** de la tarjeta y el botón «Ya lo compré» **toca el borde derecho**. «Para Mamá» aparece **dos veces** como grupo. El botón lleva aquí un ✓ que en la lista no lleva. | Fuga de caja, agrupación rota e incoherencia. |
| 12 | Mis compras | Tarjeta «En total · 369,00 €» con cifra de ~32 px y desglose gris debajo. | Es la tarjeta de estadística (D.7). |
| 13 | Amigo invisible | Botón «Ver la lista de Samira» en `--box-2` sobre `--box`: **1,23:1** de contraste de contorno. Todo centrado. «Repetir el sorteo» visible y en rojo como única otra acción. El sobre sale ya abierto. | Botón casi invisible; lo destructivo, lo más llamativo. |
| 14 | Inicio | Dos losas azul marino bajo una cabecera azul marino. «Navidad» encima de «Navidad en familia». Media pantalla vacía. | Redundancia y vacío. |
| 15 | Ficha a medias | Panel gris dentro de la hoja, con el chip dentro. «Juan / Carlos» parte en dos líneas junto a la cifra. | Tres niveles de superficie; nombre partido. |
| 16 | Escritorio, grupo e inicio | Cinco tarjetas arriba y dos tercios del lienzo vacíos. | Maqueta de móvil estirada. |
| 17 | Raíl y pestañas | Icono de regalo junto a «Lazo»; cuadrícula de cuatro cuadrados para «Grupo». | Iconos por defecto de la librería. |
| 18 | Capturas de móvil a página completa | La barra inferior tapa media tarjeta de Samira en `grupo.png` y parte la lista de Mamá. | Probablemente es artefacto de la captura (barra fija). **No lo he comprobado en un teléfono**: hay que verificar que el último elemento no queda bajo la barra. |

### 2.3 Qué adoptar (disciplina, no ropa ajena)

| De | Decisión | Cómo queda en «La bandeja» |
|---|---|---|
| Zola | Regular por defecto; negrita para una cosa por bloque | Título de regalo y precio en 700; el resto en 400. En la frase de estado, solo el nombre en 700. |
| Zola, One Page Love | Filete antes que sombra | La sombra se queda **solo** en lo que se puede coger (regalo libre). Miembros y paneles pasan a filete. Refuerza «lo libre pesa». |
| Zola | Foto real, con trozos de interfaz encima | La foto del producto manda. El precinto cruza la foto (ya existe). Sin foto no hay cuadrado. |
| Zola | Un elemento que rompe la retícula | El **precinto** se inclina −4° y sobresale 4 px de la miniatura. Es la única licencia. |
| Zola | Enlace subrayado junto al botón, en vez de segundo botón | «Importar desde Excel» y «Escribirlo a mano» pasan a enlaces de texto subrayados. |
| Babylist | Barra fina con la cifra al lado | BudgetBar baja de 10 a 6 px en las tarjetas de miembro. |
| Elfster | La primera pantalla ya es la tarea, con nombres | Entrada por plaza: «¿Quién eres?». |
| Elfster (aviso) | El festón es cliché de «confianza» | El sello no crece de 24 px salvo en la ficha (44) y nunca va solo. |
| Todas | Texto específico | Las cifras redondas pierden el «,00». |

**No se adopta:** píldoras en botones, degradados, formas flotantes, tiras de logos, cifras de confianza, texto centrado, maquetas de teléfono.

**Sobre el fondo.** Se podría pasar a papel cálido como One Page Love. No lo recomiendo: crema con serif de alto contraste es hoy otro cliché generado, y el azul frío es de lo poco que distingue a Lazo. El fondo se queda.

---

## 3. Cambios propuestos a DESIGN.md

Prioridades: **P0** delata o rompe ya · **P1** sube el nivel de forma visible · **P2** pantallas nuevas y coherencia · **P3** pulido.

### 3.1 Tokens de color

No hace falta ningún color nuevo para texto. Cambia el uso y se añade un filete.

| Token | Valor | Cambio | Contraste verificado |
|---|---|---|---|
| `--line-2` (nuevo) | `#c5c9dc` | Filete de tarjetas sin sombra (miembro, panel, fila de hucha). Decorativo. | 1,65 sobre blanco: **no vale como borde de control**; para eso sigue `--edge`. |
| `--on-box` como fondo de botón | `#f3f1fa` | La variante `on-box` pasa a fondo `--on-box` con texto `--box`. Sustituye a `--box-2` sobre `--box` (1,23:1). | Texto 13,44:1. |
| `--ok` | `#24614a` | Nuevo uso: «En paz» y «Pagado» en la hucha. | 7,28 blanco · 6,60 `--ground` · 6,16 `--ok-tint`. |
| `--ink-2` | `#4a5274` | Pasa a ser el color de la frase de estado (salvo el nombre). | 7,64 blanco · 6,92 `--ground` · 6,49 `--foil-tint` · 6,39 `--sunken`. |
| `--foil-ink` | `#7c5e14` | Sin cambio; «Me encantaría» baja a peso 400. | 6,06 blanco · 5,14 `--foil-tint`. |
| `--foil-fill` | `#e6cc86` | Deja de usarse en la barra «Demo». La barra pasa a `--sunken` con texto `--ink` (12,99:1). | El dorado relleno vuelve a ser solo precinto y sello. |

El modo oscuro no cambia de valores. `on-box` en oscuro: texto `#121933` sobre `#f3f1fa`, 15,48:1.

### 3.2 Tipografía

| Token | Ahora | Propuesto | Motivo |
|---|---|---|---|
| `--t-2xl` | 34 | **28 en móvil**, 34 desde 720 | «Navidad en familia» cabe en una línea a 390. |
| `--t-3xl` | 46 | 46, **solo** para el nombre del amigo invisible | La cuenta atrás deja de ser número gigante en móvil (ver cabecera). |
| `--t-xl` | 26 | **24** | Los títulos de sección («Disponibles») pesaban más que el nombre de la persona. |
| `--t-name` | 22 | 22 | Sin cambio. |
| `--t-md` | 17 | 17 | Sin cambio. |
| `--t-sm` | 15 | 15 | Sigue siendo el mínimo. |

**Regla nueva de pesos (P1).** Peso por defecto 400. Se permite 700 en: título de regalo, precio, la cifra comprometida de la barra, el nombre propio dentro de una frase de estado, etiquetas de botón y títulos de grupo. **Como máximo dos elementos en 700 por tarjeta, sin contar el botón.** Pestañas y raíl: 600 la activa y 400 las demás.

**Regla nueva del dinero (P1).**

- Si los céntimos son cero, no se pintan: «428 € de 400 €», «Quedan 75 €», «349 €».
- Con céntimos, se pintan: «44,95 €».
- En la hucha (ajuste de cuentas) se pintan siempre los dos decimales, porque ahí importan.
- El cero cruzado: comprobar si la fuente trae un cero alternativo sin barra (`font-feature-settings`). **No lo he verificado en el archivo de la fuente.** Si no lo trae, se queda como está: Atkinson se eligió por legibilidad y la regla anterior ya quita la mayoría de los ceros.

**Nada de mayúsculas de título en castellano**: «Amigo invisible», no «Amigo Invisible» (ya se cumple; se añade como regla escrita).

### 3.3 Radios, sombras y densidad

| | Ahora | Propuesto |
|---|---|---|
| Radio de miniatura | 8 | **6** |
| Radio de botón, campo y aviso | 12 | **10** |
| Radio de tarjeta | 16 | **12** |
| Radio de hoja | 20 | **16** (solo arriba en móvil) |
| Píldora | barra, chip, avatar | Sin cambio |
| `--shadow-1` | difusa | **`0 1px 0 rgba(27,37,69,.10), 0 2px 6px rgba(27,37,69,.06)`**: corta y pegada, como papel sobre mesa |
| `--shadow-2` | hoja, aviso, hover | Sin cambio de uso |
| Quién lleva sombra | toda tarjeta disponible | **Solo GiftCard `open`** y las hojas. MemberCard, paneles y filas: `1px solid var(--line-2)`, sin sombra |

**Densidad.**

- MemberCard en móvil: de ~128 a **104 px** (avatar 40, barra de 6, sin filo). Cinco personas caben en 568 px.
- GiftCard: relleno 12, sin cambio. Sin foto baja a **~112 px** porque desaparece la columna de la miniatura.
- Separación entre tarjetas en móvil: 12 → **8**. Entre secciones: 32, sin cambio.
- Escritorio, grupo: la rejilla pasa de 3 × 360 a **dos columnas de 552** con filas más anchas, y la lista de la persona activa a la derecha desde 1200. El lienzo deja de quedar vacío.

### 3.4 Movimiento

Se conserva todo lo de DESIGN.md §7. Se añade:

| Qué | Propiedad | Duración | Curva |
|---|---|---|---|
| Precinto | entra con `clip-path` y termina con `rotate(-4deg)` | 280 ms | `--ease-out` |
| Fila de hucha al marcar «Pagado» | fundido de la cifra a `--ok` y tachado del importe | 200 ms | `ease` |
| Elegir plaza | la fila elegida cambia a `--foil-tint`; el botón del pie cambia de etiqueta con fundido cruzado | 160 ms | `ease` |
| Sobre del amigo invisible | sin cambio (420 ms), pero **cerrado por defecto** | | |

Sigue prohibido animar al cargar.

### 3.5 Componentes

#### P0

1. **GiftCard sin foto: sin miniatura.** Si no hay imagen, la tarjeta no pinta el cuadrado: el título ocupa todo el ancho. El papel de sabor con frunces deja de existir como sustituto de foto. El precinto, sin foto, pasa a ser una banda de 4 px en el borde superior de la tarjeta, de lado a lado, dorada o azul.
2. **Datos de la demo con fotos.** Al menos 12 de los 17 regalos de `seed.ts` con foto real de producto, propia o con licencia, guardada en el repositorio. Sin esto, ninguna captura dejará de parecer una maqueta.
3. **Hoja «Añadir»: etiquetas enteras.** «Escribirlo a mano» e «Importar desde Excel» pasan a **enlaces de texto subrayados**, uno por línea, alineados a la izquierda, bajo el botón «Pegar enlace». Desaparece el separador «— o —». El foco inicial va a «Pegar enlace».
4. **Mis compras.** Relleno de 16 px en las filas (ni el sello ni el botón tocan el borde). Un solo grupo por persona. El botón «Ya lo compré» sin icono, igual que en la lista.
5. **Cabecera de grupo en móvil.** Título a 28 px en una línea. La cuenta atrás baja a una segunda línea de 15 px en `--foil`: «Faltan 43 días». La flecha y el botón de invitar se alinean con la línea base del título. En escritorio se mantiene el «43» grande a la derecha.
6. **Panel de miembros en escritorio: sin filete lateral.** La persona activa se marca con fondo `--surface` y filete `--line-2`; las demás, sin fondo.
7. **Botón `on-box`** con fondo claro (13,44:1), para «Ver la lista de Samira».
8. **Comprobar en un teléfono** que la barra inferior no tapa el último elemento (`padding-bottom` del contenido ≥ alto de la barra + 16).

#### P1

9. **MemberCard.**
   - Se quita el filo de 6 px. El sabor vive solo en el avatar.
   - Avatar de 40 px. **Admite foto**; la inicial queda como reserva.
   - Fila 1: nombre en Bodoni 22 y, debajo, meta en 15/400.
   - Fila 2: BudgetBar de 6 px con «124,95 € de 200 €» (solo la primera cifra en 700) y «Quedan 75 €» en 400.
   - La tuya: una línea de texto sin fondo, en `--ink-2` 15/400, con el ojo tachado delante: **«Lo que te regalan es sorpresa»** (una línea a 390). Sin banda gris.
   - Borde `--line-2`, sin sombra.
10. **GiftCard.**
    - Título 17/700 y precio 17/700; tienda 15/400; «Me encantaría» 15/400 en `--foil-ink`.
    - Frase de estado en 15/400 `--ink-2` con el nombre en 700 `--ink`: «Lo compró **Samira**».
    - Precinto inclinado −4°, sobresaliendo 4 px de la foto.
    - Sombra nueva solo en `open`.
11. **BudgetBar.**
    - 6 px en tarjetas, 10 px en la cabecera de lista y en la ficha.
    - Excedido: la barra en `--danger` y la frase «Os pasáis 28 €» en `--danger` 700 con icono. Es el único texto rojo de la pantalla.
    - «Presupuesto para Mamá» en 15/400; «Cambiar» como enlace subrayado, no como texto en negrita suelto.
12. **Botones.** Radio 10. Tres alturas, sin cambio. Se añade la variante de **enlace** (texto subrayado, 44 px de zona táctil) para acciones terciarias. El icono dentro del botón solo se usa en «Añadir» y «Pegar enlace».
13. **Hojas.** Radio 16. Un solo nivel de superficie: el bloque de estado de la ficha pierde el fondo gris y se separa con filetes. El chip «Mamá no ve esto» sale del bloque y va bajo el título. En las filas de aportación, el nombre no parte: `white-space: nowrap` y, si no cabe, la cifra baja a la segunda línea.
14. **Avisos (toast).** Fondo `--box`, texto `--on-box` en 400, «Deshacer» subrayado en `--foil`. Radio 10. Abajo, sobre la barra de pestañas, alineado a la izquierda en escritorio.
15. **Mis compras: sin tarjeta de total.** La suma pasa a una frase bajo el título: «Te quedan por comprar **219 €**. A medias llevas puestos 150 €.» Las filas, agrupadas por persona, con filete.
16. **Amigo invisible.** Sobre cerrado por defecto con «Toca para ver a quién regalas». «Repetir el sorteo» solo para quien organiza, como enlace al final, con confirmación en hoja.
17. **Inicio.** Los grupos pasan a filas claras con filete (nombre en Bodoni 22, «Faltan 43 días · 5 personas» en 15). Se quita la etiqueta «Navidad» repetida. Con un solo grupo, se entra directo.

#### P2 · Entrada eligiendo plaza («Soy Mamá»)

Pantalla que se abre desde el enlace de invitación. Sin bienvenida, sin registro previo.

```
Navidad en familia                       ← 15/400 --on-box-2, cabecera azul
¿Quién eres?                             ← Bodoni 28

( ) Alberto                              ← fila de 64 px, avatar 40, nombre 17/400
(•) Mamá                                 ← elegida: fondo --foil-tint, nombre 700
( ) Papá
    Samira · ya ha entrado               ← no se puede elegir: --ink-3, sin avatar de color
    Juan Carlos · ya ha entrado

No estoy en la lista                     ← enlace subrayado

[ Soy Mamá ]                             ← primario de 56, fijo en el pie
```

- Las filas son un grupo de radio nativo: flechas, lector de pantalla y foco funcionan sin código extra.
- **El botón dice el nombre**: «Soy Mamá». Hasta que no se elige nadie, dice «Elige tu nombre» y está desactivado. Son dos toques, y el segundo obliga a leer el nombre: evita que Papá entre como Mamá y vea su sorpresa.
- Las plazas ocupadas se ven, pero no se pueden tocar. Si alguien entró en la plaza equivocada, lo arregla quien organiza.
- Tras entrar se va directo al grupo, con «Tu lista» arriba. Sin aviso de saludo.
- Bajo el botón, una línea en 15/400: «Desde aquí no verás lo que te regalan a ti.»
- Sin ilustración, sin avatar gigante, sin texto centrado.

#### P2 · Hucha común (bote y ajuste de cuentas)

Objetivo: que responda a «¿a quién le debo cuánto?» **en frases**, no en una tabla.

```
Hucha de Navidad                         ← Bodoni 28, cabecera azul
Lo ve todo el grupo. Cada uno, menos lo suyo.   ← 15/400

Te toca dar                              ← título de grupo 17/700
(P)  Dale 37,50 € a Papá                 ← frase 17/400, importe y nombre en 700
     Robot de cocina y Chal de lana      ← 15/400 --ink-2: de dónde sale
                              [ Ya se lo di ]   ← secundario de 44

Te tienen que dar
(J)  Juan Carlos te da 12,00 €
     Entradas para el fútbol
                              Esperando  ← texto, no botón: solo confirma quien paga

En paz                                   ← filas planas, sin botón
(S)  Samira y tú estáis en paz           ← --ok
```

Reglas:

- **Cada fila es una frase con dos personas y un importe.** Nunca columnas «Debe / Haber / Saldo», ni signos + y −, ni importes en verde y rojo.
- **Se calcula el mínimo de pagos** entre personas, no una fila por regalo. El detalle por regalo va en la segunda línea y, completo, al tocar la fila.
- **Un solo botón por fila y solo para quien paga**: «Ya se lo di». Un toque, con «Deshacer» 6 s. Quien cobra ve «Esperando» y, después, «Pagado».
- **Sin gráficos**: ni tarta, ni anillo, ni tarjeta de total. El total del bote se dice en una frase en la cabecera de la sección: «Entre todos habéis puesto 250 € de 349 €», con una BudgetBar de 10 px debajo, el mismo componente que el presupuesto.
- Importes siempre con dos decimales en esta pantalla, en Atkinson 700 tabular.
- Filas con filete `--line-2`, sin sombra. Las de «En paz», sin fondo.
- **Sorpresa**: lo que se ha puesto para tu regalo no entra en tu vista. Tú ves tus pagos por los regalos de los demás, y nada más. La cabecera lo dice con su frase.
- Estado vacío: «Nadie debe nada a nadie.»
- Lazo no mueve dinero: solo apunta. «Copiar importe» como enlace en el detalle, para pegarlo en la app del banco.

#### P3

- Raíl: quitar el icono de regalo junto a «Lazo»; la palabra en Bodoni basta. Pestaña «Grupo» con icono de personas en vez de cuadrícula.
- Barra «Demo» en `--sunken`, 36 px, para no competir con la cabecera.
- Grano de papel muy leve en `--ground` (una imagen de ruido de 2–3 % de opacidad, estática). Solo si no cuesta rendimiento; probar antes en un móvil modesto.
- Avatar con foto: recorte circular y borde `--line-2` de 1 px.

### 3.6 Resumen de prioridades

| Pri | Cambio |
|---|---|
| P0 | Fotos reales en la demo y GiftCard sin cuadrado cuando no hay foto |
| P0 | Hoja «Añadir»: etiquetas enteras, enlaces en vez de botones, foco en «Pegar enlace» |
| P0 | Mis compras: relleno, un grupo por persona, botón coherente |
| P0 | Cabecera de grupo en una línea (28 px) con la cuenta atrás como subtítulo |
| P0 | Quitar el filete lateral del panel de miembros; botón `on-box` legible (13,44:1) |
| P0 | Verificar en teléfono que la barra inferior no tapa contenido |
| P1 | Regla de pesos: 400 por defecto, dos negritas por tarjeta |
| P1 | Dinero sin «,00» fuera de la hucha |
| P1 | Radios 6 / 10 / 12 / 16; sombra corta solo en regalo libre; filete en lo demás |
| P1 | MemberCard sin filo, avatar 40 con foto, nota propia en una línea sin banda |
| P1 | Mis compras sin tarjeta de total; amigo invisible con sobre cerrado; inicio en filas claras |
| P2 | Entrada «¿Quién eres?» con botón «Soy Mamá» |
| P2 | Hucha común en frases, con mínimo de pagos y «Ya se lo di» |
| P2 | Escritorio: dos columnas anchas y lista a la derecha |
| P3 | Raíl sin icono, barra «Demo» discreta, grano de papel, avatar con foto perfilado |

---

## 4. Checklist «anti-IA» (15 puntos verificables en capturas)

Cada punto se comprueba mirando las capturas de `docs/design/`, sin abrir el código.

1. [ ] **Ningún cuadrado de color vacío** donde iría una foto. En cada lista de la demo, al menos dos de cada tres regalos tienen foto real.
2. [ ] **Como máximo dos textos en negrita por tarjeta**, sin contar el botón.
3. [ ] **Ningún importe redondo lleva «,00»** fuera de la hucha.
4. [ ] **Solo las tarjetas de regalo libre tienen sombra.** Miembros, paneles y filas van con filete.
5. [ ] **Ningún filete ni filo de color** en el borde de una tarjeta (ni arriba ni al lado).
6. [ ] **Ninguna superficie dentro de otra**: ni bandas grises dentro de tarjetas, ni paneles grises dentro de hojas.
7. [ ] **Ninguna etiqueta cortada con puntos suspensivos** en botones o enlaces, a 390 px.
8. [ ] **Ningún elemento toca ni cruza el borde de su tarjeta**: mínimo 12 px de relleno por los cuatro lados.
9. [ ] **Ningún título de cabecera parte en dos líneas** a 390 px, y flecha, título y acciones comparten línea base.
10. [ ] **Un solo número mayor de 28 px por pantalla** como máximo, y ninguno dentro de una tarjeta de «total».
11. [ ] **Ningún nombre de persona partido en dos líneas** («Juan / Carlos»).
12. [ ] **Texto centrado solo** en el sobre del amigo invisible y en los estados vacíos.
13. [ ] **Dorado relleno solo en el precinto y en el sello**: ni en barras de aviso ni en botones.
14. [ ] **En escritorio, el contenido ocupa al menos dos tercios del ancho del lienzo** en grupo, lista y compras.
15. [ ] **Todo estado y todo importe de la hucha se lee como frase con sujeto** («Lo compró Samira», «Dale 37,50 € a Papá»); no hay tablas con columnas de cifras ni importes en verde y rojo.
