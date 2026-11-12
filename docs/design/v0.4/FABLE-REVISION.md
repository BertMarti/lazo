# Lazo v0.4 · Revisión final de «El catálogo de juguetes»

## Veredicto: **no apto**

La dirección está bien construida y el salto respecto a la v0.3 es real, pero hay cuatro fallos que no pueden salir (arreglos 1 a 4): la hucha rota en móvil, el modo oscuro sin borde de tarjeta, el lazo de la cinta que no se lee y la etiqueta «Sorpresa» tapada por el precio. Son cambios pequeños; con los diez hechos, es apto.

**Qué he revisado.** Las diez pantallas a 375 px y grupo, lista y mía a 1280 px en claro; grupo, lista y hucha a 375 px en oscuro; las dos capturas de antes; `styles.css`, `Gift.tsx`, `MemberCard.tsx`, `Bow.tsx` y partes de `App.tsx`, `Hucha.tsx`, `Draw.tsx` y `Join.tsx`.

**Qué no he comprobado.** Las capturas de 768 px no las he abierto. Las microinteracciones las he leído en el código, no las he visto en movimiento. Los valores que propongo salen de la geometría y del CSS; ninguno está renderizado.

---

## 1. Cumplimiento de la especificación

| Área | Estado | Nota |
|---|---|---|
| Paleta | Cumple | Los tokens coinciden hex a hex en claro y oscuro. Faltan el octavo color de persona (Berenjena `#8a3f7a`) y dos variables que `Draw.tsx` usa y ya no existen (`--foil`, `--on-box-2`). |
| Tipografía | Cumple con dos desvíos | Young Serif y Nunito empaquetadas, escala correcta. Desvíos: frases enteras a 14 px en la pastilla `.vis`, y la inicial del avatar de 28 px queda en 12 px. |
| Estados | Cumple en estructura | Una banda para reservado, cruz para comprado, etiqueta con icono y texto, línea bajo el título, sin tachado ni opacidad. Fallan el lazo de la cinta (arreglo 3) y el choque «Sorpresa»/precio en móvil (arreglo 4). |
| Microinteracciones | Cumple en código | Banda de 240 ms, lazo dibujado con `stroke-dashoffset`, confeti de 18 piezas en 900 ms una sola vez, `prefers-reduced-motion` atendido. El confeti no lleva los dos lazos pequeños; no importa. |
| Navegación | Cumple con un desvío | Barra inferior y pestañas en píldora como se pidió, sin banda de color. El enlace de volver dice «Volver» y no el destino (arreglo 10). En escritorio hay un engranaje donde iba el avatar propio; aceptable. |
| Pantallas | Tres desvíos | Sorteo (arreglo 6), unirse (arreglo 9) y la rejilla de personas en escritorio (arreglo 5). |

## 2. Legibilidad, contraste y objetivos táctiles

- Contraste de texto correcto en claro y en oscuro, salvo el «Deshacer» del aviso efímero en oscuro: 1,6:1 (arreglo 7).
- Objetivos táctiles correctos: botones de 44 a 48 px, pestañas de 60 px, opciones de 56 px, enlaces de texto con 44 px de alto.
- Lo peor para una persona mayor está en la hucha en móvil: el texto se parte palabra a palabra («Hay / que / devolverle») y la inicial del avatar mide 12 px.
- Las frases de aviso en pastilla a 14 px («Tú no ves quién te regala qué. Los demás sí.») incumplen la regla de 14 px solo para una o dos palabras.

## 3. ¿Genérico o hecho por IA?

No. La etiqueta de precio girada, la cinta en cruz y el papel crema dan un mundo propio; la portada de grupos y el tablero de la lista son reconocibles. Quedan tres restos de plantilla, ninguno bloqueante: los enlaces de texto en terracota con icono suelto («Apuntar una sorpresa», «Ideas para Mamá»), el panel de presupuesto con cuatro líneas de contabilidad seguidas y la pantalla de ajustes, que es un formulario sin más.

## 4. Composición, pantalla a pantalla

- **Grupos.** Bien. Nada que tocar.
- **Grupo.** En 1280 px, Tía Loli cae sola a una segunda fila y deja un hueco de cuatro tarjetas. En 375 px, «días» queda huérfano en la línea de la fecha. El icono del ojo en «Tu lista» se encoge hasta ser ilegible.
- **Lista.** En 375 px el precio tapa el final de «Sorpresa». El lazo de la cinta sale en terracota y se pierde sobre fotos rojas (el chal). En oscuro las tarjetas no tienen borde y «Lo llevas tú» pierde su aro.
- **Mía.** Bien. El aviso va en pastilla de 14 px en vez de aviso a 16 px.
- **Hucha.** Rota en 375 px: columnas de texto de unos 55 px, avatares de 28 px.
- **Compras.** Correcta. «Ya lo compré» sale como secundario y la especificación pedía primario; lo dejo fuera de los diez.
- **Sorteo.** Dice «Tu sobre» (metáfora de carta, descartada), no hay lazo en el cruce y las tres pastillas de texto cortan las dos bandas.
- **Unirse.** Limpia y legible, pero sin avatares: ni la fila de la familia ni el avatar en cada opción.
- **Ajustes y vacío.** Correctas.

