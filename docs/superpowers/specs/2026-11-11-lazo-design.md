# Lazo · Diseño (spec)

Fecha: 2026-11-11 · Estado: aprobado en modo autónomo (el usuario pidió autonomía total; las decisiones se documentan aquí en vez de preguntarlas).

## 1. Qué es y para quién

Lazo es una app para que una familia comparta **listas de regalos** por ocasión (Navidad, un cumpleaños, una boda, un bebé). Cada miembro tiene su lista; los demás la ven y reservan o compran regalos de ella **sin que el dueño se entere**.

**Lo que dijo el usuario:** grupo con invitaciones; cada miembro con su lista; productos de Amazon, de un Excel subido o de enlaces de cualquier tienda; todo inventariado para que el resto lo vea y lo compre.

**Lo acordado con la sesión que me encargó el trabajo:** sorpresa garantizada, grupos por ocasión, invitación por enlace o WhatsApp sin contraseñas, extracción de enlaces por metadatos públicos, Excel/CSV con mapeo de columnas, alta manual, reservas y compras, regalos a medias, amigo invisible con exclusiones, IA gratuita por defecto, PWA y Android, backend multiusuario y demo pública sin backend.

**Lo que asumo yo:**
- Lo usan familias de 4 a 30 personas, con picos en noviembre y diciembre y casi nada el resto del año.
- Hay niños y mayores. Los niños no tienen cuenta: su lista la llevan sus padres. Los mayores necesitan entrar con un toque.
- Idioma: español (la interfaz lleva todos los textos en un único módulo para traducirla más adelante).

**Éxito:**
1. Una abuela entra desde un enlace de WhatsApp y ve las listas en menos de 30 segundos, sin escribir contraseñas.
2. Nadie puede saber qué le han reservado, ni desde la interfaz ni llamando a la API.
3. Pegar un enlace de una tienda rellena el título, la imagen y el precio cuando la página los publica.
4. La demo pública se entiende sola: con «Ver como…» se cambia de persona y se comprueba la sorpresa.

## 2. Backend: PocketBase autoalojado frente a Supabase

| | PocketBase en el homelab | Supabase (capa gratuita) |
|---|---|---|
| Coste | 0 € (Raspberry Pi que ya existe) | 0 € hasta 500 MB de base de datos y 50 000 usuarios activos al mes |
| Inactividad | Siempre encendido | **El proyecto se pausa tras 7 días sin uso**: justo lo que le pasa a una app de temporada |
| Datos de menores | Se quedan en casa | En un tercero (UE posible) |
| Permisos «no ves tu lista» | Reglas de API por colección (también se aplican a `expand` y a realtime) | RLS de Postgres (igual de potente, más SQL) |
| Entrar sin contraseña | Hooks JS propios (enlace de invitación, código de dispositivo); OTP por correo opcional | Magic link incluido, pero exige correo |
| Exposición | Hay que publicar un HTTPS (Caddy + DuckDNS, como HEIMDALL, o Cloudflare Tunnel) | Nada que exponer |
| Operación | Un contenedor y un volumen; copia de seguridad = copiar `pb_data` | Ninguna |

**Recomendación: PocketBase.** La pausa por inactividad de Supabase choca con un uso por temporadas, los datos de los niños se quedan en casa y encaja con el estilo de SHIELD-DNS y HEIMDALL (Docker Compose, imágenes con digest fijado, `no-new-privileges`, healthcheck, `.env.example` con `${VAR:?Falta…}`). El coste es exponer un puerto: se documenta con Caddy y Let's Encrypt sobre DuckDNS (opción A) y con Cloudflare Tunnel (opción B, sin abrir puertos). El cliente habla con el backend a través de la interfaz `Api`, así que un adaptador de Supabase podría añadirse más adelante sin tocar la interfaz.

## 3. Arquitectura

