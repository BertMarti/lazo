# Lazo 1.0 «Nochebuena» · Revisión final de UX y diseño

Revisado contra «El catálogo de juguetes» (`DESIGN.md`, `PRODUCT.md`, `docs/design/v0.4/FABLE-DIRECCION.md`) y contra mi revisión de la v0.5. En `docs/design/v0.5.1/` no hay ninguna revisión escrita.

## Veredicto: apto

No hay nada que bloquee la etiqueta. El sistema se cumple en claro y en oscuro, cada estado de regalo lleva su frase, la sorpresa no se escapa por ninguna de las salidas nuevas (papel, enlace público, copia) y no se ve genérico. Los arreglos 1 a 4 son de CSS o de una línea y convendría que entraran antes de etiquetar: tocan justo el papel de la abuela, la entrada del abuelo y un botón que se corta.

## Qué he mirado y qué no

- **Capturas abiertas:** `readme/` a 390 y 1280 (grupo, lista, mia, hucha, sorteo, unirse, ajustes, vacio, imprimir); `recorridos/` (abuelo 02 y 03, amazon 02 y 03, hucha 03 y 04); `movil/antes` y `despues`; `oscuro/` a 375 (grupo, lista, hucha, sorteo, unirse), `oscuro/ajustes-768` y `oscuro/lista-1280`; `despues/` a 768 (grupo y lista).
- **Solo por código, sin verlo pintado:** `ShareSheet`, la vista `#/ver/…`, «Ha perdido el móvil», `OfflineBand`, «Copia del grupo» y «Privacidad y legal» (de Ajustes solo se ve el principio en las capturas claras; la página entera, solo en `oscuro/ajustes-768`).
- **El papel no lo he visto.** `imprimir-390.png` e `imprimir-1280.png` son la vista previa en pantalla, no la hoja. Lo que digo del papel sale de leer el bloque `@media print` de `src/styles.css`; no hay PDF ni captura con medio de impresión.
- **Sin abrir:** el resto de `despues/` y `oscuro/` a 768 y 1280, y `compras` y `grupos`.
- `recorridos/abuelo-01-fallo.png` está en blanco; `amazon-01-fallo.png` y `hucha-01-fallo.png` tienen pinta de ser lo mismo (restos de una pasada fallida), pero no los he abierto. Conviene borrarlos antes de etiquetar.

## Lo que está bien

- **El pulido de la lista ajena funciona.** «Quedan 25,10 €» en Young Serif sustituye a cuatro líneas de cuentas, «Ver cuentas» las guarda para quien las quiera, y el aviso amarillo con «Entendido» que se partía a una palabra por línea ha pasado a ser una frase con su botón de información. El regalo único en «Disponibles» ocupa todo el ancho.
- **Sorteo:** «Abrir el paquete» ya es una píldora visible en la primera pantalla, en claro y en oscuro (arreglo 1 de la v0.5).
- **Entrada del abuelo:** una pregunta, un nombre, un botón que dice «Soy Tía Loli», y después el código en grande con «Mandar por WhatsApp» y «Si la cierras, no pasa nada». Es lo mejor del producto.
- **Hucha:** la hoja de pago trae la cantidad puesta, dice «Lazo no mueve dinero» y el resultado se confirma con una frase («Con Alberto estás al día»).
- **Nada delata.** `toShared` quita las sorpresas y lo retirado, ordena por ganas y título (no por estado) y no lleva ni ids ni reservas; papel y enlace público usan el mismo `Catalog`. La copia del grupo dice con palabras qué lleva de tu propia lista.
- **«Ha perdido el móvil»:** botón discreto, confirmación con nombre propio, `danger` solo dentro de la confirmación y, después, «Enviar enlace nuevo» en la misma fila. Bien pensado.

## El recorrido «la abuela imprime la lista del nieto»

