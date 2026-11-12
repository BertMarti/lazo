# Lista de Amazon: qué hace Lazo y qué riesgos tiene

Revisado el 2026-11-12 para la v1.1. **No es asesoramiento jurídico.** Es una lectura prudente de unas condiciones que Amazon puede cambiar cuando quiera; conviene repasarla antes de cada versión.

## En dos frases

Lazo te deja traer a tu lista los productos de **tu propia** lista de deseos pública de amazon.es. La forma principal es **copiar y pegar**: Lazo no se conecta a Amazon. La lectura automática desde el servidor **no se incluye en la v1.1**; si algún día se añade, vendrá apagada.

## Qué hace Lazo con una lista de Amazon

| | |
|---|---|
| **Quién lo pide** | La persona dueña de la lista de Amazon, para su propia plaza en Lazo. Nadie importa la lista de otro |
| **Cuándo** | Solo cuando pulsa «Importar». No hay lecturas programadas, ni actualización de precios, ni nada en segundo plano |
| **Para qué** | Para no teclear a mano regalos que ya eligió en Amazon. Uso familiar y privado |
| **Qué se lee** | El título, la foto, el precio y el código del producto (ASIN) de cada artículo de la lista |
| **Qué se guarda** | Por cada regalo: título, dirección de la foto (la foto no se copia: se sigue viendo desde Amazon), precio y el enlace limpio `https://www.amazon.es/dp/<ASIN>` |
| **Prioridad y cantidad** | Si la copia las trae, se guardan como datos de tu propio regalo («Me encantaría», «2 unidades»): son tuyos, no de Amazon |
| **Qué no se guarda** | El enlace ni el identificador de tu lista de Amazon, tu nombre en Amazon, comentarios, dirección de envío, ni la página descargada |
| **Tope** | 100 productos por importación |

### Los dos caminos

**(b) Copiar y pegar (el principal).** Abres tu lista en Amazon con tu navegador, seleccionas todo (Ctrl+A), copias (Ctrl+C) y lo pegas en Lazo. Lazo lo analiza en tu móvil u ordenador. **No hay ninguna petición de Lazo a Amazon**: quien visita Amazon eres tú, como cualquier otro día.

**(a) Lectura desde el servidor (no incluida en la v1.1).** El servidor de casa descargaría la página pública de la lista: una lectura por importación, como mucho 5 páginas y 100 productos, con límite de peticiones y con un nombre de programa honesto (`LazoBot`). Si Amazon contesta con un captcha o un error, Lazo se detiene y te ofrece copiar y pegar.

### Lo que Lazo no hace, en ningún caso

- **No resuelve ni esquiva captchas** y no se hace pasar por un navegador.
- **No usa tu sesión de Amazon**: ni contraseña, ni cookies. Solo sirve para listas públicas.
- **No lleva enlaces de afiliado** ni cobra comisión: el enlace guardado es el del producto, sin etiquetas.
- **No lee listas ajenas, no rastrea precios y no monta un catálogo** de productos de Amazon.
- **No reintenta** cuando Amazon dice que no.

## Qué dicen las condiciones de Amazon

**Fuentes y hasta dónde llegué.**

- `https://www.amazon.es/robots.txt`: leído el 2026-11-12.
- Condiciones de Uso y Venta de Amazon.es (`https://www.amazon.es/gp/help/customer/display.html?nodeId=200545940`): **no las pude leer hoy**. Amazon respondió a la descarga automática con una página de verificación («para hablar de acceso automatizado a datos de Amazon, contacte con…»), y no intenté saltarla. Lo que sigue es lo que recuerdo de la cláusula «Licencia y acceso»; **no es una cita verificada** y hay que comprobarla a mano en un navegador antes de publicar.

**La cláusula de licencia y acceso** (de memoria, en sustancia):

- La licencia que Amazon da al cliente es para uso personal y no comercial, y **no incluye «el uso de herramientas o robots de búsqueda y extracción de datos o similar»** (*data mining, robots, or similar data gathering and extraction tools* en la versión inglesa).
- Tampoco permite la **extracción sistemática o la reutilización** de partes del servicio sin consentimiento escrito, en una o en varias veces, ni crear bases de datos propias con partes sustanciales (pone de ejemplo los listados de productos y los precios).

**El `robots.txt`** (leído hoy):

- Para cualquier robot (`User-agent: *`) están vetadas las rutas de listas de deseos `/wishlist/`, `/gp/wishlist/`, `/gp/registry/wishlist/` y `/registry/wishlist/`.
- La ruta actual, `/hz/wishlist/`, **no aparece** en la lista de vetos. Leído al pie de la letra, no está prohibida; leído con sentido común, Amazon no quiere robots en las listas de deseos y se le ha quedado atrás una ruta.
- Hay además una larga lista de robots vetados por completo (rastreadores e IA). `LazoBot` no está en ella.
- El `robots.txt` es una señal de voluntad, no un contrato; lo que obliga son las condiciones.