```
┌──────────── Cliente (React 19 + Vite 8, PWA / Capacitor Android) ───────────┐
│ ui/        pantallas y sistema de botones único                              │
│ core/      lógica pura y testeada: visibilidad, reparto, sorteo, importación, │
│            metadatos, dinero                                                 │
│ api/       interfaz Api ── PocketBaseApi (SDK oficial) │ DemoApi (memoria)   │
│ ai/        adaptador compatible con OpenAI (Gemini, Groq, OpenRouter :free,  │
│            NVIDIA NIM, Ollama) + Claude opcional                             │
└──────────────────────────────────────────────────────────────────────────────┘
                 │ HTTPS (mismo origen: PocketBase sirve la PWA desde pb_public)
┌──────────── Servidor (docker compose, homelab) ─────────────────────────────┐
│ caddy      TLS y cabeceras                                                   │
│ pocketbase colecciones + reglas + pb_hooks (unirse, código de dispositivo,   │
│            sorteo, proxy de enlaces)                                         │
│ unfurl     Node, solo red interna: descarga segura de páginas (anti-SSRF) y  │
│            extracción de Open Graph y JSON-LD                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

- La lógica de dominio vive una sola vez, en `src/core` (TypeScript). El sorteo se compila con esbuild a un módulo CommonJS que los `pb_hooks` cargan con `require()`, así que el servidor y la demo usan el mismo algoritmo.
- **Demo de GitHub Pages:** `VITE_DEMO=1` cambia `PocketBaseApi` por `DemoApi`, con datos ficticios (la familia Robles) y estado en memoria y `localStorage`. El extractor de enlaces de la demo devuelve fichas preparadas para unas URL de ejemplo y, para cualquier otra, explica que la extracción real necesita el servidor.

## 4. Modelo de datos (colecciones de PocketBase)

| Colección | Campos | Notas |
|---|---|---|
| `users` (auth) | `name`, `color`, `email?` | Sin correo obligatorio. Contraseña aleatoria de 32 bytes que genera el servidor y se guarda en el dispositivo |
| `groups` | `name`, `occasion` (navidad·cumpleanos·boda·bebe·otro), `date?`, `currency`, `owner` | |
| `memberships` | `group`, `user`, `role` (admin·member) | Única por (group, user) |
| `invites` | `group`, `tokenHash`, `expires`, `maxUses`, `uses`, `revoked`, `createdBy` | El token (128 bits) solo existe en el enlace; se guarda su SHA-256 |
| `lists` | `group`, `name`, `user?`, `managers[]`, `birthYear?`, `notes?` | Lista de un miembro (`user`) o lista gestionada de un niño (`user` vacío y `managers` = padres) |
| `items` | `list`, `title`, `url?`, `image?`, `priceCents?`, `currency`, `store?`, `size?`, `color?`, `priority` (1–3), `notes?`, `quantity` (1–20), `createdBy` | **Sin ningún campo de estado** |
| `claims` | `item`, `user`, `status` (reserved·bought), `units` | Reservas y compras |
| `contributions` | `item`, `user`, `amountCents`, `paid` | Regalos a medias |
| `draws` | `group`, `budgetCents?`, `exclusions` (json: pares), `createdBy`, `participants[]` | |
| `assignments` | `draw`, `giver`, `receiver` | Cada uno solo ve la suya |
| `deviceCodes` | `user`, `codeHash`, `expires` | Para entrar desde otro dispositivo |

### 4.1 Regla central: la sorpresa

`puedeVerEstado(viewer, list) = list.user != viewer`. Las listas de niños (sin `user`) muestran el estado a todos, padres incluidos: la sorpresa es para el niño, y los padres necesitan coordinar.

Reglas de PocketBase (resumen; el texto exacto está en la migración):
- `claims` y `contributions`, en list y view: `@request.auth.id != "" && item.list.group.memberships_via_group.user ?= @request.auth.id && item.list.user != @request.auth.id`.
- En create: lo mismo, más `user = @request.auth.id`. En update y delete: solo el propio `user`.
- `items`: lectura para los miembros del grupo; escritura para `list.user` o `list.managers`.
- `assignments`: lectura solo si `giver = @request.auth.id`; nadie crea, edita ni borra desde la API (solo el hook del sorteo).
- `invites` y `deviceCodes`: sin acceso desde la API (solo los hooks).
- Cálculos que podrían filtrar información (unidades libres, porcentaje cubierto) se hacen en el cliente a partir de `claims`; quien no puede leer `claims` no puede calcularlos. Ningún endpoint propio devuelve agregados de la lista del que pregunta.

## 5. Funciones

### 5.1 Grupos e invitaciones
- Crear un grupo: nombre, ocasión, fecha y moneda. Quien lo crea es admin y tiene su lista.
- Invitar: un enlace `https://<servidor>/#/unirse/<token>`, válido 14 días y 30 usos, que se puede revocar. Botones «Copiar», «WhatsApp» (`https://wa.me/?text=`) y el panel de compartir nativo.
- Unirse (`POST /api/lazo/join` {token, name}): valida el token (hash, caducidad, usos y revocación), crea el usuario si no hay sesión, la membresía y su lista, y devuelve el token de sesión y la credencial del dispositivo. Tiene límite de peticiones.
- Otro dispositivo: en Ajustes, «Entrar en otro móvil» genera un código de 8 caracteres válido 10 minutos y de un solo uso (`/api/lazo/device-code` y `/api/lazo/device-claim`). Si el servidor tiene SMTP, también vale entrar con el código que llega por correo (OTP de PocketBase).
- Admin: renombrar el grupo, expulsar a alguien, crear listas de niños y nombrar a quién las lleva.

