# Revisión de tres recorridos en móvil · v0.5 → v0.5.1

Revisión de UX sobre las doce capturas de `docs/design/v0.5/recorridos/` (Pixel 7, 412 px) y el código de `src/ui/screens/Join.tsx`, `AddGift.tsx`, `ItemForm.tsx` y `Hucha.tsx`. No se ha editado código ni se ha ejecutado la app: lo que sale de las capturas está visto; lo que sale del código está leído, no probado.

Tres avisos antes de empezar:

- **`hucha-02-boton-pagar.png` y `hucha-02-fallo.png` son idénticas a `hucha-01-hucha.png`.** No muestran ningún estado pulsado ni ningún error. No sé qué «fallo» documenta la segunda; el `onClick` del botón es directo y no explica un toque perdido. Hay que mirar el guion de capturas.
- En las capturas de Amazon, las tarjetas 1 y 4 de la lista salen sin foto y sin lazo. Lo más probable es que sean fotos `loading="lazy"` que no habían cargado al capturar, pero no lo he comprobado.
- La barra «Demo · Probar a entrar · Alberto» solo existe en la demo y no cuenta como hallazgo.

## 1. El abuelo entra por el enlace general

Persona: 75 años, poca vista, llega desde WhatsApp y no sabe qué es «un código».

| Paso | Qué le pasa | Tipo | Impacto |
|---|---|---|---|
| 03 pendiente | **No sabe cómo «decirle» el código a Alberto.** Viene de WhatsApp y la pantalla no le ofrece volver allí. Tiene que memorizar cuatro cifras, cambiar de app y escribirlas. | Se atasca | Alto |
| 03 pendiente | **La pantalla no dice quién ha pedido entrar.** `Pending` recibe `name` y no lo usa (`Join.tsx:151`). Si tocó el nombre equivocado, no se entera y no hay forma de volver. | Falta confirmación | Alto |
| 03 pendiente | **El código «1974» parece un año** y el 1 de Young Serif se lee como una «ı» pequeña. Para alguien con poca vista, copiar cifras de estilo antiguo es el peor caso. | No lo entiende | Alto |
| 03 pendiente | **No hay señal de que algo esté esperando.** El sondeo cada 3 s es invisible: la pantalla parece terminada o rota. No lleva `role="status"`. | Duda | Medio |
| 03 pendiente | «Puedes cerrar esto: cuando te acepte, entrarás al abrir Lazo.» **¿Abrir qué?** No tiene ninguna app; tiene un enlace en un chat. Además, el estado pendiente vive solo en memoria (`Join.tsx:17`): si cierra y vuelve a tocar el enlace, ve otra vez «¿Quién eres?» y puede pedir entrar dos veces. | No lo entiende | Alto |
| 03 pendiente | Desaparecen el lazo y el nombre del grupo. Parece otra página distinta de la que acababa de usar. | Duda | Bajo |
| 01–02 elegir | **El aviso importante va debajo del botón**, en 15 px y en `--tinta-2`: «Elige solo tu nombre. Alberto tiene que aceptarte.» Lo lee después de pulsar, si lo lee. «Tiene que aceptarte» suena a examen. | No lo entiende | Medio |
| 01 elegir | El botón apagado «Elige tu nombre» tiene forma de botón y no hace nada. Un mayor lo pulsa, no pasa nada y piensa que está roto. | Duda | Medio |
| 01 elegir | El círculo de la opción mide 20 px (`.choice input`). Toda la fila es pulsable, pero él apunta al círculo. | Duda | Bajo |
| 02 → entrar | Al ser aceptado salta al grupo sin ningún «Ya estás dentro». | Falta confirmación | Bajo |

Lo que funciona: el título «Te han invitado a Navidad en familia», el botón que cambia a «Soy Tía Loli» y la fila de 64 px.

## 2. Samira añade un regalo de Amazon desde la cola del súper

Persona: con prisa, una mano, cobertura regular. Quiere dos toques y una prueba de que ha salido bien.

