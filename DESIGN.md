# DESIGN.md · Lazo

El sistema visual de Lazo, tal como está construido (`src/styles.css`). **Basado en referencias reales** de webs de listas de regalos (Zola, Babylist y Elfster, capturadas en `docs/design/referencias/`), analizadas por Fable en [docs/design/REFERENCIAS.md](docs/design/REFERENCIAS.md): de Zola se toma la disciplina editorial (filetes antes que sombras, pocas negritas) y de Elfster, la claridad de los estados. La dirección es **«La bandeja»**, una evolución de la caja de confitería navideña elegida por Fable entre tres exploraciones; el razonamiento completo está en [docs/design/FABLE-DIRECCION.md](docs/design/FABLE-DIRECCION.md). Las capturas, en `docs/design/v0.2/`.

## 1. Principios

1. **Una pantalla, un trabajo.**
   - Grupo: elegir persona.
   - Lista: elegir regalo.
   - Ficha: detalles y regalo a medias.
2. **Texto antes que símbolo.** Cada estado se lee en una frase con sujeto («Lo reserva Samira»). El sello acompaña al texto, nunca lo sustituye.
3. **Lo que X no ve, la interfaz lo dice con su nombre:** «Mamá no ve esto». Es el único chip dorado de la app.
4. **Lo libre pesa y lo cogido descansa.**
   - Blanco con sombra: disponible.
   - Plano con filete: lo tiene otra persona.
   - Dorado claro: lo tienes tú.
5. **Un toque para lo frecuente.** Reservar se hace con 1 toque y se puede deshacer. Añadir, con 2 (pegando un enlace).

## 2. Color

La cáscara es azul turrón y el fondo, papel de seda frío. Cada persona tiene su «sabor». No hay grises neutros: todo lo secundario se tiñe del azul.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--box` | `#1b2545` | `#121933` | Cabecera, raíl, botón primario |
| `--box-2` | `#27335c` | `#1e2748` | Hover y pestaña activa |
| `--on-box` / `--on-box-2` | `#f3f1fa` / `#b9c0dc` | iguales | Texto sobre azul (13,4:1 y 8,3:1) |
| `--foil` | `#dcbd6e` | igual | Dorado sobre azul (cuenta atrás, marca) |
| `--foil-fill` | `#e6cc86` | igual | **Solo** precinto y sello lleno |
| `--foil-ink` | `#7c5e14` | `#e2c579` | Texto dorado sobre claro («Me encantaría») |
| `--foil-tint` | `#f6ecd1` | `#2d2a26` | Fondo de «lo tuyo» y del chip de visibilidad |
| `--bar` | `#96741a` | `#dcbd6e` | Relleno de barras (≥ 3:1 sobre la pista) |
| `--ground` / `--surface` / `--sunken` | `#f4f3f8` / `#fff` / `#ebeaf2` | `#0d1222` / `#161d36` / `#1d2541` | Fondo, tarjetas, paneles hundidos |
| `--ink` / `--ink-2` / `--ink-3` | `#1b2242` / `#4a5274` / `#596080` | `#eceaf5` / `#b8bdd6` / `#9198b6` | Texto (todos ≥ 4,5:1 sobre sus fondos) |
| `--edge` | `#747b9c` | `#7d87b0` | Borde de campos y botón secundario (≥ 3:1) |
| `--line` | `#dddfea` | `#2a3354` | Filetes decorativos internos |
| `--line-2` | `#c5c9dc` | `#39436a` | Contorno de tarjetas sin sombra (miembro, panel, fila) |
| `--danger` / `--ok` | `#a3263a` / `#24614a` | `#f08a99` / `#8fd3b5` | Excedido o quitar / comprado |

**Sabores** (papel y tinta, ≥ 6:1):

| Sabor | Papel | Tinta |
|---|---|---|
| limón | `#f2e3a0` | `#5f4b00` |
| canela | `#ecc9a6` | `#6e3812` |
| menta | `#bfe2d2` | `#1b5640` |
| fresa | `#f3c3c8` | `#842033` |
| violeta | `#dacdee` | `#47307c` |
| almendra | `#e8dfd1` | `#574429` |
| cielo | `#c4daf0` | `#1c4877` |

Cada persona tiene un sabor fijo, que se usa en su avatar, en el filo de su tarjeta y en las miniaturas de sus regalos. Las listas de niños son canela.

## 3. Tipografía

