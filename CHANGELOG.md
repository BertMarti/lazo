# Novedades

Todas las novedades de Lazo. Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones [semver](https://semver.org/lang/es/).

## [Sin publicar]

## [1.1.0] - 2026-11-12 · Lista de Amazon

Trae a Lazo la lista que ya tienes hecha en Amazon, en un momento y sin que Lazo entre en Amazon por ti.

### Lo nuevo
- **Trae tu lista de Amazon.** En «Añadir a tu lista», «Importar lista de Amazon»: abre tu lista en el navegador, selecciónalo todo, cópialo y toca «Pegar». Lazo te enseña los productos que ha encontrado, deja sin marcar los que ya tienes y añade los que elijas. Hay pasos con dibujos para Android, iPhone y ordenador. Lazo no se conecta a Amazon: solo lee lo que pegas, en tu móvil.
- **En la app de Android**, selecciona el texto de tu lista y elige «Compartir → Lazo»: se abre directamente la vista previa.
- Si pegas solo el enlace de la lista (lo que da la app de Amazon), Lazo te explica qué falta y cómo copiarlo.

### Más claro
- La hoja «Añadir a tu lista» se ve centrada y con el fondo atenuado en el ordenador, y ocupa todo el ancho abajo en el móvil.

### Seguridad
- Lazo no hace ninguna petición a Amazon: lee solo lo que tú pegas o compartes, en tu móvil, y ni siquiera carga las fotos hasta que confirmas. Revisión legal y de seguridad de Fable 5.2 en `docs/legal/AMAZON.md` y `docs/security/AUDIT.md`.
- Los duplicados se comparan solo con lo que ya ves en tu lista, y lo que llega de otra app no se añade hasta que pulsas «Añadir».

## [1.0.0] - 2026-11-12 · Nochebuena

Lazo está listo para que tu familia lo use esta Navidad: sin regalos repetidos, sin un solo chivatazo y con todo en tu casa.

### Lo nuevo
- **Todo al momento.** Cuando alguien reserva, compra o pone dinero en la hucha, los demás lo ven sin recargar. Y tu propia lista sigue sin enterarse de nada.
- **Lista para imprimir.** «Imprimir la lista» saca una hoja bonita en A4 con un código por regalo que se abre con la cámara del móvil: perfecta para los abuelos. Nunca dice qué está cogido.
- **Compartir mi lista (solo lectura).** Un enlace para amigos que no están en el grupo: ven lo que pides, nada más. Puedes dejar de compartirlo cuando quieras.
- **Si alguien pierde el móvil**, quien organiza libera su sitio y le manda un enlace nuevo: conserva su lista y todo lo suyo.
- **Entrar con un código**: «Tengo un código» para la primera vez y «Entrar en otro móvil» en Ajustes. Y «Cerrar sesión», en este móvil o en todos.
- **Al entrar por el enlace** ya ves las caras de la familia que está dentro.
- **Sin cobertura**: una franja te avisa de que ves lo último que cargaste, y al volver la red todo se pone al día solo. Lo que guardas nunca se repite por error.
- **Copia del grupo**: para empezar otra Navidad con las mismas personas y sus listas, o mudaros de servidor.
- **Privacidad y legal en sencillo**: política de privacidad, aviso sobre los datos de los niños y términos de uso, enlazados en Ajustes y al entrar.

### Más claro en el móvil
- El presupuesto de cada persona se lee de un vistazo («Quedan 25,10 €») y las cuentas van plegadas en «Ver cuentas».
- El aviso de lo que no ve el dueño de una lista ocupa una línea y se explica solo la primera vez.
- Regalos en dos columnas, sin huecos raros, y una banda de la demo que cabe en una línea.

### Seguridad
- Dos auditorías finales de Fable 5.2 (V-20 a V-31), todas corregidas. Entre otras:
  - el tiempo real ya no delata qué regalos tuyos estaban cogidos al quitarlos;
  - tampoco recrear un regalo con su mismo identificador;
  - la copia del grupo no guarda datos de otros.
- Copias de seguridad cifradas opcionales, permisos estrictos en el servidor de casa e imágenes de Docker fijadas.
- 63 pruebas contra PocketBase real, entre ellas una familia de 5 personas de principio a fin, comprobando en cada paso que nadie ve lo suyo. 194 pruebas unitarias y 112 de punta a punta, con accesibilidad AA en claro y en oscuro.
- El APK de Android ya es de release, firmado con una clave que no está en el repositorio.

### Para montarlo
- [`docs/PRUEBA-REAL.md`](docs/PRUEBA-REAL.md): 15 minutos para tenerlo en casa y probar con la familia que la sorpresa funciona.

## [0.5.1] - 2026-11-12 · Probado con la familia

Arreglos que salen de recorrer Lazo en el móvil como lo harían un abuelo, alguien con prisa y una madre con la hucha, y lo que faltaba para montarlo en casa de verdad.

### Añadido
- `lazo-alta`: un comando que crea a quien organiza y su primer grupo en una instalación nueva, y da un código para entrar desde el móvil.
- «Tengo un código» en la pantalla de inicio (y en la primera pantalla de Android), y «Entrar en otro móvil» en Ajustes.
- `docs/PRUEBA-REAL.md`: guía de 15 minutos para montarlo en casa y probar con la familia que la sorpresa funciona.

### Cambiado
- Entrar por el enlace: el código de espera se lee mejor, sale tu nombre, se puede reenviar por WhatsApp a quien organiza y sigue ahí si vuelves a abrir el enlace.
- Hucha: no se puede apuntar el mismo pago dos veces, la hoja recuerda que Lazo no mueve dinero y los textos dicen con quién estás al día y cómo dar el dinero.
- Añadir pegando un enlace: textos más claros, el lazo cuando no hay foto y la prioridad se puede dejar como está.

## [0.5.0] - 2026-11-12 · Lista para Navidad

Lazo se puede montar en casa para la familia de verdad, entiende mejor las tiendas y las hojas de cálculo, avisa de lo nuevo sin estropear sorpresas y el amigo invisible se abre como un regalo.

### Añadido
- Amigo invisible: el paquete se abre con una animación (el lazo se deshace, la cinta se retira y aparece la persona), se puede volver a tapar y puedes enviarte el resultado a ti mismo («Enviármelo» o «Copiar»), con un aviso para no reenviarlo al grupo.
- Importar desde Excel o CSV con una tabla para elegir qué es cada columna (adivinada sin IA, en español e inglés) y una vista previa antes de importar. Los CSV en windows-1252 ya no rompen las tildes.
- Mejor lectura de enlaces de Amazon.es, El Corte Inglés, PcComponentes, Zara y Decathlon (solo metadatos públicos). Si una tienda no deja ver los datos, el enlace se guarda y lo escribes a mano.
- Puesta en marcha en casa: guía paso a paso en `docs/HOMELAB.md`, copias de seguridad automáticas con rotación y restauración, HTTPS con Caddy, y acceso desde fuera con DuckDNS, dominio propio o Cloudflare Tunnel.
- Avisos del grupo: una campana en la cabecera con lo nuevo desde la última vez (regalos que alguien añade a su lista, quién entra, la cuenta atrás a 10, 3 y 1 día, lo que te toca poner en la hucha y el sorteo). Se calculan en tu móvil con lo que ya puedes ver: nunca dicen nada de tu propia lista.

### Seguridad
- El proxy bloquea más rutas de administración de PocketBase y pasa la IP real del cliente (también detrás de Cloudflare Tunnel).
- Nueva prueba contra PocketBase real del flujo completo (crear grupo, invitar, reclamar plaza, reservar, hucha y ajuste de cuentas), comprobando en cada paso que nadie ve lo suyo.
- Prueba de que ningún aviso cambia por lo que otros hacen en tu lista.
- Auditoría de Fable 5.2 de la v0.5 aplicada:
  - El login de superusuario ya no se puede alcanzar por su id; Caddy deja pasar solo las rutas que usa la app.
  - Nadie puede inventarse su IP desde la red de casa para saltarse los límites.
  - Una página hostil ya no puede colgar la lectura de enlaces.
  - Lo que recuerdan los avisos se borra al cambiar de persona en el mismo navegador.
- Accesibilidad comprobada con axe (WCAG 2.1 AA) en las pantallas principales, en claro y en oscuro.

## [0.4.0] - 2026-11-11 · El catálogo de juguetes

Rediseño completo: Lazo deja de parecer un panel de administración y pasa a ser el catálogo de Navidad de una juguetería, con la familia y los regalos en grande.

### Cambiado
- Nueva identidad: papel crema, terracota, abeto y oro, títulos en Young Serif e interfaz en Nunito. Modo oscuro cálido.
- Navegación con barra inferior en el móvil y cabecera con pestañas en el escritorio (adiós al raíl lateral).
- El grupo enseña a cada persona con su cara grande, sus regalos y su presupuesto, y debajo «Lo más deseado» en fotos.
- Las listas son un tablero de fotos con la etiqueta de precio. Lo reservado lleva una cinta y lo comprado la cinta en cruz, siempre con una etiqueta que lo dice con palabras.
- Tus grupos, la hucha, Mis compras, el sorteo, la entrada por enlace, los estados vacíos y la carga, rehechos con el mismo sistema. `DESIGN.md` reescrito.

### Añadido
- El lazo que se anuda al reservar y un confeti discreto al marcar «Ya comprado» (ninguno de los dos con movimiento reducido).
- Prueba e2e que entra en un grupo desde «Tus grupos» y vuelve.

### Corregido
- Al cambiar de pantalla ya no se ve un momento el título de la anterior.

### Seguridad
- Nueva prueba PB-13 contra PocketBase real: las cuentas de la hucha de cada persona (su parte, lo que debe, la previsión y la tabla de cobro) salen bien con lo que el servidor le entrega y no cambian por lo que otros hagan en su plaza. Ya son 23 pruebas y no queda ninguna pendiente.

## [0.3.0] - 2026-11-11 · Más segura y con fotos

Repaso de seguridad completo, fotos de verdad en la demo y una app que se toca bien en cualquier móvil.

### Seguridad
- Cerrados los hallazgos bajos de la segunda auditoría (V-8 a V-15): comprobaciones dentro de la transacción, límite de peticiones de «Lo que te regalaron», no se puede borrar la cuenta ocupando una plaza, la plaza de quien lleva la hucha no se borra, sin nombres repetidos y nada se compra sobre un regalo retirado. La demo se comporta igual que el servidor.
- 22 pruebas contra un PocketBase real, entre ellas 20 reservas simultáneas del mismo regalo (queda una sola) y la comprobación byte a byte de que lo que otros hacen en tu lista no cambia nada de lo que ves.

### Añadido
- **La demo tiene fotos de verdad:** 19 regalos con foto de Wikimedia Commons con licencia libre, guardadas en el repo y con sus créditos en `public/demo/fotos/CREDITOS.md` (enlace en la barra de la demo).

### Cambiado
- **Todo se toca bien con el dedo:** en el móvil, cada botón y enlace mide al menos 44 px y nada se sale de la pantalla ni a 320 px de ancho (antes «Mis compras» se desbordaba con títulos largos). Lo comprueba una prueba nueva en cada pantalla.
- **La IA viene apagada y Ollama es la opción recomendada.** Tras revisar las condiciones de los proveedores, para el uso diario en la UE solo valen Ollama en casa o una clave de pago (Claude, o Gemini con facturación). Gemini gratuito, Groq, OpenRouter y NVIDIA quedan marcados «solo pruebas». Lazo funciona entero sin IA. Detalles en `docs/legal/proveedores.md`.

## [0.2.0] - 2026-11-11 · La hucha y las plazas

Primera versión completa: servidor para casa, plazas para cada persona, hucha común, día de la entrega y app de Android.

### Añadido
- **Presupuesto por persona.** El grupo fija cuánto se gasta en cada uno y una barra muestra lo comprometido (reservas, compras y aportaciones) y lo que queda, o cuánto os pasáis. Lo ve todo el grupo **menos el destinatario**.
- **Reservar en un toque**, directamente desde la lista y con «Deshacer» durante 6 segundos.
- **Añadir en dos toques:** «Añadir» y después «Pegar enlace». Lazo lee la tienda y lo guarda. También vale pegar en cualquier punto de la hoja.
- **Cada regalo dice quién lo tiene** sin abrirlo: «Lo reserva Samira», «Lo compró Papá», «A medias · 71 % · ponen Javier y Papá».
- **«Marta no ve esto»:** la regla de la sorpresa se explica sola donde hace falta.
- **Servidor para casa** (PocketBase, Docker y Caddy), con guía en `docs/HOMELAB.md`. La regla se impone en el servidor: el destinatario no recibe ni reservas, ni aportaciones, ni presupuesto por ninguna vía de la API.
- Vista previa segura de enlaces (servicio `unfurl`, con protección anti-SSRF).
- Escaneo de secretos (gitleaks) en el pre-commit y en CI.

- **Plazas para cada persona.** Al crear el grupo se pone, si se quiere, quiénes sois (un nombre por línea). Cada uno tiene su sitio aunque no haya entrado, y ya se le puede poner presupuesto o apuntar sorpresas.
- **Entrar sin líos ni suplantaciones.** Cada persona recibe su enlace personal y entra con un toque («Eres Marta»). Con el enlace general, eliges tu nombre y esperas a que quien organiza te acepte comprobando un código de 4 cifras.
- **Hucha común.** Cada grupo elige cómo compra: hucha común, cada uno lo suyo o mixto. Los regalos se marcan como «Me lo reservo», «Para la hucha» o «Ya comprado» (en dos toques, con el precio ya puesto). La pantalla «Hucha» dice en frases cuánto te falta poner y a quién se lo das. Nadie paga sus propios regalos y nadie puede deducir lo que se gasta en él.
- **Regalos sorpresa:** apunta en la lista de alguien algo que no pidió; esa persona no lo verá.
- **Día de la entrega:** cuando quien organiza lo propone y otra persona confirma, cada uno puede ver qué le regalaron y de parte de quién, sin precios.
- **Ideas de regalo** por edad, gustos y presupuesto: del catálogo, o con IA gratuita si la activas en Ajustes (Gemini, Groq, OpenRouter, NVIDIA u Ollama; Claude, de pago).
- **«Que la IA lo ordene»** al importar un Excel con columnas raras.
- **App de Android:** la primera vez se pega el enlace de invitación.
- Cerrar la sesión en todos los dispositivos, anular enlaces y liberar plazas.

### Seguridad
- Auditoría de Fable aplicada: tiempo real sin opciones, API de administración fuera de Internet, límites por IP real, sorteo que quien organiza no puede amañar, tiempo total en la vista previa de enlaces y bloqueo de más rangos IPv6.

### Cambiado
- **Nuevo diseño «La bandeja»:**
  - la familia aparece en tarjetas con su presupuesto;
  - las listas se dividen en «Disponibles» y «Ya cogidos»;
  - el texto es más grande y con mejor contraste;
  - los botones tienen tres alturas fijas.
- La demo es ahora una familia de ejemplo (Alberto, Javier, Samira, Marta, Papá y una plaza libre, la Tía Loli). Con «Probar a entrar» se prueba el enlace general.
- Diseño ajustado tras estudiar referencias reales (Zola, Babylist, Elfster):
  - sin cuadrados vacíos donde iría una foto;
  - importes sin «,00»;
  - sombra solo en lo que está libre;
  - frases con el nombre en negrita;
  - pestaña «Hucha».
- «Mis compras» se agrupa por persona, tiene «Ya lo compré» en cada reserva y separa lo que falta por comprar, lo comprado y lo que va a medias.
- En el amigo invisible, el sobre se abre con un toque y lleva a la lista de la persona que te ha tocado.

## [0.1.0] - 2026-11-11 · Primera caja

Primera versión para probar en la demo pública, con datos ficticios y sin servidor.

### Añadido
- **Grupos por ocasión** (Navidad, cumpleaños, boda, bebé), con su cuenta atrás.
- **Una lista por persona**, con talla, color, cantidad, notas y tres niveles de ganas.
- **Sorpresa garantizada:** ves libre, reservado, comprado o a medias en las listas ajenas, y nada en la tuya.
- **Reservar, marcar comprado y soltar.** Las reservas respetan la cantidad de cada regalo.
- **Regalos a medias:** cada uno apunta lo que pone, se ve cuánto falta, se propone el reparto a partes iguales (cuadra al céntimo) y quién debe qué a quién.
- **Amigo invisible** con exclusiones y presupuesto; cada persona abre solo su sobre.
- **Listas de niños** llevadas por sus padres.
- **Rellenar desde un enlace** (Amazon o cualquier tienda) con los datos públicos de la página. En la demo, con datos de ejemplo.
- **Importar desde Excel o CSV**, adivinando las columnas, con vista previa y hasta 300 filas.
- **Mis compras:** todo lo reservado y lo comprado, con el total.
- **Invitar** por WhatsApp, copiando el enlace o con el panel de compartir del móvil.
- **Demo con «Ver como…»** para comprobar la sorpresa desde cada persona.
- Funciona sin conexión (PWA) y tiene modo oscuro.

## Modelos y su función

| Versión | Desarrollo | IA en el producto |
|---|---|---|
| 0.2.0 | Fable 5.1: dirección de arte («La bandeja») y auditoría de la regla y de seguridad. Opus 5.5: implementación. OpenCode (`deepseek-v4.1-flash-free`): catálogo de ideas | Gemini (gratis, por defecto), Groq, OpenRouter, NVIDIA u Ollama; Claude Haiku 5.5 de pago. Catálogo de ideas sin IA generado con OpenCode |
| 0.1.0 | Claude Opus 5.5 | Ninguna todavía: el mapeo de Excel va por sinónimos |

[Sin publicar]: https://github.com/BertMarti/lazo/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/BertMarti/lazo/releases/tag/v0.3.0
[0.2.0]: https://github.com/BertMarti/lazo/releases/tag/v0.2.0
[0.1.0]: https://github.com/BertMarti/lazo/releases/tag/v0.1.0