| Paso | Qué le pasa | Tipo | Impacto |
|---|---|---|---|
| 02 hoja | **La primera vez, el botón dice «Pegar enlace» y Chrome pregunta si deja leer el portapapeles.** La captura enseña el caso feliz («Pegar amazon.es»), que solo ocurre con el permiso ya dado (`AddGift.tsx:29`). Nadie le ha avisado de esa pregunta y, con prisa, pulsa «Bloquear». | Se atasca | Alto |
| 02 hoja | Si falla el pegado, los mensajes se contradicen o no dicen dónde: «No hay ningún enlace copiado. Pégalo aquí.» y «Mantén pulsado el campo y elige Pegar.» (`AddGift.tsx:71` y `:73`). | No lo entiende | Alto |
| 02 hoja | «Copia el enlace en Amazon… y pégalo aquí.» **«Aquí» no es ningún campo**: solo hay un botón. Tampoco dice cómo se copia en la app de Amazon (Compartir → Copiar enlace). | Duda | Medio |
| 03 añadido | **El recuadro de la foto sale vacío**, sin el lazo de «sin foto» que sí usa el resto de la app. Parece que algo no ha cargado. | Falta confirmación | Medio |
| 03 añadido | «¿Cuántas ganas?» parece una pregunta obligatoria. Se guarda sola y sin avisar: no sabe si tiene que contestar ni si su toque ha servido. | Duda | Medio |
| 03 añadido | **«Deshacer» nace detrás de la hoja.** El aviso sale al guardar (`AddGift.tsx:59`), queda tapado por el `<dialog>` y dura 6 s. Si tarda más en pulsar «Listo», ya no lo verá; la hoja no tiene «Quitar». | Falta confirmación | Medio |
| 03 añadido | Un título real de Amazon llega a 200 caracteres y aquí no se recorta: empuja «Listo» hacia abajo. La demo lo esconde con un título corto. | Se atasca | Medio |
| 03 añadido | «Listo» y «Añadir otro» pesan casi lo mismo. Pasable. | Duda | Bajo |
| 04 mi lista | **No ve su regalo.** Cae el tercero por orden de ganas, medio fuera de pantalla, y el título queda bajo la barra «Añadir» y el aviso. Lo único que lo confirma es un aviso de 6 s. | Falta confirmación | Medio |
| 04 mi lista | El aviso tapa el texto del botón fijo «Añadir». | Duda | Bajo |
| 02 hoja | «Importar desde Excel» pesa lo mismo que «Escribirlo a mano». Ruido para quien tiene prisa. | Duda | Bajo |
| (código) | Con un enlace repetido sale «Ya lo tienes en tu lista.» y, debajo, un campo «Enlace» vacío que no viene a cuento (`AddGift.tsx:105`). | Duda | Bajo |

Lo que funciona: dos toques reales, «Leyendo la tienda…», el título «Añadido a tu lista» con la marca verde y el precio con la tienda.

## 3. Mamá apunta que ya le dio su parte a Alberto

Persona: no entiende de cuentas y teme «pagar» sin querer o apuntar algo mal delante de la familia.

| Paso | Qué le pasa | Tipo | Impacto |
|---|---|---|---|
| 04 pagado | **«Estás al día» y, justo debajo, «Y 12,50 € a Samira» con su botón.** O está al día o debe dinero. Es la frase que más confianza quita de los tres recorridos. | No lo entiende | Alto |
| 03 hoja | **Dos toques seguidos en «Apuntar» apuntan dos pagos.** El botón no tiene estado de espera (`Hucha.tsx:171`). El resultado sería «Alberto te tiene que devolver 16,25 €». Los mayores pulsan dos veces. | Se atasca | Alto |
| 01 hucha | **No sabe si aquí se paga.** «Te falta poner 16,25 €» y un botón grande de color: parece un botón de pagar. «Lazo no mueve dinero: solo lo apunta» está al final de la página, en pequeño. Nadie le dice cómo darle el dinero a Alberto. | Duda | Alto |
| 01 hucha | «Y 12,50 € a Samira, por los regalos de Alberto.» Empieza por «Y», no dice por qué Samira y la cifra grande (16,25 €) parece el total, cuando debe 28,75 €. | No lo entiende | Alto |
| 04 pagado | El aviso «Apuntado. Solo lo veis vosotros dos.» dura 3 s, no dice cuánto ni a quién, y «vosotros dos» no tiene nombre. La prueba que queda («Le diste a Alberto») está más abajo, fuera de pantalla. | Falta confirmación | Medio |
| 03 hoja | «¿Cuánto?» sin «euros», y nada que diga que esto solo apunta y quién lo verá. | Duda | Medio |
| 01 hucha | «La lleva Alberto»: ¿lleva qué? En pequeño y gris, es la frase que explica todo lo demás. | No lo entiende | Medio |
| 01 hucha | 16,25 € aparece tres veces (cifra, «0 € de 16,25 €» y «Faltan 16,25 €»). Tres números iguales le hacen pensar que son tres cosas. | Duda | Bajo |
| (código) | «Quitar» borra un pago sin confirmar ni deshacer (`Hucha.tsx:127`). | Falta confirmación | Bajo |
| 02 | Las dos capturas del paso 2 no muestran nada distinto del paso 1 (ver avisos). | — | Por comprobar |

