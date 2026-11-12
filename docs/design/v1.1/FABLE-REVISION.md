# Revisión v1.1 «Lista de Amazon» (Fable 5.2)

2026-11-12, sobre `main` (`9697929`). La parte de seguridad está en `docs/security/AUDIT.md`, sección «Verificación v1.1 Amazon».

> Fable 5.2 entregó este texto en su informe; su configuración no le dejaba escribir fuera de `AUDIT.md`, así que lo guarda Opus 5.5 tal cual.

## Veredicto: NO APTO todavía

- **Seguridad:** apta, sin hallazgos críticos ni altos.
- **UX en el móvil:** faltan los arreglos 1 y 2 y comprobar el 3 en un Android real. Con eso hecho pasa a apto sin otra revisión completa.
- **Recomendados:** los arreglos 4 a 6.

**No revisado:** los pasos de Android e iPhone no tienen captura (las de 375 px muestran «Ordenador»), así que están juzgados por el código.

## Arreglos

1. **Bloquea. Botón principal cortado a 375 px.**
   - Dónde: `src/ui/screens/AmazonLista.tsx`, `Vista`, botón primario del pie.
   - Problema: «Añadir 7 a tu lista» se ve «Añadir 7 a tu …».
   - Cambio: la etiqueta pasa a `Añadir ${n}` (el título de la hoja ya dice dónde) y se actualizan los nombres en `e2e/amazon-lista.spec.ts`.
2. **Bloquea. Compartir un producto suelto acaba en un callejón.**
   - Problema: Lazo sale en «Compartir» para cualquier texto, y si llega el enlace de un producto responde «No encuentro productos en lo que has pegado».
   - Cambio: en `src/ui/screens/AddGift.tsx`, estado inicial con `amazon`, si `comoLista({ text })` es `null` y `firstUrl(text)` existe, se empieza en `idle` y se llama a `fromUrl(url)`.
3. **Comprobar en un Android real: «Pegar» dentro del APK.**
   - Si `navigator.clipboard.read` y `readText` fallan en el WebView, `aMano` empieza en `true` cuando `Capacitor.isNativePlatform()` (`AmazonLista.tsx`), para que el campo esté a la vista desde el principio.
4. **Pasos de Android e iPhone** (`AmazonLista.tsx`, `PASOS.android` y `PASOS.ios`):
   - Paso 1: añadir «y baja hasta el final para que carguen todos» (Amazon carga la lista por tramos).
   - Paso 2: «Mantén el dedo sobre un texto que no sea el nombre de un producto, por ejemplo una fecha» (los nombres son enlaces y abren otro menú).
   - Paso 3 de Android: añadir «o toca «Compartir» y elige Lazo».
5. **Análisis cuadrático (V-11-1).**
   - Dónde: `src/core/amazonLista.ts`, `parseListaHtml`.
   - Cambio: salir de ambos bucles con `out.length >= MAX_PRODUCTOS` y calcular el ASIN de cada enlace una sola vez.
   - Prueba: 2 MB se analizan en menos de 500 ms.
6. **Vista previa y regla de 14 px.**
   - `Vista`, línea `.meta`: añadir `${p.quantity} unidades` si es mayor que 1, y la línea «Las fotos aparecerán al añadirlos».
   - `Paso`, función `tecla`: `fontSize="13"` se pinta a unos 10 px. El SVG de teclas pasa a `width="80" height="80"` y «Ctrl» a `fontSize="14"`.

## Lo que está bien

- Si se pega solo el enlace, el aviso es claro y los pasos quedan a la vista.
- Los duplicados salen desmarcados y explicados, y nada sale hacia Amazon antes de confirmar.
- Los táctiles miden 44 px en pestañas, casillas, enlaces y botones, y el texto, 15 px o más.

## Modelos y su función

| Modelo | Función |
|---|---|
| Claude Fable 5.2 (`claude-fable-5-2`) | Revisión de UX y de seguridad de la v1.1 |
| Claude Opus 5.5 | Guardar el texto y aplicar los arreglos |
