# Lazo v0.5 · Revisión de UX

Revisado contra «El catálogo de juguetes» (`DESIGN.md` y `docs/design/v0.4/FABLE-DIRECCION.md`): las nueve capturas de `docs/design/v0.5/` (estados, readme y oscuro) y el código de `Avisos.tsx`, `core/avisos.ts`, `Draw.tsx`, `Import.tsx`, `AddGift.tsx`, `ItemForm.tsx` y los bloques `v05-*` de `src/styles.css`. Importar y el formulario de añadir se han revisado solo por código: no hay captura y no se ha ejecutado nada.

## Veredicto: apto

Lo nuevo habla el idioma del sistema: hoja nativa, tique con línea de puntos, paquete en abeto con cinta dorada, avisos con frase y sujeto. Los arreglos 1 a 3 deberían entrar antes de publicar; son pequeños y afectan justo a la claridad para mayores.

## Lo que está bien

- **La campana no estorba.** Mide 44 × 44 junto a los ajustes, con 8 px de separación; la marca conserva su sitio a 375 y 390 px y en 1280 queda a la derecha de las pestañas. El contador (22 px, 14 px en 800, terracota con aro) se lee en claro y en oscuro y no pisa el engranaje.
- **Los avisos son frases con sujeto** («Han hecho el sorteo», «Te toca poner 28,75 € en la hucha») y el vacío explica qué saldrá ahí.
- **El sorteo abierto tiene jerarquía:** nombre en `--t-display`, un único primario («Ver la lista de Alberto») y el aviso de privacidad justo encima de «Copiar» y «Taparlo». Tapar es inmediato (150 ms); repetir el sorteo pide confirmación con el botón renombrado.
- **El texto del fallback de añadir** es llano y con salida: dice qué ha pasado, que el enlace está guardado y qué falta.

## Arreglos, por importancia

### 1. El paquete cerrado no enseña «Abrir» en la primera pantalla

En `readme/sorteo-390.png` y `oscuro/sorteo-375.png` la tapa mide unos 510 px y el texto va pegado abajo: «Te ha tocado…» se ve, pero «Abrir · mira que nadie te esté mirando» queda detrás de la barra inferior. Una persona mayor ve una caja verde sin nada que parezca pulsable.

- **Archivo:** `src/styles.css`, bloque `v05-sorteo`, selector `.envelope .cover`.
  - `place-content: start center;` (ahora `end center`).
  - `padding: var(--s-8) var(--s-5) var(--s-5);` (ahora `var(--s-5) var(--s-5) var(--s-8)`).
- **Archivo:** `src/ui/screens/Draw.tsx`, componente `Package`, línea 135. Partir el texto en dos:
  - `<span className="cover-cta">Abrir el paquete</span>`
  - `<span>Mira que nadie te esté mirando</span>`
- **Archivo:** `src/styles.css`, regla nueva (la especificidad tiene que ganar a la de la línea 566):
  - `.envelope .cover > span.cover-cta:not(.ribbon):not(.cover-bow) { display: inline-grid; place-items: center; min-height: 48px; padding: 0 var(--s-5); background: var(--tarjeta); color: var(--tinta); font-weight: 800; }`
  - Es el mismo recurso que ya usa «Añadir» en la tarjeta «Tu lista» (`.member[data-mine] .btn-primary`).

### 2. Los avisos desaparecen al cerrar la hoja

`close()` marca todo como visto y vacía la lista, también cuando se pulsa un solo aviso o se cierra sin querer. Si se toca «Han hecho el sorteo», «Te toca poner 28,75 €» se pierde y al volver a la campana sale «Estás al día».

- **Archivo:** `src/ui/Avisos.tsx`, componente `Avisos`.
  - Estado nuevo: `const [read, setRead] = useState(false);`
  - En el efecto, en lugar de `setState({ now, list: notices(prev, now) })`:
    ```tsx
    const fresh = notices(prev, now);
    setState((s) => ({ now, list: fresh.length ? fresh : s?.list ?? [] }));
    if (fresh.length) setRead(false);
    ```
  - Contador: `const n = read ? 0 : state?.list.length ?? 0;`
  - `close()`: `if (state) seenFacts.set(me, state.now); setRead(true); setShown(null);` (sin vaciar `list`).
  - Cuando `read` es cierto, la lista lleva `aria-label="Avisos ya vistos"`.
- Resultado: el contador se apaga al cerrar, pero los últimos avisos siguen en la hoja hasta que lleguen otros o se recargue la app.

### 3. La tabla de mapeo de Importar no cabe en el móvil

Tres columnas con un `select` de 10 rem como mínimo y cabeceras de fila en `nowrap` (lo heredan de `table.preview th`): a 390 px quedan 350 px útiles y la tabla hace scroll horizontal, con el único control, el desplegable, fuera de la vista.