---

## Arreglos, por orden de importancia

1. **Hucha en móvil: filas aplastadas.** En `styles.css`, dentro de `@media (max-width: 719px)`, la regla `.rows > li > .btn { margin-left: calc(72px + var(--s-3)); }` está pensada para Mis compras y se aplica también a la hucha. Cambiar el selector a `.rows > li:has(.gift-thumb) > .btn`. Añadir `.rows > li > .grow { flex: 1 1 9rem; }` para que el botón baje de línea antes de estrujar el texto. En `Hucha.tsx` (líneas 95 y 141), quitar `size="sm"` de los `Avatar` para que midan 40 px.

2. **Modo oscuro: las tarjetas pierden el borde y el aro de «Lo llevas tú».** En el bloque oscuro de `:root`, `--sombra-1: none` invalida todas las declaraciones `box-shadow: var(--sombra-1), var(--borde-tarjeta)` y `0 0 0 2px var(--abeto), var(--sombra-1)`, porque `none` no puede ir en una lista. Cambiar a `--sombra-1: 0 0 0 0 transparent;`.

3. **El lazo de la cinta no se lee.** `.bow { color: var(--terracota) }` gana a `.band-bow { color: var(--oro) }`, así que el lazo sale terracota sobre la foto. Añadir `.band-bow .bow { color: var(--tarjeta); filter: drop-shadow(0 1px 2px rgb(42 29 20 / 0.35)); }` y dejar `.band-bow { --knot-ring: var(--oro-tinta); }`. Borrar la regla muerta `.band-mine ~ .band-bow { color: var(--abeto); ... }`. Vale para banda dorada y de abeto, en claro y en oscuro.

4. **«Sorpresa» tapada por el precio en móvil.** Dentro de `@media (max-width: 719px)` añadir `.gift-photo:has(.tags-top) .price { top: 44px; }`. El precio baja bajo la etiqueta solo en las tarjetas con sorpresa.

5. **Rejilla de personas en escritorio.** En `.members`, dentro de `@media (min-width: 720px)`, cambiar `repeat(auto-fill, minmax(190px, 1fr))` por `repeat(auto-fit, minmax(170px, 1fr))`. Con 1140 px caben las seis en una fila.

6. **Sorteo: fuera el sobre, dentro el paquete.** En `Draw.tsx`, dentro de `.cover`: poner primero `<Bow size={96} />`, cambiar «Tu sobre» por «Te ha tocado…», sustituir «Toca para ver a quién regalas» por «Abrir» y cambiar el `aria-label` a «Abrir tu paquete del amigo invisible». Quitar los `style` con `var(--foil)` y `var(--on-box-2)`, que no existen. En `.envelope .cover` cambiar `place-content: center` por `align-content: end` con `padding-bottom: var(--s-8)`, y dar al lazo `position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%)`, para que el texto quede bajo el cruce y no corte las bandas. Cambiar también «aquí verás tu sobre» por «aquí verás tu paquete».

7. **«Deshacer» ilegible en oscuro.** `.toast .btn-link { color: var(--oro); }` da 1,6:1 sobre el fondo crema del aviso en oscuro. Cambiar a `color: var(--oro-suave);`: contraste alto en los dos modos.

8. **Avisos de frase entera a 16 px.** En la lista propia y en la hucha, sustituir `VisibilityNote` (`.vis`, 14 px) por `<p className="notice">` con el mismo icono, para «Tú no ves quién te regala qué. Los demás sí.» y «Aquí no sale lo que se gasta en ti». `.vis` queda solo para «Mamá no ve esto».

9. **Unirse: que los abuelos reconozcan a la familia.** En `Join.tsx`, bajo el `h1`, añadir una fila `.faces` con un `Avatar size="md"` por miembro del grupo. En cada `label.choice` de plaza (línea 104), añadir un `Avatar` de 40 px entre el radio y el nombre. En `styles.css`, `.choice { min-height: 64px; }`.

