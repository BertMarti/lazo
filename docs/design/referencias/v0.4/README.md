# Referencias v0.4 (2026-11-11)

Referencias reunidas para el rediseño completo de la v0.4. Las capturas se hicieron con Playwright sin interfaz y **no se suben al repositorio**: las tomas son obra de sus autores (están en `.gitignore`). Para regenerarlas, ejecuta `node .impeccable/mocks/refs.mjs` en WSL. Lo que queda en el repositorio son los enlaces y lo que se aprendió de cada referencia. No se copia ningún diseño concreto.

| Archivo | Origen | Qué se toma |
|---|---|---|
| `dribbble-gifted.png` | [Gifted, de Ch Meharaqib](https://dribbble.com/shots/27683312-Gifted-Smart-Gift-Planning-Wishlist-App) | Portada organizada por personas, con la ocasión siguiente al lado de cada una |
| `dribbble-gift-people.png` | [Gift Planning App, de Muhammad Hammad Khan](https://dribbble.com/shots/27633230-Gift-Planning-App-Wishlist-People-Management-UI) | La persona como punto de entrada: avatar grande y lo que lleva |
| `dribbble-social-gifting.png` | [Social Gifting App, de vino_costa / Roobinium](https://dribbble.com/shots/27439965-E-Commerce-Social-Gifting-App-Wishlist-Gift-Funding) | El regalo a medias como barra de financiación sobre la foto |
| `dribbble-gift-organizer.png` | [Gift & Wishlist Organizer, de Creava](https://dribbble.com/shots/26753273-Gift-Wishlist-Organizer) | Fichas de regalo con la foto a sangre y el precio sobre ella |
| `dribbble-gift-social.png` | [Gift – Social Gifting, de Ikararahmad](https://dribbble.com/shots/27590276-Gift-Social-Gifting-Wishlist-Mobile-App-UI-Design) | Fila de avatares de amigos encima del tablero |
| `dribbble-wishlist-dream.png` | [Wishlist App Concept, de Anna](https://dribbble.com/shots/26368761-Wishlist-App-Concept-because-every-dream-deserves-its-place) | Tablero en dos columnas con fotos de distinta altura, como Pinterest |
| `dribbble-gift-planning.png` | [Gift-planning wishlist, de Ogma Conceptions](https://dribbble.com/shots/27722935-Gift-planning-wishlist-mobile-app) | Estados vacíos y de error con ilustración y una sola acción |
| `dribbble-wishlist-mobile.png` | [Wishlist Mobile App, de Victoria Grinevich](https://dribbble.com/shots/26679269-Wishlist-Mobile-App) | Celebración en «conseguido» y barra inferior con 4 secciones |
| `dribbble-wishlist-ui.png` | [Wishlist Mobile App UI, de Ronas IT](https://dribbble.com/shots/26072372-Wishlist-Mobile-App-UI-Design) | Perfil de persona con avatar grande y su colección debajo |
| `dribbble-wishlist-2023.png` | [Wishlist mobile app, de Svetlana](https://dribbble.com/shots/23916537-Wishlist-mobile-app) | Fichas con mucho aire y el precio destacado |
| `dribbble-wishlist-kz.png` | [Wishlist App for Kazakhstan, de Slanni](https://dribbble.com/shots/27547269-Wishlist-App-for-Kazakhstan) | Fondo claro, ilustración propia y tipografía con carácter |
| `dribbble-visual-wishlist.png` | [Visual Trip Wishlist, de Tino](https://dribbble.com/shots/26205924-Visual-Trip-Wishlist-App) | La foto como protagonista absoluta de la ficha |
| `dribbble-search-christmas.png` | [Búsqueda «christmas app» en Dribbble](https://dribbble.com/search/christmas-app) | Lo que hay que evitar: rojo y verde de manual, Papá Noel y copos de nieve |
| `pinterest-gift-list-app.png` | [Pinterest: «gift list app design»](https://www.pinterest.com/search/pins/?q=gift%20list%20app%20design) | Pinterest pide iniciar sesión, así que solo se ve la primera fila. Se usa su propia rejilla masonry como patrón de tablero de deseos |
| `behance-wishlist.png` | [Behance: «wishlist app»](https://www.behance.net/search/projects/wishlist%20app) | La captura salió en blanco porque Behance no carga sin sesión. No se usa |

## Lo que se repite y se adopta

1. **La persona es la puerta de entrada.** Se ve un avatar grande con su nombre y su progreso antes que cualquier lista.
2. **La foto manda.** Va a sangre en la ficha, con el precio encima y el estado en una frase debajo.
3. **Rejilla de deseos** en dos columnas en el móvil y en cuatro en el escritorio.
4. **Barra inferior** con 4 secciones en el móvil.
5. **Una celebración pequeña** al conseguir el regalo.

## Lo que se repite y se rechaza

- Morado y degradados de app genérica, o fondos negros con neón: casi todas las tomas caen ahí.
- Iconos 3D de regalo y emojis como sistema de iconos.
- La estética navideña de manual: rojo y verde, copos y Papá Noel.