- **¿Se llega?** Sí: «Imprimir la lista» está al pie de la lista de Javier y la pantalla siguiente tiene un único primario, «Imprimir o guardar en PDF».
- **¿Delata algo?** No. Ni estado, ni quién reserva, ni sorpresas, ni presupuesto.
- **¿Es bonita en papel?** Es correcta y sobria, pero pierde la marca y queda pequeña. Según el CSS: todo va a negro, la raya dorada pasa a negra, el texto baja a 9,5 pt (unos 12,7 px, por debajo de los 16 px que prometemos a los mayores) y, a dos columnas en A4, al texto le quedan unos 35 mm porque la columna del QR se reserva aunque el regalo no tenga enlace. Arreglo 1.
- **¿Se entiende el QR?** A medias. Va pegado a su regalo, que es lo correcto, pero la única explicación está al final de la hoja y habla de «el código». Además, el papel no dice en ningún sitio que es una lista de regalos: solo «Javier» y «Navidad». Arreglo 2.
- **En el móvil**, la marca «Lazo» sale dos veces seguidas (cabecera y catálogo) y el QR aprieta el título a tres palabras por línea. Lo primero entra en el arreglo 2; lo segundo lo dejo como está, porque la vista previa debe parecerse a la hoja.

## Arreglos, por importancia

### 1. El papel: una columna, 12 pt y la marca en su color

**Archivo:** `src/styles.css`, bloque `@media print`. Sustituir estas reglas:

```css
.masthead, .tabbar, .demo-bar, .print-bar, .toast, .offline-band { display: none !important; }
.catalog-head { border-bottom: 1.5pt solid #c9a24a; margin-bottom: 6mm; padding-bottom: 3mm; }
.catalog-occasion, .catalog-text, .catalog-prio, .catalog-price, .catalog-text h2, .catalog-foot { color: #000 !important; }
.catalog-brand { color: #9a4222 !important; }
.catalog-items { grid-template-columns: 1fr; gap: 3mm; }
.catalog-item { grid-template-columns: 26mm 1fr auto; gap: 4mm; padding: 3mm; background: #fff; border: 0.75pt solid #555; border-radius: 3mm; }
.catalog-photo { width: 26mm; background: #fff; border: 0.5pt solid #999; color: #000; }
.catalog-qr { width: 26mm; height: 26mm; }
.catalog-text { font-size: 12pt; }
.catalog-text h2 { font-size: 14pt; }
.catalog-foot { font-size: 11pt; }
```

- Qué cambia: `.offline-band` deja de imprimirse; `.catalog-brand` sale de la lista de negros y va en terracota; la raya vuelve a ser dorada (son bordes y texto, se imprimen sin activar «gráficos de fondo»); una columna con `auto` en el QR, para que el texto use el ancho cuando no hay enlace.
- Los hex van sueltos a propósito, como ya hace este bloque: en oscuro los tokens valen otra cosa.
- Caben unos 6 regalos en la primera hoja y 7 en las siguientes. No lo he visto impreso: hay que sacar un PDF de la lista de Javier y mirarlo.

### 2. Que la hoja diga qué es y cómo se usa el cuadrado

**Archivo:** `src/ui/screens/Printable.tsx`, componente `Catalog`.

- Línea 45: `<p className="catalog-occasion">Lista de regalos · {OCCASION[data.occasion] ?? OCCASION.otro}</p>`
- Línea 81: `<footer className="catalog-foot">Precios orientativos. Para ver un regalo en su tienda, apunta al cuadrado con la cámara del móvil.</footer>`

**Archivo:** `src/styles.css`, bloque `v06-imprimir`, regla nueva:

- `@media screen { .catalog-brand { display: none; } }` (en pantalla ya está la marca de la cabecera, también en `#/ver`; en papel la cabecera se oculta y queda esta).

### 3. «Sí, liberar su sitio» se corta en el móvil

Calculado, no visto: con `align="stretch"` los dos botones se reparten unos 310 px a 390 (hoja menos el relleno de `.rows`), quedan unos 105 px para una etiqueta de unos 150 y `.btn-label` la recorta con puntos suspensivos. Es el botón de una acción que cierra la sesión de otra persona.

- **Archivo:** `src/ui/screens/Invite.tsx`, línea 161: `<ButtonGroup>` (quitar `align="stretch"`). Los botones toman su ancho y, si no caben, bajan de línea.

### 4. Las opciones de «¿Quién eres?» apenas tienen borde