| Token | Tamaño | Familia | Uso |
|---|---|---|---|
| `--t-3xl` | 46 | Bodoni Moda 500 | Cuenta atrás y nombre del amigo invisible |
| `--t-2xl` | 28 en móvil / 34 desde 720 | Bodoni Moda 500 | Título de la cabecera, en una línea (interletrado −0,01em) |
| `--t-xl` | 24 | Bodoni Moda 500 | Títulos de sección y de hoja |
| `--t-name` | 22 | Bodoni Moda 500 | Nombre en la tarjeta de miembro |
| `--t-lg` | 20 | Atkinson Hyperlegible Next 700 | Precio en la ficha y botón grande |
| `--t-md` | 17 | Atkinson 400/700 | Cuerpo, títulos de regalo y botones |
| `--t-sm` | 15 | Atkinson 400/700 | Metadatos, estado y cifras de la barra (**mínimo de texto**) |
| `--t-xs` | 13 | Atkinson 700 | Sin uso en texto corrido |

- **Bodoni solo a partir de 22 px.**
- **El dinero va siempre en Atkinson 700 con `tabular-nums`** (clase `.money`).
- Atkinson se eligió por legibilidad para gente mayor: distingue bien 0/O e 1/l.

## 4. Espacio, forma y retícula

- **Escala de espacio:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 (`--s-*`). No hay valores sueltos.
- **Radios:**
  - 6: miniatura;
  - 10: botón, campo y aviso;
  - 12: tarjeta;
  - 16: hoja;
  - píldora: solo barra, chip y avatar.
- **Sombras:**
  - `--shadow-1`, corta y pegada como papel sobre la mesa: **solo** el regalo libre;
  - `--shadow-2`: hojas y avisos.
  - Lo demás (tarjetas de miembro, paneles, filas, lo cogido) va con filete `--line-2`.
- **Pesos:** 400 por defecto. Como mucho dos negritas por tarjeta, sin contar el botón; en las frases de estado, solo el nombre.
- **Dinero:** sin «,00» si es redondo («349 €»), salvo en la hucha, donde se pintan siempre los céntimos.
- **Objetivo táctil mínimo:** 44 px.
- **Retícula:**

| Ancho | Márgenes | Columnas |
|---|---|---|
| Móvil | 16 px | 1 columna; separación de 12 |
| 720–959 | — | 2 columnas |
| ≥ 960 | Raíl de 264 px y lienzo de 1128 px (3 × 360 + 2 × 24), márgenes de 24 | Tarjetas de 360 |
| ≥ 1200 | — | Lista en dos paneles: miembros compactos (360) y regalos |

## 5. Componentes

| Componente | Archivo | Notas |
|---|---|---|
| **Botones** | `src/ui/Button.tsx` | **Único sistema.** Variantes `primary`, `secondary`, `ghost`, `danger` (y `on-box` sobre azul). Alturas 44 / 48 / 56. Prohibido escribir `<button className="btn…">` a mano |
| MemberCard | `src/ui/MemberCard.tsx` | Filo de sabor de 6 px, avatar de 48, nombre en Bodoni, meta («3 regalos · 2 libres») y BudgetBar. La tuya lleva «Tu presupuesto y tus reservas son sorpresa» y nunca barra |
| BudgetBar | `src/ui/BudgetBar.tsx` | «124,90 € de 200,00 €» y «Quedan 75,10 €». Si se excede, «Os pasáis 28,00 €» en granate con icono. Anima `scaleX`. `role="progressbar"` |
| GiftCard | `src/ui/Gift.tsx` | Miniatura de 72 (foto o papel de sabor), título, precio y tienda, «Me encantaría». El pie lleva sello de 24, la frase de estado y el botón de 1 toque abajo a la derecha (mínimo 128 px). `data-tone`: `open`, `mine` o `taken` |
| Seal | `src/ui/kit.tsx` | Festón de 16 lóbulos: punteado = libre; raya = reservado; arco = a medias; lleno con ✓ = comprado o cubierto |
| Precinto (`.band`) | `styles.css` | Banda dorada (o azul si está comprado) que cruza la miniatura. Entra con `clip-path` en 280 ms |
| VisibilityNote | `src/ui/kit.tsx` | Chip dorado claro con un ojo tachado. Solo para la regla |
| Sheet | `src/ui/kit.tsx` | `<dialog>` nativo: abajo en móvil, centrado en escritorio |
| Toast | `src/ui/kit.tsx` | 3 s, o 6 s con «Deshacer» (enlace dorado subrayado) |
| Plaza libre | `MemberCard` | Avatar con contorno discontinuo, «Aún no ha entrado» y, para el admin, «Invitar» |
| Elegir plaza (`.choice`) | `screens/Join.tsx` | Filas de radio de 56 px. El botón dice el nombre («Soy Mamá») para obligar a leerlo |
| Aviso (`.banner`) | `screens/Group.tsx` | Fondo `--foil-tint` para solicitudes de entrada (con código) y para la entrega |
| Ya comprado | `screens/BuySheet.tsx` | Dos toques, con el precio prerrellenado y «¿Quién lo pagó?» (Yo / La hucha / Otra persona) |
| Hucha | `screens/Hucha.tsx` | Frases, no tablas: «Te falta poner 71,22 €», «Ya se lo di a Alberto», «Tu parte, persona a persona». Sin total del bote ni gráficos |
| Variante `link` | `Button.tsx` | Texto subrayado con 44 px de zona táctil, para acciones terciarias |