Lo que funciona: frases con sujeto («Ya se lo di a Alberto»), la cantidad ya escrita y el foco en el botón en lugar de abrir el teclado.

## Los 5 arreglos de más impacto (v0.5.1)

Todos son de cliente: textos, un estado local y dos reglas de CSS. Ninguno toca el servidor ni lo que cada persona puede ver.

### 1. Que «Apuntar» no pueda apuntar dos veces, y que diga qué ha hecho

`src/ui/screens/Hucha.tsx`, componente `PaySheet`.

- Añadir `const [busy, setBusy] = useState(false);`, pasar `loading={busy}` al botón, poner `setBusy(true)` antes de `api.addPayment` y `setBusy(false)` en el `catch`. `Button` ya ignora los toques mientras carga.
- Etiqueta del campo: `¿Cuánto?` → **`Cantidad, en euros`**.
- Debajo del campo, nuevo `<p className="meta">`: **`Lazo no mueve dinero: solo lo apunta. Lo veréis solo vosotros dos.`**
- Aviso: `toast('Apuntado. Solo lo veis vosotros dos.')` → **``toast(`${p.title}: ${m(c)} apuntados.`)``**, que da «Ya se lo di a Alberto: 16,25 € apuntados.»

### 2. Que la hucha no diga «Estás al día» cuando aún debe

`src/ui/screens/Hucha.tsx`, sección `aria-label="Tu saldo"`.

- Línea 75: `'Estás al día'` → **``d.aparte > 0 ? `Con ${name(T)} estás al día` : 'Estás al día'``**.
- Línea 79: `Y {m(d.aparte)} a {name(T2)}, por los regalos de {treasurerName}.` → **`Aparte, te faltan {m(d.aparte)} para {name(T2)}: es tu parte de los regalos de {treasurerName}.`**
- Línea 57: `` `La lleva ${name(T)}` `` → **`` `${name(T)} guarda el dinero de la hucha` ``** y `'La llevas tú'` → **`'Tú guardas el dinero de la hucha'`**.
- Entre la barra y el botón «Ya se lo di a…» (línea 66), nuevo `<p>`: **`Dáselo en mano o por Bizum, como queráis. Después, apúntalo aquí.`**

### 3. Que el abuelo sepa quién es, qué hacer con el código y que la app está esperando

`src/ui/screens/Join.tsx`, componente `Pending`. Añadir `name` a la desestructuración e importar `ButtonLink` y `WhatsappLogo` (ya se usa en `Invite.tsx`). Sustituir el bloque de las líneas 173–176 por:

```tsx
<h2 className="h-section">Ya casi estás, {name}</h2>
<p>Solo falta que {organizer} te deje entrar. Mándale este código para que sepa que eres tú:</p>
<p className="code" aria-label={`Código ${code.split('').join(' ')}`}>{code}</p>
<ButtonLink variant="primary" size="lg" wide icon={WhatsappLogo} target="_blank" rel="noopener noreferrer"
  href={`https://wa.me/?text=${encodeURIComponent(`Hola, ${organizer}. Soy ${name}. Mi código de Lazo es ${code}.`)}`}>
  Enviar el código por WhatsApp
