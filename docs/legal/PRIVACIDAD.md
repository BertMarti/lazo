# Política de privacidad de Lazo

Última revisión: 12 de noviembre de 2026. Es un texto orientativo, no asesoramiento legal.

## Quién es el responsable

Lazo no es una empresa. No hay un servidor central ni nadie «detrás» que guarde tus datos.

Cada familia monta Lazo en un ordenador de su casa (una Raspberry Pi, por ejemplo). **La persona que monta ese servidor es la responsable del tratamiento.** Normalmente es quien organiza el grupo. Si tienes dudas sobre tus datos, habla con esa persona.

Quien programa Lazo no recibe ni ve ningún dato de tu familia.

## Qué datos se guardan

En el servidor de casa de quien organiza se guarda:

- **Tu nombre**, tal como lo escribes al entrar, y un color para tu avatar.
- **Los grupos** en los que estás: nombre, ocasión y fecha.
- **Las listas y los regalos**: título, precio, enlace, foto de la tienda, talla, color, notas, prioridad y cantidad.
- **Las listas de los niños**: solo el nombre de pila y, si quieres, el año de nacimiento. Más detalles en [MENORES.md](MENORES.md).
- **Lo que hace cada uno con los regalos**: reservas, compras, regalos a medias, aportaciones y pagos de la hucha, y presupuestos.
- **El amigo invisible**: el sorteo, las exclusiones y quién le toca a quién.
- **Las invitaciones**: solo una huella (hash) del enlace, su caducidad y cuántas veces se ha usado.

No se guardan contraseñas, porque Lazo no las usa. Tampoco correos ni teléfonos.

## Quién ve qué

- Solo ven un grupo las personas que están dentro.
- **La regla de la sorpresa:** de tu lista, tú ves los regalos que pides. No ves quién los reserva, si están comprados, cuánto se ha gastado ni las sorpresas que te preparan. El resto del grupo sí lo ve. La regla vale para todos, también para quien organiza.
- La regla la aplica el servidor, no la pantalla. Aunque alguien toque la app, el servidor no le da esos datos.
- El día de la entrega, si el grupo la abre, ves qué te han regalado y de parte de quién. Nunca los precios.
- Quien monta el servidor puede entrar en el panel de administración. Desde ahí técnicamente podría ver todo. Por eso debe ser alguien de confianza.

## Qué sale de casa

Casi todo se queda en el servidor de casa. Hay tres excepciones:

1. **Leer enlaces de tiendas.** Cuando pegas un enlace, el servidor de casa visita esa página para sacar el título, la foto y el precio. La tienda ve la visita, como si la abrieras tú. No se le manda nada tuyo.
2. **Las fotos de los regalos.** Las fotos se cargan desde la web de la tienda. Al ver una lista, tu móvil las pide a esa tienda.
3. **La IA, solo si la activas.** Viene apagada. Si eliges un proveedor en Ajustes, tu móvil le envía:
   - para ideas: la franja de edad («6–8 años»), los gustos que escribas y el presupuesto;
   - para entender un Excel: las cabeceras y tres filas de ejemplo.

   Nunca se envían nombres, años de nacimiento, reservas ni listas de otras personas. Con **Ollama** la IA está en tu casa y no sale nada. Con **Claude** o **Gemini de pago**, los datos van a esa empresa con tu propia clave y sus condiciones. Los proveedores gratuitos son solo para pruebas ([proveedores.md](proveedores.md)).

Si quien organiza usa **Cloudflare Tunnel** para entrar desde fuera, el tráfico pasa por Cloudflare. Se explica en [HOMELAB.md](../HOMELAB.md).

Si tocas «Mandar por WhatsApp», se abre WhatsApp con el mensaje. Lo mandas tú.

## Cuánto tiempo se guardan

Mientras el grupo exista. Lazo no borra nada solo.

## Cómo borrarlos

- Tus regalos, tus reservas y tus aportaciones los puedes quitar tú desde la app.
- Para borrar tu cuenta, una lista de un niño o un grupo entero, pídeselo a quien organiza. Lo borra desde el panel de administración del servidor.
- Las copias de seguridad guardan los datos borrados hasta que la copia rota (unos 14 días).

## Tus derechos

Según el RGPD puedes pedir:

- **Acceso:** saber qué datos hay sobre ti.
- **Rectificación:** corregir lo que esté mal.
- **Supresión:** que se borren.

Pídelo a la persona que monta el servidor de tu familia. Si no te hace caso, puedes reclamar ante la [Agencia Española de Protección de Datos](https://www.aepd.es).

## Copias de seguridad

El servidor hace una copia diaria y guarda las 14 últimas. Están en el mismo ordenador y solo las puede leer el administrador. Quien organiza puede copiarlas a otro disco o a un NAS de su casa.

## Cookies y almacenamiento en el móvil

Lazo **no usa cookies** ni herramientas de analítica o publicidad.

Sí guarda unas pocas cosas en el almacenamiento del navegador (`localStorage`), solo en tu móvil:

| Qué | Para qué |
|---|---|
| `pocketbase_auth` | Tu sesión, para no tener que entrar cada vez |
| `lazo:server` | La dirección del servidor de tu familia |
| `lazo:last-group` | El último grupo que abriste |
| `lazo:avisos:…` | Lo último que viste, para avisarte de novedades |
| `lazo:pendiente:…` | Tu código mientras esperas a que te acepten |
| `lazo:explicado` | Que ya viste la explicación de la sorpresa |
| `lazo:ia` | El proveedor de IA y tu clave, si la activas. Nunca llega al servidor |

Si borras los datos del navegador para tu Lazo, todo esto desaparece del móvil. Lo del servidor sigue allí.

La demo pública no tiene servidor: sus datos son ficticios y se guardan solo en tu navegador.

## Modelos y su función

- **Claude Opus 5.5:** redactó este texto a partir de `SECURITY.md`, `docs/HOMELAB.md`, `docs/legal/proveedores.md` y el código de `src/ai/`.
- **Modelos de IA del producto** (opcionales): solo reciben la franja de edad, los gustos, el presupuesto o las cabeceras de un Excel. Nunca nombres ni datos de otras listas.
