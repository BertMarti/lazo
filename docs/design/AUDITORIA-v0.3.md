# Lazo · Auditoría de dirección de arte y UX (v0.3)

Fecha: 2026-11-11. Ámbito: las 28 capturas de `docs/design/v0.3/` (14 de móvil y 14 de escritorio), contrastadas con `DESIGN.md`, `FABLE-DIRECCION.md`, `REFERENCIAS.md` (checklist anti-IA, §4) y la spec `docs/superpowers/specs/2026-11-11-plazas-hucha-design.md` §10. No se ha tocado código.

**Límites de la evidencia**

- Las medidas salen de las capturas (móvil a 1082 px de ancho, unas 2,77 px de imagen por px de diseño). El margen de error es de ±2 px de diseño. Donde la medida decide, lo digo.
- He leído cuatro fragmentos de código solo para confirmar defectos vistos en captura: `Hucha.tsx` (líneas 56, 61, 76, 123, 143–144), `Group.tsx` (59–95) y las reglas `.btn`, `.choice`, `.banner` de `styles.css`.
- **No hay captura de cinco estados nuevos**: aviso de solicitud de entrada, pantalla «pendiente» con el código, avisos de entrega, pantalla «Lo que te regalaron» y un regalo realmente a medias. De los avisos solo puedo juzgar el texto y la estructura en `Group.tsx`, no cómo se ven.
- `regalo-a-medias.png` ya no enseña un regalo a medias: enseña la ficha de «Robot de cocina», comprado con la hucha.
- Nada se ha probado en un teléfono real ni en modo oscuro.

---

## 1. Checklist anti-IA, captura por captura

Leyenda: **sí** cumple · **NO** no cumple · **~** cumple con reparo · **—** no aplica. Móvil y escritorio se juzgan juntos; si difieren, se indica en la evidencia.

| Captura | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| grupo | — | sí | sí | sí | sí | sí | sí | sí | ~ | sí | sí | sí | sí | sí | — |
| grupo-visto-por-marta | — | sí | sí | sí | sí | sí | sí | sí | ~ | sí | sí | sí | sí | sí | — |
| lista-de-marta | NO | NO | sí | ~ | NO | sí | sí | sí | sí | sí | ~ | sí | sí | sí | sí |
| lista-propia | NO | ~ | sí | sí | sí | sí | sí | ~ | sí | sí | sí | sí | sí | sí | — |
| regalo-a-medias (ficha) | NO | sí | sí | sí | NO | sí | sí | sí | sí | sí | sí | sí | sí | — | ~ |
| anadir | NO | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | — | — |
| compras | — | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | ~ | sí |
| amigo-invisible | — | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | — | — |
| inicio | — | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | — | — |
| hucha | — | ~ | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | sí | ~ | ~ |
| hucha-tesorero | — | sí | sí | sí | sí | sí | sí | ~ | sí | sí | sí | sí | sí | ~ | NO |
| entrar | — | sí | — | sí | sí | NO | sí | sí | sí | sí | sí | sí | sí | — | — |
| ya-comprado | NO | sí | sí | ~ | NO | sí | sí | sí | sí | sí | sí | sí | sí | — | — |
| invitar | — | sí | — | sí | sí | NO | NO | sí | sí | sí | sí | sí | sí | — | — |

### Evidencia por punto

**1. Fotos reales (NO).** La mitad del punto se cumple: ya no hay ningún cuadrado de color vacío. La otra mitad, no: **ningún regalo de la demo tiene foto**. Cero de cinco en la lista de Marta, cero de tres en la propia, y la ficha de «Robot de cocina» tampoco. Era el P0 n.º 2 de REFERENCIAS §3.5 y sigue sin hacer. Hoy toda la app es texto sobre tarjetas blancas: se lee limpia, pero también como un prototipo.