### 5.2 Añadir regalos
1. **Enlace:** se pega una URL; `POST /api/lazo/unfurl` (con sesión) la pasa al servicio `unfurl`, que:
   - acepta solo `http` y `https`, puertos 80 y 443, sin credenciales en la URL y con un máximo de 2048 caracteres;
   - resuelve el DNS una vez y **rechaza IP privadas, de loopback, link-local, CGNAT, multicast, reservadas, IPv6 ULA y IPv4 mapeadas**; conecta a la IP ya comprobada (lookup fijado) y vuelve a comprobar en cada redirección (máximo 3);
   - pone un tiempo límite de 6 s, lee como mucho 1,5 MB, solo `text/html` y con un User-Agent identificable («LazoBot/1.0 (+repo)»), sin cookies;
   - extrae `og:title`, `og:image`, `product:price:amount`/`og:price:amount`, `og:site_name` y el `Product`/`Offer` de JSON-LD, y si no hay nada, `<title>`;
   - reconoce Amazon por el dominio, saca el ASIN y deja una URL canónica `https://www.amazon.<tld>/dp/<ASIN>` sin parámetros de seguimiento;
   - no hace scraping del HTML de producto (nada de selectores propios de cada tienda). Si la tienda no publica los metadatos, el formulario queda para completarlo a mano.
2. **Excel o CSV:** SheetJS se carga solo cuando hace falta. Primero se mapean las columnas con sinónimos (título/nombre/producto, precio/importe, enlace/url, talla, color, notas, prioridad, cantidad). Si hay dudas y la IA está activa, se le pasan las cabeceras y 3 filas de ejemplo (nunca la hoja entera) y devuelve el mapeo en JSON validado con Zod. Antes de importar se muestra una vista previa editable; como mucho 300 filas.
3. **A mano:** título, precio, enlace, talla, color, prioridad (1 «me encantaría», 2 «me gustaría», 3 «si sobra»), cantidad y notas.

### 5.3 Ver, reservar y comprar
- Lista ajena: cada regalo muestra «Libre», «Reservado por X», «Comprado» o «A medias · 60 %». Acciones: Reservar, Marcar comprado y Soltar.
- Lista propia: los regalos se muestran **sin estado** y la cabecera lo explica: «Aquí no verás lo que te han reservado. Es la gracia.».
- Mis compras: lo que he reservado o comprado en todos los grupos, con el total gastado.

### 5.4 Regalos a medias
- Sobre un regalo libre: «Hacerlo a medias» → cada participante apunta su aportación, o se elige «a partes iguales entre N».
- El reparto usa el método del mayor resto de Repartito: el total cuadra siempre al céntimo y es determinista.
- Cuando las aportaciones cubren el precio, el regalo pasa a «Cubierto». Quien compra lo marca y Lazo calcula quién le debe cuánto. Cada aportación se marca como pagada.