</ButtonLink>
<p className="meta" role="status">Esperando a {organizer}… Esta pantalla cambiará sola cuando te acepte.</p>
<p className="meta">Si la cierras, no pasa nada: cuando te acepte, abre Lazo y ya estarás dentro.</p>
```

La última frase mantiene la promesa actual, que no he podido comprobar: ver «Lo que queda fuera».

### 4. Que el código y el aviso de entrada se puedan leer

- `src/styles.css:482`, `.code`: `font-family: var(--f-display); font-weight: 400; letter-spacing: 0.08em` → **`font-family: var(--f-ui); font-weight: 800; letter-spacing: 0.16em`**. Es una excepción consciente a «cifras en Young Serif»: este número se copia, no se admira. Hay que anotarla en `DESIGN.md`.
- `src/styles.css:294`, `.choice input`: `20px` → **`28px`** de ancho y de alto.
- `src/ui/screens/Join.tsx`, componente `General`: quitar el `<p className="meta">` de la línea 145 y poner, justo debajo de `<h2>¿Quién eres?</h2>`, un `<p>` normal: **`Toca tu nombre. Después, {info.organizer} te dejará entrar.`**
- Misma función, línea 91: `'Elige tu nombre'` → **`'Primero toca tu nombre'`**, para que el botón apagado se lea como instrucción.

### 5. Que pegar no dependa de adivinar, y que «Añadido» parezca terminado

`src/ui/screens/AddGift.tsx`.

- Línea 104: `Copia el enlace en Amazon o en cualquier tienda y pégalo aquí.` → **`En la tienda, pulsa «Compartir» y «Copiar enlace». Luego vuelve y toca este botón. Si el móvil pregunta, pulsa «Permitir».`**
- Línea 71: `'No hay ningún enlace copiado. Pégalo aquí.'` → **`'No encuentro ningún enlace copiado. Vuelve a la tienda, cópialo y pégalo en este campo.'`**
- Línea 73: `'Mantén pulsado el campo y elige Pegar.'` → **`'El móvil no nos deja pegarlo solo. Mantén el dedo en el campo «Enlace» y elige «Pegar».'`**
- Línea 157: `{item.image && <img … />}` → **`{item.image ? <img … /> : <span className="noimg"><Bow size={32} /></span>}`**, como en `Purchases.tsx:65`; el estilo `.gift-thumb .noimg` ya existe.
- Línea 160, el `<p>` del título: añadir **`className="purchase-title"`** (recorte a dos líneas ya definido en `styles.css:535`).
- Línea 170: `¿Cuántas ganas?` → **`¿Cuántas ganas? (puedes dejarlo así)`**.

## Lo que queda fuera del parche

- **Volver al enlace estando pendiente o ya aceptada.** El estado pendiente no se guarda. En la demo, quien vuelve a abrir el enlace ve «¿Quién eres?» sin su nombre libre o puede pedir entrar otra vez. No he comprobado qué hace el servidor real. Es el riesgo más serio que no cabe en un parche de textos.
- **«Deshacer» tapado por la hoja** y **el regalo nuevo fuera de pantalla** al volver a la lista: piden mover el aviso al cerrar la hoja y desplazar la lista hasta la tarjeta nueva.
- **El aviso encima del botón fijo «Añadir»** y **«Quitar» sin confirmación** en la hucha.
- **Deshacer un pago desde el aviso:** `addPayment` no devuelve el identificador, así que exige tocar la API.

## Resumen

Los tres recorridos se completan, pero ninguno deja a la persona segura de haberlo hecho bien. El abuelo se queda con un código que parece un año, sin su nombre y sin forma de mandarlo por WhatsApp. Samira depende de un permiso del navegador que nadie le anuncia y de mensajes de error que se contradicen. Mamá lee «Estás al día» encima de una deuda de 12,50 € y puede apuntar el mismo pago dos veces con un doble toque. Los cinco arreglos son de textos, un estado de espera y dos reglas de CSS, en `Hucha.tsx`, `Join.tsx`, `AddGift.tsx` y `styles.css`. Queda sin resolver, y sin comprobar, qué pasa al reabrir el enlace estando pendiente.