**2. Dos negritas por tarjeta (NO en lista-de-marta).**
- Las tarjetas cogidas llevan tres: título, precio y el nombre del estado («Lo compró **Samira**»). Aquí chocan dos reglas mías: «máximo dos» y «en la frase de estado, solo el nombre en 700». Hay que decidir (ver P1-9).
- `lista-propia`: el chip «Tú no ves quién te regala qué. Los demás sí.» es una frase entera en 700 que ocupa casi todo el ancho.
- `hucha` (Papá): en el bloque de cabecera hay cuatro pesos 700 seguidos: «Te falta poner», «71,22 €», «52,50 €» y el chip.
- `ya-comprado`: las dos opciones del segmentado van en 700; la elegida solo se distingue por el fondo.

**3. Sin «,00» fuera de la hucha (sí).** «65 € de 150 €», «349 €», «Quedan 85 €». En la hucha, siempre dos decimales. Correcto. El cero cruzado sigue en todas partes, también en títulos («Mochila de senderismo 30 L») y en el año «2020»; quedó como verificación pendiente y no hay señal de que se haya hecho.

**4. Sombra solo en regalo libre (~).** Miembros, paneles y filas van con filete. Reparo: en `lista-de-marta`, «Pañuelo de seda estampado» está en «Ya cogidos» pero es blanco y con sombra, igual que un regalo libre. Está apuntado para la hucha por Papá: ya no se puede coger.

**5. Sin filo de color (NO).** En `lista-de-marta`, `ya-comprado` y el fondo de la ficha, las tarjetas cogidas llevan una banda superior de 4 px, azul marino («Robot de cocina», «Chal de lana merino») o dorada («Marco digital», «Pañuelo»), que se curva con el radio. **Es culpa de mi propia especificación**: en REFERENCIAS §3.5 P0-1 pedí «el precinto, sin foto, pasa a ser una banda de 4 px en el borde superior», y en el punto 5 de la checklist lo prohibí. Visto construido, gana la checklist: es el mismo filo que quité de la MemberCard.

**6. Sin superficie dentro de otra (NO en entrar e invitar).**
- `entrar`: una tarjeta blanca con filete que contiene dos filas de radio con su propio filete y, debajo, el botón. Dos cajas concéntricas.
- `invitar`: la fila de «Tía Loli» es una tarjeta con filete y radio dentro de la hoja.
- La ficha ya no tiene panel gris: corregido respecto a v0.2.