10. **Detalles de cabecera.** Tres cambios pequeños:
    - `.vis-line svg { flex: none; }`, para que el ojo de «Tu lista» no se encoja.
    - En `App.tsx` (línea 94), envolver `faltan <b>{d}</b> días` en `<span style={{ whiteSpace: 'nowrap' }}>`, para que «días» no quede huérfano.
    - En `App.tsx` (línea 83), cambiar el texto «Volver» por el nombre del destino («Navidad en familia»), y dejar «Volver» solo si no hay nombre.

---

## Verificación (Fable 5.2)

### Veredicto: **no apto**, por un solo fallo

Nueve de los diez arreglos están bien. Bloquea el sorteo en móvil: el título «Te ha tocado…» sale tapado («Te … o…») en `despues/sorteo-375.png`.

**Qué he revisado.** Las catorce capturas nuevas (seis a 375 px y dos a 1280 px en claro, tres en oscuro, tres de primera pantalla a 390 px), `styles.css`, `Draw.tsx` y las llamadas a `Avatar`, `VisibilityNote` y `backLabel` en `src`.

**Qué no he comprobado.** El aviso efímero no sale en ninguna captura; el arreglo 7 lo doy por bueno por el CSS. El sorteo solo lo he visto a 375 px y cerrado. Los dos valores que propongo abajo salen de la geometría de la captura, no de un render.

### Lo que impide publicar

En `styles.css`, línea 518, el selector `.envelope .cover > :not(.bow)` alcanza también al envoltorio `.cover-bow`, que es un `span` y no lleva la clase `.bow`. Le pone fondo abeto y relleno, y esa pastilla tapa el centro del título y corta la banda horizontal a los lados del lazo.

1. Cambiar el selector de la línea 518 a `.envelope .cover > :not(.cover-bow)`.
2. Añadir `.envelope { min-height: 380px; align-content: center; }`. Sin la pastilla, las colas del lazo aún pisarían unos 17 px del título; con 380 px de alto quedan unos 20 px libres entre lazo y título.

Con esos dos cambios y una captura nueva de `sorteo-375.png` que muestre el título entero, es apto.

### Los diez arreglos

| N.º | Arreglo | Estado | Lo que se ve |
|---|---|---|---|
| 1 | Hucha en móvil | Resuelto | Filas legibles, avatares de 40 px, el botón baja de línea. Igual en oscuro. |
| 2 | Borde en oscuro | Resuelto | Todas las tarjetas tienen borde y «Lo llevas tú» recupera su aro. |
| 3 | Lazo de la cinta | Resuelto | Lazo crema con sombra en claro, oscuro sobre la banda en oscuro; se lee sobre el chal rojo. La regla muerta ya no está. |
| 4 | «Sorpresa» y precio | Resuelto | A 375 px el precio baja bajo la etiqueta; a 1280 px no chocan. |
| 5 | Rejilla de personas | Resuelto | Las seis en una fila a 1280 px. |
| 6 | Sorteo | **Parcial, bloquea** | Lazo y textos nuevos puestos, pero el título queda tapado. Además sigue «sobre» en `Draw.tsx`, líneas 49, 68 y 148. |
| 7 | «Deshacer» en oscuro | Resuelto en código | `.toast .btn-link { color: var(--oro-suave); }`. Sin captura. |
| 8 | Avisos a 16 px | Resuelto | Lista propia y hucha usan `.notice`; «Mamá no ve esto» sigue en pastilla. |
| 9 | Unirse | Parcial, no bloquea | `.choice` mide 64 px. Faltan la fila de avatares (tarea 8, aceptada) y el avatar en cada opción. |
| 10 | Cabecera | Resuelto | El ojo no se encoge, «faltan 42 días» va junto y los enlaces de volver nombran el destino. Las tres etiquetas me valen. |

### Pendiente que no bloquea

- Cambiar «sobre» por «paquete» en las tres cadenas de `Draw.tsx` (líneas 49, 68 y 148).
- En Unirse, el avatar con la inicial en cada opción de plaza se puede pintar con el nombre que ya se muestra, sin esperar a la tarea 8, si se acepta un color neutro.
- En el grupo a 375 px, el punto medio queda colgado al final de «24 de diciembre ·».

## Cierre (Opus 5.5)

- Aplicados los dos cambios del sorteo (`.envelope .cover > :not(.cover-bow)` y `.envelope { min-height: 380px; align-content: center; }`). La captura nueva `despues/sorteo-375.png` muestra «Te ha tocado…» entero y la banda sin cortes, que era la condición para darlo por **apto**.
- Aplicado también lo que no bloqueaba:
  - Fuera la palabra «sobre» en el sorteo.
  - El punto medio va unido a «faltan N días».
  - Avatar con la inicial en cada opción de Unirse, en color neutro.
- Pruebas: 30 de 30 en e2e, tipos y lint limpios.