### 5.5 Amigo invisible
- El admin elige participantes, presupuesto y exclusiones (pares de personas que no pueden tocarse, por ejemplo una pareja).
- `POST /api/lazo/draw`: un barajado aleatorio con `crypto` y búsqueda con retroceso que garantiza que nadie se regala a sí mismo y que se respetan las exclusiones. Si no hay solución, da un error claro que dice qué restricciones lo impiden.
- El resultado se guarda en `assignments`; cada persona ve solo la suya. El organizador tampoco ve las ajenas.
- Volver a sortear borra el sorteo anterior y se avisa antes.

### 5.6 IA (opcional y gratuita por defecto)
- Proveedores con API compatible con OpenAI: Gemini (por defecto), Groq, OpenRouter `:free`, NVIDIA NIM (solo en Android, porque no admite CORS) y Ollama local. Claude es la opción de pago.
- La clave se guarda solo en el dispositivo y las llamadas van del cliente al proveedor. El servidor de Lazo nunca ve las claves.
- Usos:
  1. mapear columnas de un Excel;
  2. normalizar un producto (título limpio, tienda y categoría);
  3. sugerir regalos a partir de la **franja de edad** (nunca el nombre ni el año exacto), los gustos y el presupuesto, con la salida validada por Zod.
- Sin IA: el mapeo se hace con sinónimos y las ideas salen de un catálogo local por edades.

## 6. Diseño visual

Dirección «papel de regalo»: crema cálida, tinta verde abeto y rojo arándano como acento, con algún toque de dorado mate solo en los estados. Cada regalo es una **etiqueta** con su agujero y su cordel, y el estado se muestra como un sello. La tipografía, la retícula y los tokens se fijan en `DESIGN.md` con las skills de diseño. Hay un único sistema de botones (`ui/Button.tsx`) y está prohibido escribir `<button className>` a mano. Las capturas de móvil y de escritorio se hacen con Playwright en modo headless.

## 7. Seguridad y privacidad (lo que revisará Fable)

- Permisos del grupo en cada colección y la regla de la sorpresa (§4.1), también en `expand`, `filter`, realtime y en los hooks propios.
- Invitaciones: token de 128 bits guardado como hash, con caducidad, usos y revocación, límite de peticiones y comparación en tiempo constante.
- SSRF en `unfurl` (§5.2) y servicio solo en la red interna de Docker.
- Menores: sin cuenta, sin foto, solo el nombre de pila y el año de nacimiento opcional. A la IA solo le llega la franja de edad. Hay un botón para borrar la lista.
- CSP estricta, cabeceras de Caddy (como en HEIMDALL), `allowBackup=false` en Android y depuración del WebView desactivada en las releases.

## 8. Pruebas

- Vitest para `core`:
  - visibilidad;
  - reparto (las sumas cuadran y es determinista);
  - sorteo (propiedades: nadie se regala a sí mismo, se respetan las exclusiones y, si no hay solución, falla);
  - mapeo de columnas;
  - parser de metadatos con HTML de ejemplo;
  - comprobación de IP.
- Pruebas del servicio `unfurl` (`node --test`): IP bloqueadas, redirecciones, tamaño y tiempo límite.
- Pruebas de integración de las reglas de PocketBase: un script descarga el binario de PocketBase en CI y comprueba que el dueño recibe 0 reservas de su lista en list, view y expand.
- Playwright E2E sobre la demo: el flujo «Ver como…» y las capturas de móvil y escritorio.

## 9. Fases

1. **Núcleo y demo** (v0.1.0): `core` con tests, `DemoApi` y toda la interfaz; Pages.
2. **Servidor** (v0.2.0): migraciones de PocketBase, hooks, `unfurl`, compose, docs/HOMELAB.md y pruebas de reglas.
3. **IA gratuita** (v0.3.0): adaptador, mapeo de Excel e ideas.
4. **Android** (v0.4.0): Capacitor, APK en la Release.

Cada fase cierra con su CHANGELOG, su tag y su Release.

## 10. Fuera del MVP (YAGNI)

Notificaciones push, varios idiomas, comentarios en los regalos, seguimiento de precios, afiliados de Amazon, adaptador de Supabase e iOS.