En `oscuro/unirse-375.png` las filas y el círculo casi no se distinguen de la tarjeta; en claro el borde también es el decorativo. Es el primer control que toca un abuelo.

- **Archivo:** `src/styles.css`, línea 292, selector `.choice`: `border: 1.5px solid var(--linea-fuerte);` (ahora `var(--linea)`).

### 5. Compartir en solo lectura: avisar antes de romper el enlace enviado

La hoja siempre se abre con «Crear el enlace», aunque ya exista uno, y crear otro invalida el que se mandó. Quien vuelve a la hoja para copiarlo otra vez se lo carga, y el aviso está debajo del botón, en 15 px.

- **Archivo:** `src/ui/screens/Printable.tsx`, componente `ShareSheet`.
  - Borrar la línea 177.
  - Dentro de la rama sin enlace, justo antes de `<Button variant="primary" wide icon={LinkSimple}…>`, y envolviendo los dos en un fragmento: `<p>Si ya enviaste un enlace, al crear otro el anterior deja de funcionar.</p>`

### 6. La fecha del grupo parte con el punto colgando

En `oscuro/grupo-375.png` y `movil/despues/grupo.png` se lee «24 de diciembre ·» y debajo «faltan 42 días». A 390 cabe por 15 px; a 375 y a 360, que es el ancho de casi todos los Android baratos, no.

- **Archivo:** `src/styles.css`, dentro del bloque `@media (max-width: 719px)` de la línea 619, o en uno nuevo:
  - `@media (max-width: 389px) { .page-head .when { font-size: var(--t-md); } }`

### 7. Texto que se lee, a 16 px: «Sin conexión» y la copia del grupo

- **Archivo:** `src/styles.css`, línea 691, `.offline-band`: cambiar `font-size: var(--t-meta)` por `font-size: var(--t-md)` y añadir `position: sticky; top: 0; z-index: 20;`. Ahora la franja se va con el scroll y, a media lista, nada dice que no hay red hasta que falla un botón.
- **Archivo:** `src/styles.css`, bloque `v10-copia`, regla nueva: `.copia .meta { font-size: var(--t-md); }`. Los dos párrafos pequeños de «Copia del grupo» son justo los que explican qué lleva la copia y qué no; no son línea secundaria.

### 8. La lista ajena dice dos veces seguidas que Marta no ve

«Marta no ve esto» (píldora) y, 40 px más abajo, «Marta no ve lo que reserváis». La segunda ya cubre el presupuesto («ni cuánto os gastáis»). Además, a 1280 el botón de información queda a mil píxeles de su frase.

- **Archivo:** `src/styles.css`, junto a la línea 614:
  - `.budget-panel:has(+ .vista) .vis { display: none; }`
  - `.vista-line .grow { flex: 0 1 auto; }`
- Se ganan unos 45 px en la primera pantalla del móvil, que hoy no enseña ningún regalo.

## Para después de la 1.0

- `ShareSheet` debería saber si ya hay un enlace y enseñarlo, y ofrecer «Enviar por WhatsApp» como hace Invitar. Pide tocar la API; no cabe en un alcance congelado.
- `.copia .btn` permite botones a dos líneas, que `DESIGN.md` prohíbe. Es razonable para «Descargar copia de {nombre largo}», pero hay que apuntarlo como excepción en `DESIGN.md`.
- Los documentos legales se abren en GitHub. Sirve, pero no es un sitio para una persona mayor.

## Resumen

Apto. Lazo 1.0 cumple el sistema en claro y en oscuro, los estados siempre llevan texto y ni el papel, ni el enlace público, ni la copia delatan nada. Antes de etiquetar convendría: pasar la hoja impresa a una columna de 12 pt con la marca en color; que diga «Lista de regalos» y explique el cuadrado; que «Sí, liberar su sitio» no se corte; y dar borde visible a las opciones de «¿Quién eres?». Después: avisar antes de rotar el enlace compartido, la fecha a 360 px, 16 px en «Sin conexión» y en la copia, y quitar el «no ve» duplicado. El papel y las pantallas sin captura los he juzgado solo por código: falta ver un PDF real.