Una pista práctica: que hoy Amazon haya cortado una simple descarga de su página de ayuda indica que el camino (a) **fallaría a menudo** aunque fuera lícito.

## ¿Chocan los caminos con esas condiciones?

**Camino (a), servidor: sí, razonablemente.** Aunque sea una lectura puntual y la pida la dueña de la lista:

- Un programa que descarga la página y saca de ella títulos, fotos y precios **es** una herramienta de extracción de datos. La cláusula de licencia, tal como la recuerdo, no distingue entre poco y mucho, ni entre lo ajeno y lo propio.
- La parte más dura (extracción «sistemática», «partes sustanciales», bases de datos) **no encaja**: cien productos de una lista personal, una vez y para la familia, no son una parte sustancial de Amazon ni un catálogo. Eso baja mucho el riesgo, pero no borra el punto anterior.
- Quien hace la petición es el servidor de casa, no el navegador de la clienta. Que ella lo haya pedido es un buen argumento, no un permiso de Amazon.

**Camino (b), copiar y pegar: no veo choque.** No hay robot ni herramienta de extracción actuando sobre Amazon: una persona mira su propia lista con su navegador y copia un texto, que es un uso normal del servicio. Lo copiado es poco, es suyo (lo eligió ella) y se queda en su grupo familiar. Queda un resto teórico (se reutilizan título, foto y precio fuera de Amazon), del mismo tamaño que el de pegar a mano el enlace de un producto, que Lazo ya permite.

## Riesgos

| Riesgo | Camino | Qué tan probable | Consecuencia |
|---|---|---|---|
| Amazon bloquea o pide captcha a la IP de casa | (a) | Media-alta | La importación falla. Es la **misma IP** desde la que la familia compra en Amazon: podrían salirle captchas también a ella durante un tiempo |
| Incumplir las condiciones de uso | (a) | Es el supuesto de partida | Amazon puede restringir el acceso o la cuenta de quien las incumple. Una reclamación a una familia por una lectura puntual es muy improbable, pero el proyecto es público y lleva nombre |
| El repositorio público incluye un «lector de Amazon» | (a) | Segura si se implementa | Aviso de retirada o mala fama para el proyecto; otros pueden reutilizar el código sin los límites |
| Amazon cambia la página y el análisis deja de funcionar | (a) y (b) | Alta con el tiempo | La importación trae menos datos o ninguno. No rompe nada más |
| La dirección de la foto apunta a Amazon | (a) y (b) | Siempre | Amazon ve que alguien abre la foto (como en cualquier web que enlaza una imagen). No se copia la imagen |
| El enlace de la lista revela quién eres en Amazon | (a) | Baja | Por eso no se guarda ni se registra |

## Recomendación

1. **Camino principal: (b), copiar y pegar.** Funciona sin servidor (también en la demo y en el APK), no depende de que Amazon deje pasar a un robot y no choca con sus condiciones.
2. **Camino (a): no implementarlo en la v1.1.** Aporta comodidad, pero choca con la letra de la licencia, pone en juego la IP de casa y lo más probable es que Amazon lo corte.
3. **Si más adelante se decide hacerlo**, que sea:
   - **apagado por defecto**, y lo enciende quien aloja el servidor sabiendo lo que hay (una variable del servidor, no un ajuste de cada usuario);
   - nunca en la demo pública;
   - cumpliendo los requisitos AMZ-1 a AMZ-16 de `docs/security/AUDIT.md`;
   - después de leer a mano las condiciones vigentes y, si se quiere hacer bien, de preguntar a Amazon.
4. **La vía oficial** para leer datos de productos es la API de afiliados de Amazon (Product Advertising API). Exige cuenta de afiliado y ventas, y Lazo no lleva afiliados: no aplica. Amazon no ofrece una exportación oficial de listas de deseos.

## Pendiente de revisión manual

- Leer en un navegador la cláusula «Licencia y acceso» vigente y sustituir aquí el resumen de memoria por la cita literal con su fecha.
- Volver a mirar el `robots.txt` antes de cada versión, por si aparece `/hz/wishlist/`.

> Las fotos de la vista previa no se cargan hasta que confirmas: antes de pulsar «Añadir», Lazo no hace ninguna petición a Amazon (AMZ-16). Después, como con cualquier regalo, la foto se muestra desde la tienda.

## Modelos y su función

- **Claude Fable 5.2 (`claude-fable-5-2`):** esta revisión (lectura del `robots.txt`, análisis de los dos caminos y recomendación) y el diseño de seguridad del camino (a) en `docs/security/AUDIT.md`. No pudo leer las Condiciones de Uso en línea; esa parte sale de lo que el modelo sabe y está marcada como tal.
- **Ningún modelo de IA interviene en la importación:** el texto pegado lo analiza código normal en el dispositivo, y nada de la lista de Amazon se envía a un proveedor de IA.