Los botones son `primary`, `secondary`, `ghost`, `danger`, `link` y `on-box`, este último sobre azul, con fondo claro y 13,4:1. **No hay dorado relleno en botones.**

**Reglas de colocación de los botones**

- Un `primary` por vista y uno por tarjeta, como máximo.
- En una tarjeta, el botón va abajo a la derecha.
- En una hoja, va en el pie con `ButtonGroup align="stretch"` (anchos iguales), con el principal a la izquierda.
- Dos botones juntos tienen siempre la misma altura; si están apilados, el mismo ancho.
- Las etiquetas tienen de 1 a 3 palabras, sin punto: «Reservar», «Ya lo compré».

## 6. Microcopy de la regla

| Dónde | Texto |
|---|---|
| Lista ajena y ficha | **{X} no ve esto** |
| Tu tarjeta | Tu presupuesto y tus reservas son sorpresa |
| Tu lista | Tú no ves quién te regala qué. Los demás sí. |
| Tu ficha | Si alguien lo reserva, tú no lo verás. |
| Tras reservar o aportar | Reservado. {X} no lo verá. / Apuntado. {X} no lo verá. |
| Presupuesto | Lo ve todo el grupo menos {X}. |
| Lista de niño | {N} no usa Lazo: esto lo veis todos los mayores |
| Plaza libre | {X} aún no ha entrado. Cuando entre, dejará de ver todo esto. |
| Hucha | Aquí no sale lo que se gasta en ti |
| Sorpresa | {X} no lo verá en su lista |
| Entrar | Desde aquí no verás lo que te regalan a ti. |

Estados, siempre con sujeto y verbo: «Libre», «Lo reservas tú», «Lo reserva Samira», «Lo compró Papá», «A medias · 71 % · ponen Juan Carlos y Papá», «Cubierto · ponéis Papá y tú». Tú vas siempre al final de la enumeración y, a partir de cuatro personas, se abrevia: «Samira, Papá y 2 más».

## 7. Movimiento

- **Curvas:**
  - `--ease-out` (0.23, 1, 0.32, 1): respuesta;
  - `--ease-in-out` (0.77, 0, 0.175, 1): el sobre del amigo invisible;
  - `--ease-drawer` (0.32, 0.72, 0, 1): las hojas.
- **Duraciones:**
  - pulsar: escala 0,97 en 140 ms;
  - tarjeta: 0,985;
  - precinto: 280 ms;
  - sello: 320 ms con 80 ms de retraso;
  - barra: 400 ms;
  - hoja: 320 ms en móvil y 240 ms en escritorio.
- Solo se animan `transform`, `opacity` y `clip-path`. Nada se anima al cargar: el movimiento siempre responde a un toque.
- Con `prefers-reduced-motion`, todo pasa a fundidos de 160–200 ms.

## 8. Lo que no se hace (anti-IA)

Nada de lo siguiente:

- degradados, salvo los frunces del papel de seda;
- neón, vidrio esmerilado o emojis;
- filetes de color en el lateral;
- tarjetas dentro de tarjetas;
- rejillas de estadísticas;
- radios de píldora en botones;
- bloques de color con una letra haciendo de foto;
- ilustraciones genéricas o confeti;
- animaciones de entrada;
- versalitas, salvo en el precinto;
- dorado relleno en botones;
- Bodoni por debajo de 22 px;
- microcopy de asistente («¡Genial!»);
- `alert` o `confirm`;
- carruseles horizontales.

La lista completa, con sus 24 reglas, está en el apartado D de FABLE-DIRECCION.md.

## Modelos y su función

| Modelo | Papel en el diseño |
|---|---|
| Claude Fable 5.1 | Dirección de arte: crítica por pantalla, tres exploraciones, elección de «La bandeja», especificación y reglas anti-IA; análisis de referencias reales (REFERENCIAS.md) y diseño de las pantallas de plazas y hucha |
| Claude Opus 5.5 | Implementación, contrastes verificados en la interfaz, capturas y E2E |
| `impeccable` (skill) | Proceso: PRODUCT.md, contrato de dirección (`.impeccable/surfaces/`) y detector |
