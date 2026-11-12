# Seguridad y privacidad

## Avisar de un fallo

Si encuentras un fallo de seguridad, **no abras una issue pública**. Usa [«Report a vulnerability»](https://github.com/BertMarti/lazo/security/advisories/new) en la pestaña Security del repo. Respondemos en menos de 7 días.

Interesan sobre todo:
- cualquier forma de que X vea o **deduzca** algo de su propia plaza: reservas, compras, aportaciones, presupuesto, sorpresas o gasto de la hucha;
- ver un grupo al que no perteneces o la asignación del amigo invisible de otra persona;
- ocupar una plaza ajena, reutilizar invitaciones o forzar códigos;
- SSRF a través del extractor de enlaces;
- exposición de datos de menores.

## La regla

**Sobre la plaza de X, todos los miembros menos X ven reservas, compras, aportaciones, presupuesto, sorpresas y lo gastado con la hucha.** Vale igual para todos, también para quien creó el grupo respecto a su propia plaza. La impone el servidor (reglas de API de PocketBase), no la interfaz.

**Principio que lo sostiene:** el servidor no calcula ni devuelve ningún agregado. Solo entrega filas, y cada fila es visible o no para X según su regla. Todo número que se ve en pantalla (barras, «tu parte», saldos) lo calcula el cliente con funciones puras (`src/core/hucha.ts`, `budget.ts`) sobre lo que X ha recibido. La única excepción deliberada es el día de la entrega. Sin sesión salen además dos cosas, ninguna con estado: el enlace de solo lectura (`/api/lazo/shared/{token}`) y las caras de `invite-info` (inicial y color). Ver «Otras medidas».

## Fugas por deducción (inferencia)

No basta con no enseñar lo de X: X tampoco debe poder **calcularlo restando**. El análisis completo está en `docs/superpowers/specs/2026-11-11-plazas-hucha-design.md` §7. Resumen:

| Lo que podría delatar | Cómo se evita |
|---|---|
| Total del bote, suma de presupuestos, gasto total, «% del grupo» | **No existen.** Ni en la API ni en pantalla. No hay presupuesto «por defecto» del grupo (quien lo pusiera sabría el suyo) |
| Tu parte de la hucha | **Nadie paga sus propios regalos:** el gasto en la plaza r se reparte entre los demás. Tu parte depende solo de plazas ajenas, que ya ves |
| Transferencias del ajuste de cuentas | **Tesorero y suplente** en vez de un reparto global mínimo. El greedy global de Repartito filtra (contraejemplo en la spec §6.4, convertido en prueba). Cada uno salda solo con el tesorero y, por los regalos del tesorero, con el suplente |
| Saldos o «al día» de los demás | No los ves. El tesorero ve los de la cuenta general **sin contar sus regalos**; el suplente, solo los de esa cuenta |
| Mensajes de error al reservar lo propio | Se rechaza **antes** de leer el estado, con el mismo texto esté libre o no. Un id de sorpresa propia responde igual que uno inexistente |
| Quitar un regalo propio reservado | Responde siempre lo mismo (204). Si tenía reservas, se oculta en vez de borrarse |
| Recrear un regalo quitado con su mismo `id` | Nadie salvo el superusuario elige ids al crear, y los lotes solo admiten `POST`: el upsert (`PUT`) se rechaza con 403. Antes, 400 o 200 delataban si la fila oculta seguía existiendo (V-26) |
| Cambiar de modo, de tesorero o de fecha | Ninguna validación mira el estado de las listas |
| Filtros, `expand`, `sort` y tiempo real por relaciones inversas | Cortafuegos de `_via_` y `@collection`, y tiempo real sin opciones (auditoría R-1) |
| Contadores (`totalItems`) | Se calculan después de aplicar la regla. Tus sorpresas no cuentan |

**Pruebas:**
- `test/core/hucha.test.ts`: no interferencia ∀X y el contraejemplo del greedy.
- `test/api/visibility.test.ts`: no interferencia ∀X sobre todas las lecturas de la API, reclamar una plaza, suplantación y entrega.
- `test/core/copia.test.ts`: la copia del grupo es idéntica la descargue quien la descargue y no lleva estados de nadie.
- `test/api/signout.test.ts`: cerrar sesión deja el navegador sin token, avisos, solicitudes pendientes ni clave de IA.

Contra un PocketBase real (en CI; `PB_BIN=… node --test server/test/*.test.mjs`):
- `server/test/rules.test.mjs`: cada vía de lectura (list, view, `expand`, filtros, `_via_`, `@collection`, recuentos, lotes, tiempo real) para cada miembro de la familia; quitar un regalo propio y recrearlo con su id (PB-10, V-26); hucha, pagos, entrega, sorteo, avisos (V-20) y `logout-all` (V-28).
- `server/test/flujo.test.mjs`: el flujo completo (grupo → invitación → plaza → reserva → hucha → ajuste de cuentas), comprobando en cada paso que la dueña de la lista no ve nada de lo suyo.
- `server/test/familia.test.mjs`, `plaza.test.mjs`, `alta.test.mjs`: entrada por enlace personal o general, plazas, códigos de dispositivo y `lazo-alta`.
- `server/test/share.test.mjs`: el enlace de solo lectura (sin estado, rotación, revocación, límite).
- `server/test/copia.test.mjs`: `restore` (solo regalos normales, todo o nada, solo en un grupo recién creado, límite de peticiones V-29).
- `server/test/backup.test.mjs` y `caddyfile.test.mjs`: copias cifradas del servidor y cabeceras y lista blanca de Caddy.

## Plazas y entrada

| Riesgo | Medida |
|---|---|
| X entra como otra persona (o con un nombre nuevo) para ver su lista | **Enlace personal por plaza** de un solo uso. El **enlace general** deja la entrada **pendiente** (el solicitante no lee nada) hasta que un admin la acepta comparando un **código de 4 cifras** |
| Reclamar una plaza ocupada | Comprobación dentro de la transacción e índice único (grupo, cuenta). Una cuenta, una plaza |
| El admin «reenlaza» una plaza ajena | No existe esa operación. Solo puede **liberarla** (expulsa a la cuenta), nunca la suya ni la del dueño |
| Reservas hechas antes de que X entre | Al reclamar, la regla se las oculta desde su primera petición (antes no era miembro: no hay caché que arrastrar) |

**Riesgo residual declarado (R1):** quien reparte las llaves puede quedarse una. Un admin podría generarse el enlace de una plaza libre o aceptar una solicitud suya desde otro navegador. Sin verificación de identidad externa no se puede cerrar. Se mitiga con transparencia: cada plaza muestra cómo y cuándo se ocupó y quién la aceptó. El admin es de confianza para **quién entra**, nunca para **los datos**.

**Quien aloja el servidor.** La regla vale para las cuentas de la app, no para quien administra la máquina. El superusuario de PocketBase, quien pueda leer `data/pb/data.db` y quien tenga las copias del servidor (y su `BACKUP_PASSPHRASE`) lo ven todo, también su propia lista. Es inherente a alojar Lazo en casa: si quien organiza es también quien instala, su sorpresa depende de que no mire. Si importa, que instale el servidor otra persona de la familia.

## Día de la entrega

Lo abren **dos llaves**: un admin propone y otra persona confirma. No hay apertura automática por fecha, porque el admin puede cambiar la fecha. Se revela solo lo **comprado** de tu plaza: el regalo y «de parte de quién» («de parte de todos» si salió de la hucha). **Nunca** precios, presupuesto, adelantos ni reservas, y las cuentas siguen siendo secretas después.

## Otras medidas

| Riesgo | Medida |
|---|---|
| Invitaciones | Token de unos 190 bits del que solo se guarda el hash, caducidad, usos, revocación y límite de peticiones; validación transaccional |
| Superusuario | Su API, su panel y la gestión de colecciones no se publican por Caddy (404) y su login tiene límite de intentos. PocketBase solo escucha en `127.0.0.1:8090` del servidor: se administra por túnel SSH o por VPN (HEIMDALL) |
| Homelab | Cabeceras HSTS, CSP, `nosniff`, `X-Frame-Options` y COOP/CORP en Caddy. Con Cloudflare Tunnel, la IP real llega a PocketBase para el límite de intentos. Copias diarias de `pb_data` sin red, legibles solo por root y con rotación (`docs/HOMELAB.md`) |
| Sesiones | Token de 180 días renovable y sin contraseñas conocidas. En Ajustes → Sesión, «Cerrar sesión en este móvil» borra el token, los avisos vistos, las solicitudes pendientes, el último grupo y la clave de IA; «Cerrar sesión en todos los móviles» además llama a `/api/lazo/logout-all`, que anula todos los tokens de la cuenta (también conexiones de tiempo real abiertas). Ambos piden confirmación |
| Enlace de solo lectura | Nombre, ocasión y regalos pedidos, sin ids, estado, sorpresas ni retirados: lo que ya ve la dueña. Token de unos 190 bits en el fragmento (`#/ver/…`, no viaja en `Referer`) del que solo se guarda el hash; crear otro rota el anterior, se puede revocar y liberar la plaza lo borra. Misma respuesta para falso, rotado y revocado, `no-store` y 30 peticiones por minuto |
| Copia del grupo (archivo) | Solo grupo, plazas y los regalos que pidió cada persona: nada de reservas, compras, aportaciones, sorpresas, retirados ni presupuestos, de ninguna lista (V-27). El archivo no contiene nada que su dueño no sepa ya. `restore` solo crea regalos normales en un grupo recién creado, nunca lee lo que hay, y tiene límite de 3 llamadas por minuto (V-29) |
| Tiempo real | Solo topics `coleccion/*` o `coleccion/id`, sin opciones; cada evento pasa la regla de la colección para quien escucha. Al quitar un regalo propio la dueña no recibe nada, esté cogido o no |
| Lotes (`/api/batch`) | Solo `POST` y sin ids elegidos (V-26): un `PATCH`, `PUT` o `DELETE` en lote responde 403 sin mirar nada (PB-14) |
| SSRF | Solo `http` y `https` en los puertos 80 y 443. IP privadas, loopback, link-local, CGNAT, NAT64, 6to4 y Teredo bloqueadas en cada redirección, con DNS fijado. 6 s de tiempo **total** y 1,5 MB. Servicio en red interna y sin puertos |
| Amigo invisible | El sorteo se hace en el servidor y cada uno ve solo su asignación. Las exclusiones no pueden dejar un único reparto (quien organiza no puede amañarlo) y cada sorteo lleva número |
| Menores | Sin cuenta ni foto; nombre de pila y año opcional. A la IA solo le llega la franja de edad |
| Claves de IA | Solo en el dispositivo |
| Secretos | gitleaks en el pre-commit (`npm install` lo activa) y en CI. `.env` fuera de git y `server/data` fuera de git y de Docker |
| Navegador y Android | CSP, `frame-ancestors 'none'`, nada de HTML inyectado, `allowBackup=false` y WebView no depurable |
| APK publicado | Solo el de **release** firmado. El de `scripts/build-apk.sh` es de depuración (`debuggable`, clave de la máquina) y solo sirve para probar. Ver «Firmar el APK» |

## Firmar el APK

Se publica solo el APK que sale de `scripts/firmar-apk.sh` (en WSL: `bash scripts/wsl.sh 'bash scripts/firmar-apk.sh 1.0.0'`):

1. La clave vive **fuera del repo**, en `~/.lazo-keys/lazo-release.jks` (alias `lazo`, RSA 4096) con su contraseña en `~/.lazo-keys/password` (`chmod 600`, carpeta `chmod 700`). Si no existe, el script la crea la primera vez. Hay que guardarla a buen recaudo: sin ella Android no acepta una actualización encima de la app instalada. `*.jks` y `*.keystore` están en `.gitignore`.
2. `npm run build`, `npx cap sync android` y `./gradlew assembleRelease` (una build de release no es `debuggable`).
3. `zipalign` y `apksigner sign`; luego `apksigner verify --print-certs` imprime el DN y el SHA-256 del certificado, que deben coincidir con los de la release anterior.
4. Falla si `capacitor.config.json` no lleva `webContentsDebuggingEnabled: false`. Imprime el `sha256sum` del APK para las notas de la release.

Antes de subirlo: `aapt2 dump badging dist-apk/lazo-X.Y.Z.apk | grep -c debuggable` debe dar 0.

Auditoría de seguridad de Fable y su estado: `docs/security/AUDIT.md`.

## Versiones con soporte

Solo la última versión publicada.

## Modelos y su función

- **Claude Fable 5.2 (`claude-fable-5-2`):**
  - auditoría de seguridad (`docs/security/AUDIT.md`);
  - diseño del modelo de plazas, hucha y entrega, con su análisis de fugas por deducción (la spec de plazas y hucha).
- **Claude Opus 5.5:** implementación de los arreglos y de las pruebas.
- **Modelos de IA del producto:** nunca reciben datos de autenticación, nombres de niños ni el contenido de otras listas.