**7. Etiquetas cortadas (NO en invitar, móvil).** «Copiar en…» en el botón de la izquierda de «Enlace para todos». Además, el texto de ayuda del campo se corta en «Añadir a alguien (nomb».

**8. Nada toca el borde (sí, con dos reparos).**
- `lista-propia` móvil: «Ideas para la lista» e «Importar desde Excel» van en la misma fila y ocupan de borde a borde con unos 24 px de holgura. A 360 px de ancho, partirá.
- `hucha-tesorero`: nada toca el borde, pero las cifras de una misma columna no están alineadas (ver P1-3).

**9. Cabecera (~ en grupo).** El título cabe en una línea. Pero la flecha y el icono de invitar están centrados respecto al bloque «título + Faltan 43 días», así que quedan a media altura entre las dos líneas y no comparten línea base con el título.

**10. Un número grande (sí).** `hucha` tiene uno («71,22 €», 46 px, fuera de tarjeta). En escritorio, el «43» de la cabecera. «Samira» en el amigo invisible es un nombre.

**11. Nombres partidos (~).** Ninguno se parte. Reparo en `lista-de-marta` móvil: «Para la hucha · lo apuntó / **Papá**» deja el nombre solo en la segunda línea, apretado contra el botón «Ya comprado».

**12. Texto centrado (sí).** Solo dentro del sobre del amigo invisible y en botones.

**13. Dorado relleno (sí).** Solo sello, banda y chip claro. La pestaña activa usa `--foil` sobre azul, que es su uso previsto.

**14. Escritorio a dos tercios (~).**
- `grupo` y `lista`: ocupan todo el lienzo. Bien.
- `compras`: cumple por la letra, pero las filas miden 1128 px y el botón «Ya lo compré» queda a unos 750 px del título al que pertenece.
- `hucha`: columna de 744 px (66 %), pegada a la izquierda. La spec §10.9 la pedía centrada.
- `entrar`: tarjeta de 520 px centrada bajo un título alineado a la izquierda: dos ejes distintos en la misma pantalla.

**15. Frases con sujeto (NO en hucha-tesorero).**
- «La lleva tú (tú)»: frase rota (`Hucha.tsx:56`).
- «Papá te dio 30,00 €» aparece bajo el título «Lo que has puesto»: no es algo que haya puesto quien mira.
- `hucha` (Papá): la barra dice «52,50 € de 123,72 € · Faltan 71,22 €» y la línea siguiente pide otros 22,50 € para Samira. Las cifras se contradicen (ver P0-2).
- Ficha: «Comprado con la hucha · adelantó Samira» y, debajo, «Costó 339,90 € · de la hucha · lo pagó Samira». Dice dos veces lo mismo.
- No hay tablas, signos ni importes en verde y rojo. Eso está bien.

---

## 2. Crítica de UX de las pantallas nuevas frente a la spec §10

### 2.1 Entrar eligiendo plaza (§10.4)

Lo que está bien: el botón dice «Elige tu nombre» hasta que se elige y obliga a leer; las filas miden 56 px; la ayuda «Elige solo tu nombre. Alberto tiene que aceptarte.» es la de la spec; la línea «Navidad en familia · 24 de diciembre · lo organiza Alberto» está.

| # | Problema | Spec |
|---|---|---|
| E1 | **La cabecera dice «Bienvenida».** La spec y REFERENCIAS piden entrar sin pantalla de bienvenida: el título debe ser el nombre del grupo. Además, leído por Papá, «Bienvenida» parece dirigido a una mujer. | §10.4: «Navidad en familia» arriba |
| E2 | **Se ve la navegación completa** (Grupo, Hucha, Mis compras, Sorteo) a alguien que aún no ha entrado. Invita a tocar pestañas que no puede usar. No sé si ocurre solo en la demo; hay que comprobarlo en la ruta real de invitación. | Una pantalla, un trabajo |
| E3 | **El botón desactivado es casi ilegible**: texto blanco sobre gris azulado (`opacity: 0.45` sobre `--box`). Estimo menos de 3:1. Y ese texto es la instrucción de la pantalla. | — |
| E4 | Las filas no llevan avatar. La plaza libre tiene un avatar de contorno discontinuo en el grupo y aquí desaparece. | «Filas de radio de 56 px con avatar» |
| E5 | «No estoy en la lista» es una fila de radio idéntica a una persona. La spec pedía un enlace `ghost`. Como radio funciona, pero debe distinguirse de los nombres y la captura no enseña qué pasa al elegirla. | §10.4 |
| E6 | Tarjeta envolvente con filas con borde dentro (punto 6). | — |
| E7 | Falta «Desde aquí no verás lo que te regalan a ti.» (DESIGN §6, fila «Entrar»). | DESIGN §6 |
| E8 | No hay captura del enlace personal («Eres Marta» + «Entrar»), que es el camino principal. | §10.4 |

### 2.2 Invitar (§10.3)

Lo que está bien: el texto de entrada es el de la spec; hay enlace por plaza y enlace general; el botón por plaza queda a la derecha.

| # | Problema | Spec |
|---|---|---|
| I1 | **«Copiar en…» cortado** en móvil. | Un solo «Copiar enlace», `secondary`, ancho completo |
| I2 | **Campo y botón de la misma fila con alturas distintas**: el campo «Añadir a alguien» mide unos 48–50 px y el botón «Añadir», 44–48. Se ve en móvil y en escritorio. | Dos botones juntos, misma altura |
| I3 | Texto de ayuda cortado: «Añadir a alguien (nomb». | — |
| I4 | **La hoja hace tres trabajos**: invitar por plaza, enlace para todos y «Lista de un niño». En móvil no cabe en una pantalla. Crear la lista de un niño no es invitar. | Una pantalla, un trabajo |
| I5 | «Enviar enlace» es `primary` en cada fila. Con cuatro plazas libres habrá cuatro primarios apilados. | Un `primary` por vista |
| I6 | Logotipo de WhatsApp dentro de dos botones e icono de cara de bebé en «Crear su lista». DESIGN §5 solo permite icono en «Añadir» y «Pegar enlace». Quien no use WhatsApp no sabe qué hará el botón. | DESIGN §5 |
| I7 | «Aún no ha / entrado» parte en dos líneas porque el botón se come el ancho. | — |
| I8 | Al abrir, el foco cae en el campo «Añadir a alguien»: en móvil abre el teclado y tapa lo principal, que es enviar el enlace. | Foco en el primer control útil |
| I9 | La ✕ lleva fondo gris en esta hoja y no en las demás (probablemente un estado `hover` capturado). | — |

### 2.3 Hucha (§10.9)

Lo que está bien: una frase grande, una barra y renglones; sin tabla ni gráficos; el chip «Aquí no sale lo que se gasta en ti»; «Tu parte, persona a persona»; «Lazo no mueve dinero: solo lo apunta.»; la sección del tesorero con «Le falta…» y «Hay que devolverle…».

| # | Problema | Spec |
|---|---|---|
| H1 | **«La lleva tú (tú)»** cuando quien mira es el tesorero. | «La lleva Samira» |
| H2 | **La barra da por puesto lo que aún se debe.** Papá: su parte es 123,72 €; ha dado 30,00 € (única fila de «Lo que has puesto»); le faltan 71,22 € para Alberto y 22,50 € para Samira. La barra pinta «52,50 € de 123,72 €». En `Hucha.tsx:61`, `committed = share − advanced − d.general`, y eso incluye los 22,50 € de Samira aunque no estén pagados. | «Has puesto 60,00 € de 86,40 €» |
| H3 | **Botones apilados de distinto ancho y alto** (móvil): «Ya se lo di a Alberto» (ancho completo, 48) y, debajo, «Ya se lo di» (ancho intrínseco, 44). | Apilados, mismo ancho |
| H4 | El segundo botón no dice a quién: «Ya se lo di». | «Ya se lo di a Papá» |
| H5 | **Botones de la misma columna con anchos distintos** en «Quién te ha dado ya»: «Me lo dio» mide unos 96 px y «Se lo di», unos 84. | `min-width` común |
| H6 | **Cifras desalineadas**: en «Lo que has puesto», «65,00 €» llega al borde derecho y «30,00 €» queda unos 56 px a la izquierda porque le sigue «Quitar». | Dinero alineado a la derecha |
| H7 | «Quitar» borra un pago al instante, sin «Deshacer» (`Hucha.tsx:123`). Es dinero apuntado. | Se hace y se ofrece «Deshacer» |
| H8 | «71,22 €» aparece tres veces en 150 px: cifra grande, «Faltan 71,22 €» y, tras tocar, el importe de la hoja. | — |
| H9 | «Papá te dio» bajo «Lo que has puesto». | — |
| H10 | «La lleva Alberto» está en el cuerpo, no como subtítulo de la cabecera. | §10.9 |
| H11 | Papá ve 84,97 € por lo de Marta, Alberto ve 84,98 € y el panel de la lista dice «sale a 84,98 € por persona» a todos. Es el reparto del céntimo, pero la frase del panel no es cierta para todos. | — |
| H12 | Sin captura de: «Estás al día», «te tiene que devolver», «falta elegir quién lleva la hucha», la hoja «Ya se lo di» ni el estado vacío. | §10.9 |

### 2.4 Ya comprado (§10.7)

Lo que está bien: título, nombre del regalo, precio prerrellenado, chip «Marta no ve esto» y «Guardar» a todo el ancho. Son dos toques.

| # | Problema | Spec |
|---|---|---|
| C1 | **El foco está en el campo del precio.** En móvil abre el teclado, tapa «Guardar» y convierte los dos toques en tres o cuatro. | «sin foco (no abre teclado)»; el foco, en «Guardar» |
| C2 | **Falta «La hucha»** en «¿Quién lo pagó?». El regalo es «Para la hucha» y solo salen «Yo» y «Otra persona». Si es porque Alberto lleva la hucha, «Yo» es ambiguo: ¿con el bote o de su bolsillo? | «La hucha» si es de hucha |
| C3 | El campo dice «35,00», sin «€». | «129,00 €» |
| C4 | Las dos opciones del segmentado van en negrita. | — |
| C5 | En la ficha, Alberto ve «Deshacer compra» sobre una compra que adelantó Samira. La tabla de pies dice «Lo tiene otro: sin pie». Si se permite por ser tesorero, debería ser «Cambiar precio o quién pagó». | §10.7 y C.4 |

### 2.5 Plaza libre (§10.2)

Bien resuelta: avatar de contorno discontinuo, «Aún no ha entrado · 1 regalo», barra de presupuesto y, solo para el admin, «Invitar»; Marta ve la flecha en su lugar. Es `secondary` y la spec decía `ghost`, pero lo prefiero así: se lee como botón.

Falta comprobar, porque no hay captura: la frase «Tía Loli aún no ha entrado. Cuando entre, dejará de ver todo esto.» dentro de su lista (DESIGN §6) y la pantalla «Quién está».

### 2.6 Avisos de solicitud y de entrega (§10.5 y §10.11)

Sin captura. Juzgado solo por `Group.tsx:59–95`.

| # | Observación | Spec |
|---|---|---|
| A1 | Solicitud: «Alguien quiere entrar como **Papá** · código **4821**» y «Pregúntale el código a Papá antes de aceptar.» Coincide. «No es Papá» mejora el «No es él» de la spec porque no presupone género. | §10.5 |
| A2 | **Entrega, aviso a los demás: falta «Aún no».** Solo hay «De acuerdo». Quien no quiere abrirla no tiene dónde decirlo. | `primary` De acuerdo · `ghost` Aún no |
| A3 | Admin: dice «Ya ha pasado la fecha.» en vez de «Ya ha pasado el 24.» | §10.11 |
| A4 | El aviso lleva un `primary` y la tarjeta «Tu lista» otro («Añadir»): dos primarios en la vista. Con dos solicitudes, tres. | Un `primary` por vista |
| A5 | `.banner` usa `--r-lg` (12); DESIGN §4 dice radio 10 para avisos. | DESIGN §4 |
| A6 | Los avisos se apilan sin límite sobre las tarjetas: con dos solicitudes y la entrega, el grupo empieza por debajo del pliegue en móvil. | — |

---

## 3. Cambios concretos, por prioridad

**P0** rompe una regla visible, engaña con una cifra o impide publicar · **P1** se nota · **P2** coherencia · **P3** pulido.

### P0

| # | Componente | Cambio exacto |
|---|---|---|
| P0-1 | `Hucha.tsx:56` | Si `me.id === T`, no pintar la línea «La lleva…» (ya está el título «Llevas la hucha»). Si no, «La lleva {nombre}». Nunca «tú (tú)». |
| P0-2 | `Hucha.tsx:61`, BudgetBar | La barra debe referirse solo a lo que se da a quien lleva la hucha: `target = share − advanced − d.aparteTotal`, `committed = target − d.general`. Para Papá: «30,00 € de 101,22 €» y «Faltan 71,22 €». Añadir una prueba en `core/hucha` que compruebe que lo puesto coincide con la suma de «Lo que has puesto». |
| P0-3 | `InviteSheet`, «Enlace para todos» | Un solo botón `secondary`, `wide`, 48 px: **«Copiar enlace»**. Debajo, enlace de texto (`variant="link"`): **«Enviar por WhatsApp»**. Ninguna etiqueta con puntos suspensivos a 360 px. |
| P0-4 | `InviteSheet`, fila de añadir | Campo y botón con `height: 48px` los dos y `align-items: stretch`. Etiqueta visible «Añadir a alguien» sobre el campo y texto de ayuda **«Nombre»**. Quitar `autoFocus` del campo. |
| P0-5 | `Hucha.tsx:62–76` | El segundo pago, igual que el primero: `secondary`, `wide`, 48 px, etiqueta **«Ya se lo di a Samira»**. Mismo ancho y alto que el primario en móvil y en escritorio. |
| P0-6 | `Hucha.tsx:143–144`, `.rows .btn` | `min-width: 104px` para «Me lo dio» y «Se lo di», alineados a la derecha. |
| P0-7 | `.members` (escritorio) | Las tarjetas de una fila deben medir lo mismo: hoy «Tu lista» mide unos 115 px y «Javier», a su lado, unos 131. `.members > * { height: 100%; align-self: stretch; }` y, en la propia, `align-content: space-between`. |
| P0-8 | `Join.tsx`, cabecera | Título de cabecera: **«Navidad en familia»** (nombre del grupo). Subtítulo en `--on-box-2` 15/400: **«24 de diciembre · lo organiza Alberto»**. Se elimina «Bienvenida» y la línea gris duplicada del cuerpo. |
| P0-9 | `App.tsx`, ruta de entrada | En la pantalla de entrar no se pinta ni la barra de pestañas ni el raíl. Comprobarlo también fuera de la demo. |
| P0-10 | `.btn:disabled` | Sustituir `opacity: 0.45` por `background: var(--sunken); color: var(--ink-2); border-color: transparent; opacity: 1` (6,39:1). «Elige tu nombre» tiene que poder leerse. |
| P0-11 | `BuySheet.tsx` | Con precio: sin foco en el campo; `autoFocus` en «Guardar». Sin precio: foco en el campo y «Guardar» desactivado. Sufijo «€» dentro del campo, a la derecha. |
| P0-12 | Capturas | Añadir a `docs/design/v0.3/` y revisar antes de publicar: `solicitud`, `pendiente` (código), `entrega-aviso`, `recibido`, `entrar-enlace-personal`, `hucha-al-dia` y un regalo realmente a medias. Hoy se publicarían cinco estados que nadie ha mirado. |

### P1

| # | Componente | Cambio exacto |
|---|---|---|
| P1-1 | `seed.ts` + GiftCard | Fotos reales en al menos 12 de los regalos de la demo, guardadas en el repositorio. Miniatura de 72 px, radio 6. Es lo que más separa hoy a Lazo de una app terminada. |
| P1-2 | `.gift` (precinto sin foto) | Quitar la banda superior de 4 px. Sin foto, el estado lo dicen el sello, la frase y el tono de fondo. El precinto vuelve solo cuando hay foto, cruzándola. Corregir REFERENCIAS §3.5 P0-1 y DESIGN §5. |
| P1-3 | `.rows` en la hucha | Rejilla `1fr auto 56px` en todas las filas, con la tercera columna reservada aunque esté vacía, para que «65,00 €» y «30,00 €» terminen en la misma vertical. |
| P1-4 | `Hucha.tsx:123` | «Quitar» con aviso de 6 s: **«Pago quitado.»** + «Deshacer». |
| P1-5 | `Hucha.tsx` | «Papá te dio» sale de «Lo que has puesto» y va a la sección del tesorero, bajo el título **«Lo que te han dado»**. Quitar «Faltan 71,22 €» de la barra cuando ya está la cifra grande: dejar solo «30,00 € de 101,22 €». |
| P1-6 | `BuySheet.tsx` | Regalo de hucha: tres opciones, **«Yo» · «La hucha» · «Otra persona»**. Si quien mira lleva la hucha: **«La hucha» · «De mi bolsillo» · «Otra persona»**. Opción no elegida en peso 400. |
| P1-7 | `InviteSheet` | Sacar «Lista de un niño» de la hoja: enlace al final, **«Añadir la lista de un niño»**, que abre su propia hoja. Fila de plaza sin tarjeta, separada por filete `--line`. Botón por plaza `secondary sm` **«Enviar enlace»**, sin logotipo. «Aún no ha entrado» con `white-space: nowrap`. «Crear su lista» sin icono. |
| P1-8 | `Join.tsx` | Sin tarjeta envolvente en móvil: las filas van sobre `--ground`. Avatar de 32 px en cada fila (contorno discontinuo). «No estoy en la lista» separada 16 px de los nombres y en `--ink-2`; al elegirla, campo «Tu nombre» y botón **«Entrar como {nombre}»**. Bajo la ayuda: **«Desde aquí no verás lo que te regalan a ti.»** En escritorio, columna de 552 px alineada a la izquierda. |
| P1-9 | Regla de pesos | Decidir y escribirlo en DESIGN §4: **el precio baja a 400 en las tarjetas cogidas**, y quedan dos negritas, título y nombre del estado. En las libres, título y precio. |
| P1-10 | `.gift-foot` | `flex-wrap: wrap`; estado con `flex: 1 1 200px`; botón con `margin-left: auto`. Así «Para la hucha · lo apuntó **Papá**» cabe en una línea y el botón baja a la derecha. |
| P1-11 | GiftCard, tono | Un regalo apuntado para la hucha por otra persona va en `data-tone="taken"` (plano, con filete), no blanco con sombra. |
| P1-12 | BudgetPanel de lista | Tres cifras distintas en cuatro líneas grises (374,90 · 339,90 · 84,98 · 178). Dejar dos líneas: **«Comprado con la hucha: 339,90 € · adelantó Samira»** y **«Además, por su cuenta: 178 €»**. «Sale a… por persona» pasa a la pantalla Hucha, donde cada uno ve su cifra exacta. |
| P1-13 | Ficha de regalo | Una sola frase: **«Comprado con la hucha · adelantó Samira · costó 339,90 €»**. «Me encantaría» en `--foil-ink`, como en la tarjeta. «Deshacer compra» solo para quien la apuntó; para los demás, sin pie. |
| P1-14 | `Group.tsx:71–76` | Añadir `ghost sm` **«Aún no»** junto a «De acuerdo». |
| P1-15 | `lista-propia`, chip | «Tú no ves quién te regala qué. Los demás sí.» en 15/400 `--ink-2`, sin píldora, con el ojo delante, igual que la nota de la tarjeta propia. El chip dorado queda solo para «{X} no ve esto» y «Aquí no sale lo que se gasta en ti». |
| P1-16 | Cabecera de grupo (móvil) | Flecha e icono de invitar con `align-self: start` y la altura de línea del título, para que compartan línea con «Navidad en familia». |

### P2

| # | Componente | Cambio exacto |
|---|---|---|
| P2-1 | `Group.tsx:86` | **«Ya ha pasado el 24.»** (día de la fecha del grupo). |
| P2-2 | `.banner` | `border-radius: var(--r-md)` (10). Botones de aviso en `secondary sm`, salvo «Aceptar». Con más de un aviso, pintar el primero y una línea: **«Y 2 avisos más»**. |
| P2-3 | `lista-propia` | «Ideas para la lista» e «Importar desde Excel» apilados, uno por línea, alineados a la izquierda, como en la hoja «Añadir». |
| P2-4 | `compras` e `inicio` (escritorio) | `max-width: 744px` en las filas, para que el botón no quede a 750 px de su título. Mismo ancho que la hucha. |
| P2-5 | Hucha (escritorio) | Se queda a la izquierda, como inicio y compras. Corregir la spec §10.9, que decía «centrada». |
| P2-6 | Hucha, cabecera | «La lleva Alberto» como subtítulo de la cabecera azul (15/400 `--on-box-2`), como en «Mis compras». |
| P2-7 | Inicio | Meta de cada grupo: **«Faltan 43 días · 6 personas»**. Quitar «Navidad ·», que repite el título. |
| P2-8 | Panel de lista | «sale a 84,98 € por persona» no es cierto para quien paga 84,97 €. Si se conserva la frase: **«unos 85 € por persona»**. |
| P2-9 | `InviteSheet` | «En la demo, el enlace abre la pantalla de entrada de verdad. Pruébalo.» solo debe pintarse en la demo; comprobarlo. |

### P3

- Enlaces de texto: en las capturas de escritorio el subrayado de «Cambiar», «Quitar», «Repetir el sorteo» y «Apuntar una sorpresa» no se distingue. Fijar `text-decoration-thickness: 1.5px` y `text-decoration-color: currentColor`.
- La pestaña se llama «Sorteo» y la pantalla, «Amigo invisible». Elegir un nombre.
- ✕ de las hojas: mismo estado en reposo en todas.
- Cero cruzado: sigue sin comprobarse si la fuente trae un cero alternativo.
- Amigo invisible: capturar también el sobre cerrado.
- Modo oscuro: sin capturas en v0.3.

---

## 4. Lo que todavía «parece hecho con IA»

Por orden de lo que más canta:

1. **No hay ni una foto.** Todas las pantallas son tarjetas blancas redondeadas con texto, sobre lila claro.
2. **La banda de color en el borde superior** de las tarjetas cogidas.
3. **«Bienvenida»** como título de la primera pantalla que ve cada invitado.
4. **Logotipo de WhatsApp y cara de bebé** en botones: iconos puestos «para alegrar».
5. **Botones que no casan**: «Ya se lo di a Alberto» ancho y «Ya se lo di» estrecho; «Me lo dio» y «Se lo di» con anchos distintos; campo y botón de alturas distintas.
6. **Texto que nadie ha leído en voz alta**: «La lleva tú (tú)», «Copiar en…», «Añadir a alguien (nomb».
7. **Cifras que no cuadran entre sí** en la pantalla del dinero.
8. **Avatares de inicial** en todas partes; con foto de perfil mejoraría mucho, pero no bloquea.

Lo que ya no canta respecto a v0.2: cuadrados de color vacíos, filo de la tarjeta de miembro, filete lateral, banda gris en la tarjeta propia, cabecera en dos líneas, etiquetas cortadas en «Añadir», fuga de caja en «Mis compras», tarjeta de total, botón invisible del amigo invisible y «,00» en masa. La base está bien hecha; los fallos nuevos están casi todos en las pantallas nuevas.

---

## 5. Veredicto

**Sí, se puede publicar como v0.3 tras los P0**, con dos condiciones:

1. **P0-2 es obligatorio y no es cosmético.** Una pantalla de dinero que enseña «52,50 € puestos» cuando se han dado 30,00 € hace que la familia deje de fiarse de la hucha el primer día.
2. **P0-12 no es un trámite.** La solicitud de entrada, la pantalla del código y la entrega son las tres pantallas donde se decide quién ve qué, y no se han mirado. Si al capturarlas sale algo del nivel de «La lleva tú (tú)», es otro P0.

Sin los P0 no la publicaría: hay tres textos rotos, dos cifras que se contradicen y cuatro casos de botones descuadrados, que es justo lo que el encargo prohíbe.

Los P1 no bloquean la versión, pero **las fotos (P1-1) sí bloquean usar estas capturas en el README o en el portafolio**. Con texto solo, la app se ve correcta y anónima.

Trabajo estimado de los P0: once son cambios de una a diez líneas; el P0-2 necesita además su prueba; el P0-12 es generar y mirar siete capturas.
