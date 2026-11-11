# Product

<!-- impeccable:product-schema 1 -->

> Escrito sin entrevista: el usuario pidió autonomía total (sin preguntas ni aprobaciones). Lo marcado *(inferido)* sale del encargo, no de una respuesta suya.

## Platform

adaptive

## Stack

Delegado: React 19 + Vite 8 + TypeScript (como Fresquito), PWA y Android con Capacitor 8. Backend PocketBase autoalojado (ver la spec en docs/superpowers/specs/2026-11-11-lazo-design.md).

## Users

Familias españolas que se reparten los regalos de una ocasión: Navidad, Reyes, un cumpleaños, una boda o un bebé. Abuelos que entran desde un enlace de WhatsApp, padres que llevan la lista de sus hijos y primos que organizan el amigo invisible. *(inferido: de 4 a 30 personas por grupo; uso intenso en noviembre y diciembre)*

## Product Purpose

Que cada persona tenga su lista de regalos (de Amazon, de cualquier tienda, de un Excel o escrita a mano) y que los demás puedan reservarla o comprarla sin repetir regalos y sin estropear la sorpresa. El éxito es que no haya ningún regalo repetido, ningún spoiler y que nadie se quede atascado al entrar.

## Positioning

**Sorpresa garantizada:** ves el estado de las listas ajenas (libre, reservado, comprado o a medias), pero nunca el de la tuya, y eso se cumple también en la API, no solo en la pantalla. A esto se suman los regalos a medias con el reparto calculado y el amigo invisible con exclusiones, todo en el mismo sitio.

## Operating Context

- Se usa en el sofá, en la cola del súper o en la mesa familiar, casi siempre con el móvil y con prisa, a menudo desde un enlace de WhatsApp.
- Rituales: la carta a los Reyes Magos, el sorteo del amigo invisible, el bote para el regalo caro de los abuelos y la Lotería de Navidad compartida en participaciones.

## Capabilities and Constraints

- **Plazas dinámicas:** quien crea el grupo pone, si quiere, los nombres previstos. Cada nombre es una plaza que ya admite presupuesto y sorpresas. Quien recibe el enlace entra en su plaza (enlace personal) o la elige o escribe su nombre (enlace general, con aprobación por código). Los nombres de la demo son solo ejemplos.
- **Modos de compra** por grupo: hucha común, cada uno lo suyo o mixto. Estados de un regalo: Libre, Me lo reservo, Para la hucha, Ya comprado (con precio real y quién lo pagó) y A medias.
- **Hucha:** nadie paga sus propios regalos. Un tesorero lleva el bote y un suplente las cuentas de los regalos del tesorero. Nada de agregados que permitan deducir lo propio.
- **Día de la entrega** con dos llaves: cada uno ve qué le regalaron, sin precios.

- Grupos por ocasión, invitación por enlace, listas de niños gestionadas por sus padres, reservas, compras, regalos a medias, amigo invisible, importación de Excel o CSV, extracción de metadatos de enlaces e ideas con IA gratuita opcional.
- Demo pública sin backend con datos ficticios (una familia de ejemplo y una plaza libre).
- Terminología fija: «lista», «regalo», «reservar», «comprado», «a medias», «amigo invisible» y «grupo».

## Brand Commitments

- Nombre: **Lazo**.
- Tono: cálido, festivo y elegante. *(del encargo)*
- Nada de estética de IA, nada de botones descuadrados y un único sistema de botones. *(del encargo)*

## Evidence on Hand

No hay logotipo, fotografías ni testimonios. Todo dato de la demo es ficticio y se etiqueta como tal. No hay que inventar ni usuarios ni cifras.

## Product Principles

1. La sorpresa es sagrada: ninguna pantalla ni ninguna petición deja entrever el estado de la propia lista.
2. Se entra con un toque: ni contraseñas ni registros.
3. Menos es más en los datos de los niños: nombre de pila y, si acaso, el año de nacimiento.
4. Gratis por defecto: la IA de pago es opcional.

## Accessibility & Inclusion

Personas mayores: textos de al menos 16 px, objetivos táctiles de al menos 44 px, contraste AA y sin depender solo del color para mostrar el estado (cada estado lleva texto o forma). *(inferido)*