- **Archivo:** `src/ui/screens/Import.tsx`, tabla `.map-table`.
  - Quitar la columna «Ejemplo» (su `<th scope="col">` y su `<td>`).
  - Meter el ejemplo dentro de la cabecera de fila: `<th scope="row">{name}<span className="meta map-example">{example(rows, i)}</span></th>`.
- **Archivo:** `src/styles.css`, bloque `v05-importar`.
  - `table.map-table th[scope='row'] { background: none; font-weight: 700; white-space: normal; }`
  - `.map-example { display: block; font-weight: 500; overflow-wrap: anywhere; }`
  - `table.map-table .select { min-width: 9rem; }`
- **Coherencia, en el mismo archivo:** «Así quedarán los primeros» es un título de sección en Nunito de 16 px. Cambiar `className="map-title"` por `className="h-section"` con `style={{ fontSize: 'var(--t-3)' }}`, como hace `DrawSetup`, y borrar la regla `.map-title`.

### 4. Importar promete que nada sale del dispositivo, y la IA sí envía una muestra

El primer paso dice «el archivo no se sube a ningún sitio». El botón «Que la IA lo ordene» envía las cabeceras y tres filas, y la interfaz no lo cuenta.

- **Archivo:** `src/ui/screens/Import.tsx`, justo debajo del botón «Que la IA lo ordene»:
  - `<p className="meta">Envía a la IA solo los títulos de las columnas y 3 filas de ejemplo.</p>`

### 5. Las filas de avisos no parecen pulsables

Son enlaces sin subrayado, sin flecha y de 44 px: se leen como un texto.

- **Archivo:** `src/ui/Avisos.tsx`, dentro del `<a>`, después de los dos `span`:
  - `<CaretRight size={20} weight="bold" aria-hidden />` (de `@phosphor-icons/react`).
- **Archivo:** `src/styles.css`, bloque `v05-avisos`.
  - `.avisos a { display: grid; grid-template-columns: 1fr auto; align-items: center; column-gap: var(--s-3); row-gap: 2px; min-height: 56px; padding: var(--s-3) 0; }`
  - `.avisos a > span { grid-column: 1; }`
  - `.avisos a > svg { grid-column: 2; grid-row: 1 / span 2; color: var(--tinta-2); }`

### 6. El nombre revelado sale dentro de un recuadro

En `estados/sorteo-abierto-390.png`, «Alberto» lleva el contorno de foco de 3 px en abeto y parece un botón o un campo. El foco programático en un texto que no es un control no necesita contorno.

- **Archivo:** `src/styles.css`, bloque `v05-sorteo`.
  - Borrar la línea `.envelope .who:focus-visible { outline: 3px solid var(--abeto); outline-offset: 4px; }` y dejar solo `.envelope .who:focus { outline: none; }`.

### 7. El fallback de añadir abre nueve campos de golpe

Cuando la tienda no deja ver los datos, `ItemForm` abre «Más detalles» porque llega `initialUrl`: enlace, tienda, cantidad, talla, color y notas, cuando el aviso pide solo el nombre y, si acaso, el precio.

- **Archivo:** `src/ui/screens/ItemForm.tsx`, `<details className="more">`:
  - `open={!!item}` (ahora `open={!!item || !!initialUrl}`).
- **Archivo:** `src/ui/screens/AddGift.tsx`, función `fromUrl`, texto de `hint`, con el nombre de la tienda para que se sepa qué enlace se ha guardado:
  - `` `${new URL(url).hostname.replace(/^www\./, '')} no nos deja ver los datos del regalo. Hemos guardado el enlace: escribe qué es y, si quieres, el precio.` ``

### 8. La línea de la fecha parte con el punto al principio

En `oscuro/grupo-375.png` se lee «24 de diciembre» y debajo «· faltan 42 días».

- **Archivo:** `src/App.tsx`, `<p className="when">`, línea 95. Sacar el punto del `span.nw`:
  - `{fecha(t.date!)} · <span className="nw">{d > 1 ? (<>faltan <b>{d}</b> días</>) : d === 1 ? 'es mañana' : 'es hoy'}</span>`

## Pendiente de ver

- Importar y el fallback de añadir no tienen captura: conviene sacarlas a 390 px en claro y en oscuro después de los arreglos 3 y 7.
- «Enviármelo» abre la hoja de compartir del sistema, donde el grupo de la familia suele salir el primero. El aviso está bien puesto; habría que probarlo con una persona mayor antes de darlo por bueno.

## Resumen

Apto. La v0.5 respeta el sistema y la campana no estorba en el móvil. Tres arreglos deberían entrar antes de publicar: el paquete cerrado esconde «Abrir» detrás de la barra inferior; los avisos se borran todos al cerrar la hoja, aunque solo se haya leído uno; y la tabla de mapeo de Importar no cabe a 390 px. Después: avisar de que la IA recibe una muestra de la hoja, dar aspecto pulsable a las filas de avisos, quitar el recuadro de foco del nombre revelado, dejar «Más detalles» cerrado en el fallback de añadir y corregir el salto de la fecha. Importar y añadir se han revisado solo por código.
