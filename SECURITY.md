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

**Principio que lo sostiene:** el servidor no calcula ni devuelve ningún agregado. Solo entrega filas, y cada fila es visible o no para X según su regla. Todo número que se ve en pantalla (barras, «tu parte», saldos) lo calcula el cliente con funciones puras (`src/core/hucha.ts`, `budget.ts`) sobre lo que X ha recibido. La única excepción deliberada es el día de la entrega.

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
| Cambiar de modo, de tesorero o de fecha | Ninguna validación mira el estado de las listas |
| Filtros, `expand`, `sort` y tiempo real por relaciones inversas | Cortafuegos de `_via_` y `@collection`, y tiempo real sin opciones (auditoría R-1) |
| Contadores (`totalItems`) | Se calculan después de aplicar la regla. Tus sorpresas no cuentan |

**Pruebas:**
- `test/core/hucha.test.ts`: no interferencia ∀X y el contraejemplo del greedy.
- `test/api/visibility.test.ts`: no interferencia ∀X sobre todas las lecturas de la API, reclamar una plaza, suplantación y entrega.
- `server/test/rules.test.mjs`: contra un PocketBase real, en CI.

## Plazas y entrada

| Riesgo | Medida |
|---|---|
| X entra como otra persona (o con un nombre nuevo) para ver su lista | **Enlace personal por plaza** de un solo uso. El **enlace general** deja la entrada **pendiente** (el solicitante no lee nada) hasta que un admin la acepta comparando un **código de 4 cifras** |
| Reclamar una plaza ocupada | Comprobación dentro de la transacción e índice único (grupo, cuenta). Una cuenta, una plaza |
| El admin «reenlaza» una plaza ajena | No existe esa operación. Solo puede **liberarla** (expulsa a la cuenta), nunca la suya ni la del dueño |
| Reservas hechas antes de que X entre | Al reclamar, la regla se las oculta desde su primera petición (antes no era miembro: no hay caché que arrastrar) |

**Riesgo residual declarado (R1):** quien reparte las llaves puede quedarse una. Un admin podría generarse el enlace de una plaza libre o aceptar una solicitud suya desde otro navegador. Sin verificación de identidad externa no se puede cerrar. Se mitiga con transparencia: cada plaza muestra cómo y cuándo se ocupó y quién la aceptó. El admin es de confianza para **quién entra**, nunca para **los datos**.

## Día de la entrega

Lo abren **dos llaves**: un admin propone y otra persona confirma. No hay apertura automática por fecha, porque el admin puede cambiar la fecha. Se revela solo lo **comprado** de tu plaza: el regalo y «de parte de quién» («de parte de todos» si salió de la hucha). **Nunca** precios, presupuesto, adelantos ni reservas, y las cuentas siguen siendo secretas después.

## Otras medidas

| Riesgo | Medida |
|---|---|
| Invitaciones | Token de unos 190 bits del que solo se guarda el hash, caducidad, usos, revocación y límite de peticiones; validación transaccional |
| Superusuario | Su API y su panel no se publican por Caddy y su login tiene límite de intentos. Se administra por la LAN o por VPN (HEIMDALL) |
| Sesiones | Token de 180 días renovable, «cerrar sesión en todos los dispositivos» (`/api/lazo/logout-all`) y sin contraseñas conocidas |
| SSRF | Solo `http` y `https` en los puertos 80 y 443. IP privadas, loopback, link-local, CGNAT, NAT64, 6to4 y Teredo bloqueadas en cada redirección, con DNS fijado. 6 s de tiempo **total** y 1,5 MB. Servicio en red interna y sin puertos |
| Amigo invisible | El sorteo se hace en el servidor y cada uno ve solo su asignación. Las exclusiones no pueden dejar un único reparto (quien organiza no puede amañarlo) y cada sorteo lleva número |
| Menores | Sin cuenta ni foto; nombre de pila y año opcional. A la IA solo le llega la franja de edad |
| Claves de IA | Solo en el dispositivo |
| Secretos | gitleaks en el pre-commit (`npm install` lo activa) y en CI. `.env` fuera de git y `server/data` fuera de git y de Docker |
| Navegador y Android | CSP, `frame-ancestors 'none'`, nada de HTML inyectado, `allowBackup=false` y WebView no depurable |

Auditoría de seguridad de Fable y su estado: `docs/security/AUDIT.md`.

## Versiones con soporte

Solo la última versión publicada.

## Modelos y su función

- **Claude Fable 5.1:**
  - auditoría de seguridad (`docs/security/AUDIT.md`);
  - diseño del modelo de plazas, hucha y entrega, con su análisis de fugas por deducción (la spec de plazas y hucha).
- **Claude Opus 5.5:** implementación de los arreglos y de las pruebas.
- **Modelos de IA del producto:** nunca reciben datos de autenticación, nombres de niños ni el contenido de otras listas.
