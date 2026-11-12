# Lazo · Plazas, modos de compra, hucha y día de la entrega (spec de decisión)

Fecha: 2026-11-11 · Estado: decidido, listo para implementar · Amplía `2026-11-11-lazo-design.md` (no lo sustituye).
Dirección visual: `docs/design/FABLE-DIRECCION.md` («La bandeja»).

**LA REGLA.** Sobre la plaza de X, todos los miembros menos X ven reservas, compras, aportaciones y presupuesto. Vale para todos, también para quien creó el grupo respecto a su propia plaza. La impone el servidor.

**Principio de diseño que lo sostiene todo (P0).** El servidor **no calcula ni devuelve ningún agregado**. Solo entrega filas, y cada fila es visible o invisible para X según una regla de API. Todo número que pinta la interfaz (barras, «tu parte», saldos) se calcula **en el cliente con funciones puras** sobre las filas que X ha recibido. Si una fila depende de datos de la plaza de X, X no la recibe; por tanto ningún número que X vea puede depender de lo suyo. La única excepción es el endpoint de la entrega (§8), que es la revelación deliberada.

Vocabulario: **plaza** = una `list` de tipo persona. **L_r** = «cuenta de r»: todo el dinero de hucha gastado en la plaza r. **Pagadores de r** = miembros del grupo menos quien ocupa r.

---

## 1. Decisiones

| # | Decisión | Descartado y por qué |
|---|---|---|
| D1 | **Una plaza es una `list` con `kind = "person"`**; libre si `user = ""`. La regla existente `list.user != @request.auth.id` ya da el comportamiento pedido: mientras está libre la ven todos; al reclamarla, su ocupante deja de verla sin tocar ningún dato. | Colección `plazas` aparte: duplica `lists` y obliga a reescribir todas las reglas. |
| D2 | **Dos formas de entrar, un solo mecanismo de reclamación (transacción en el hook):** (a) **enlace personal por plaza**, de un solo uso: entra al instante («Eres Marta»); (b) **enlace general del grupo**: elige plaza libre o escribe nombre → queda **pendiente** y no es miembro (no lee nada) hasta que un admin lo acepta comparando un **código de 4 cifras** que el solicitante ve en su pantalla. | Solo enlace general sin aprobación: Marta entra como «Papá» en una ventana privada y ve su lista. Solo enlaces personales: el usuario pidió expresamente elegir plaza o escribir nombre. Código/PIN por plaza: es un secreto más que repartir por el mismo canal que el enlace, sin ganar nada. Aprobación sin código: el admin no distingue dos solicitudes para «Papá». |
| D3 | **Nadie reclama una plaza ocupada** (comprobación `user = ""` dentro de la transacción + índice único `(group, user)`): una cuenta, una plaza por grupo. Una sesión que ya es miembro no puede pedir otra plaza. | — |
| D4 | **Solo un admin libera una plaza, nunca la suya ni la del dueño del grupo.** Liberar expulsa a esa cuenta del grupo. La plaza conserva su historial (`prevUser`) y, al volver a reclamarse, las reservas, compras y pagos de la cuenta anterior pasan a la nueva: la identidad es la plaza; la cuenta es solo la llave. | «Reenlazar» una plaza ocupada con un enlace del admin: daría al admin la sesión de cualquiera y, con ella, la vista de su propia lista. Prohibido para siempre. |
| D5 | **Regalos sorpresa** (`items.secret`): lo que otro apunta en la plaza de X no lo ve X. Hace falta para que una plaza libre (lista vacía) admita reservas, y sirve para «le he comprado algo que no pidió». | Dejar que otros añadan regalos visibles: al reclamar, X vería «ideas» con huella de quién las puso. |
| D6 | **Quitar un regalo propio nunca falla ni cambia de respuesta**: si tiene reservas o compras se oculta (`removed`) en vez de borrarse; X recibe el mismo 204. | Rechazar el borrado «porque ya está comprado»: es un spoiler. Borrar en cascada: se pierde un gasto de la hucha. |
| D7 | **Modo de compra por grupo** (`buyMode`): `hucha`, `individual`, `mixto`. Cambiarlo nunca falla y solo afecta a acciones nuevas (una validación del tipo «no puedes, hay regalos para la hucha» delataría los de la plaza del admin). | Validar el cambio contra el estado: fuga. |
| D8 | **Todas las transiciones de un regalo pasan por un endpoint transaccional** (`POST /api/lazo/gift`); `claims` deja de ser escribible por la API. Cierra la carrera de la última unidad (hoy marcada `ponytail:` en el hook) y concentra las validaciones de modo. | Reglas `createRule/updateRule`: no expresan «quedan unidades» ni las transiciones por modo. |
| D9 | **«A medias» se conserva tal cual** (`contributions`) para repartir un regalo entre unos pocos, solo en `individual` y `mixto` y solo sobre regalos que no van a la hucha. En modo `hucha` no existe: la hucha ya es un «a medias» entre todos. Se salda directamente con quien compró (como hoy), fuera de la hucha. | Fundir aportaciones y hucha en un único libro de gastos con participantes: más elegante, más código, cero beneficio para el usuario. |
| D10 | **X no paga sus propios regalos.** El gasto de hucha en la plaza r se reparte a partes iguales entre los pagadores de r. La parte de cada uno depende solo de cuentas L_r con r ≠ él: datos que ya ve. | Reparto entre todos, X incluido: su cuota contendría S_X/n → la deduce al instante. |
| D11 | **La hucha la lleva un tesorero (T); las cuentas de la plaza del tesorero las lleva un suplente (T2).** Cada persona salda **solo con T** (y, por los regalos de T, con T2). Los pagos solo los ven sus dos partes. | Transferencias mínimas greedy globales mostrando a cada uno solo las suyas: **filtran** (contraejemplo en §6.4). Deudas por parejas sin compensar: sin fugas pero hasta n(n−1)/2 transferencias. Tesorero único: el tesorero deduciría lo gastado en él. |
| D12 | **No hay tabla pública «quién ha puesto cuánto».** Cada uno ve lo suyo; T ve el estado de cobro de todos sin contar su propia plaza; T2 ve el de la plaza de T. El desglose **por destinatario** sí lo ven todos menos el destinatario. | Tabla global de aportaciones o «al día / pendiente» por persona: el total de Papá incluye su parte de mis regalos; incluso un «al día» que cambia sin causa visible me delata una compra. |
| D13 | **Presupuesto solo por plaza y puesto por otros.** No existe «presupuesto por defecto del grupo» ni «objetivo total de la hucha»: quien lo fijara conocería el suyo. «Poner el mismo a todos» lo aplica a todas las plazas menos la de quien lo pulsa. | — |
| D14 | **Roles de la hucha (T y T2) se fijan una vez** y apuntan a plazas, no a cuentas. No se cambian desde la app. | Cambio de tesorero validado contra «hay pagos apuntados»: esa validación delataría al tesorero que hay pagos sobre su plaza. Queda para v2 con traspaso explícito. |
| D15 | **Día de la entrega: dos llaves.** Un admin propone abrir; cualquier otro miembro confirma. Sin apertura automática por fecha (la fecha la edita el admin; una apertura automática sería una llave única). La app lo sugiere al admin cuando pasa la fecha. | Apertura automática por `date`: el admin cambia la fecha y se ve lo suyo. Apertura solo del admin: igual. |
| D16 | **Qué se revela:** de lo **ya comprado** en mi plaza, el regalo (título, foto, enlace) y **de parte de quién** (quien lo regaló; los que fueron a medias; o «de parte de todos» si salió de la hucha). **Nunca** precios pagados, presupuesto, aportaciones, quién adelantó ni lo reservado sin comprar. Es opcional: no se descarga hasta que la persona lo pide. | Revelar precios: convierte dar las gracias en comparar. Relajar la regla de `claims` tras la entrega: PocketBase no tiene permisos por campo y saldría `paidCents`. |
| D17 | La revelación es **un endpoint de solo lectura que calcula al vuelo** (`GET /api/lazo/received/{group}`); no se materializa nada. | Colección `thanks` rellenada al abrir: hay que sincronizarla con compras posteriores y deshacerla al cerrar. |

### Riesgo residual declarado (R1)

Quien reparte las llaves puede quedarse una: un admin puede generarse el enlace personal de una plaza libre, o aceptar una solicitud suya hecha desde otro navegador, y mirar su lista desde esa segunda cuenta. Ningún mecanismo sin verificación de identidad externa lo impide (tampoco la doble aprobación: bastan dos cómplices o dos navegadores). Se mitiga con **transparencia, no con más fricción**: cada plaza muestra a todo el grupo cómo y cuándo se ocupó y quién la aceptó; una plaza de más o una plaza «ya ocupada» cuando su dueño real intenta entrar se ve al momento. El admin es de confianza para **quién entra**, nunca para **los datos**: su cuenta no ve su plaza por ninguna vía.

Fuera de alcance: alguien que coge el móvil desbloqueado de otro o recibe su código de «entrar en otro móvil».

---

## 2. Plazas

### 2.1 Máquina de estados de una plaza

```
                 crear grupo (plazas[]) / admin «Añadir plaza»
                                  │
                                  ▼
        ┌──────────────────────  LIBRE  ◄─────────────────────────────┐
        │  user = ""  · la ven todos · admiten presupuesto,            │
        │  regalos sorpresa, reservas y compras                        │
        │                                                              │
 enlace personal (1 uso)          enlace general: «Soy Marta»           │ admin libera
        │                                  │                           │ (no la suya, no la del dueño;
        │                                  ▼                           │  expulsa la cuenta; prevUser = cuenta)
        │                    LIBRE + SOLICITUD PENDIENTE               │
        │              (el solicitante NO es miembro: no lee nada)     │
        │                  │ admin acepta        │ admin rechaza /     │
        │                  │ (código coincide)   │ solicitante cancela │
        ▼                  ▼                     ▼                     │
      OCUPADA  ◄───────────┘                   LIBRE                   │
   user = cuenta · via = creator|personal|approved ────────────────────┘
   su ocupante deja de ver estado, presupuesto, sorpresas y hucha de esta plaza

 Nombre nuevo (si allowNewNames): SOLICITUD PENDIENTE sin plaza → admin acepta → se crea la plaza ya OCUPADA.
 LIBRE → borrada por un admin (solo si no tiene compras apuntadas; el admin nunca es su destinatario).
```

Al pasar LIBRE → OCUPADA no se toca ninguna reserva, compra ni presupuesto: siguen ahí para los demás y la regla los oculta al nuevo ocupante desde su primera petición (nunca tuvo acceso antes: no era miembro).

### 2.2 Flujo de entrada

1. **Crear grupo.** Nombre, ocasión, fecha, modo de compra y, opcional, «¿Quiénes sois?» (nombres, uno por línea). El creador ocupa su plaza (`via = creator`); cada nombre es una plaza libre.
2. **Invitar.** Pantalla «Invitar» (solo admin): una fila por plaza libre con «Enviar su enlace» (WhatsApp / copiar), y debajo «Enlace para todos» (general). Recomendación en pantalla: el personal.
3. **Enlace personal.** `#/unirse/<token>` → «Navidad en familia te espera, Marta» → un botón → dentro.
4. **Enlace general.** Lista de plazas libres («Soy Marta») y, si `allowNewNames`, «No estoy en la lista». Al elegir: pantalla de espera con el código. El admin ve la solicitud con el nombre pedido y el código; acepta o rechaza.
5. Si la sesión ya es miembro del grupo: «Ya estás en este grupo como Marta.» y se abre el grupo.

---

## 3. Modos de compra y estados de un regalo

`groups.buyMode`: **`hucha`** (todo sale del bote), **`individual`** (cada uno lo suyo), **`mixto`** (se elige regalo a regalo). Por defecto `mixto`.

Cada unidad cogida de un regalo es una fila de `claims` con `kind` (`self` | `pot`) y `status` (`reserved` | `bought`). Regalo con `quantity = N`: hasta N filas.

| Estado (texto en tarjeta) | Datos | Modos |
|---|---|---|
| **Libre** | sin fila (quedan unidades) y sin aportaciones | todos |
| **Me lo reservo** — «Lo reserva Samira» | `self` + `reserved`, `user` = quien reserva | individual, mixto |
| **Para la hucha** — «Para la hucha · lo apuntó Samira» | `pot` + `reserved`, `user` = quien lo apuntó | hucha, mixto |
| **Ya comprado** — «Lo compró Papá» / «Comprado con la hucha · adelantó Papá» | `bought` + `paidCents` (precio real) + `paidBy` (quién lo pagó o adelantó) + `kind` (de la hucha o individual) | todos |
| **A medias** / **Cubierto** (subestados de Libre) | `contributions` > 0, sin fila en `claims` | individual, mixto |

### 3.1 Máquina de estados (por unidad)

```
                       reserve(self)                       buy
              ┌────────────────────────► ME LO RESERVO ─────────────┐
              │   ◄──── release (su dueño)   │  ▲                   ▼
              │                    move(pot) │  │ move(self)     YA COMPRADO
   LIBRE ─────┤                              ▼  │              (self | pot)
     ▲        │        reserve(pot)                                 │
     │        └────────────────────────► PARA LA HUCHA ─────────────┘
     │            ◄──── release (cualquiera menos X)     buy        │
     │                                                              │
     └──────────────── unbuy: vuelve al estado reservado del mismo kind ◄─┘
   LIBRE ── buy directo (crea la fila ya comprada) ──────────────► YA COMPRADO
   LIBRE ⇄ A MEDIAS ⇄ CUBIERTO (aportaciones) ── buy(self) por un aportante ──► YA COMPRADO
```

### 3.2 Quién puede qué (siempre: miembro del grupo y **no** ocupante de la plaza)

| Acción | Quién | Validaciones |
|---|---|---|
| `reserve` kind=self | cualquiera | modo ≠ hucha · quedan unidades · sin aportaciones en el regalo · regalo no retirado |
| `reserve` kind=pot | cualquiera | modo ≠ individual · quedan unidades · sin aportaciones |
| `release` | self: su `user` · pot: cualquiera | solo `reserved` |
| `move` self→pot / pot→self | self→pot: su `user` · pot→self: cualquiera (pasa a ser suyo) | solo `reserved` · el destino debe estar permitido por el modo |
| `buy` | desde self: su `user` · desde pot: cualquiera · directo: cualquiera (kind según modo; en mixto lo elige) | `paidCents` entero 0…100 000 000 · `paidBy` ∈ pagadores de esa plaza · si hay aportaciones: kind=self y `user` debe ser aportante |
| `edit` (precio / quién pagó) y `unbuy` | `user`, `paidBy`, el tesorero de esa cuenta (T, o T2 para la plaza de T) o un admin | solo `bought` |

«Pagado con el dinero del bote» no es un concepto aparte: es `paidBy` = el tesorero (o el suplente, si el regalo es para el tesorero). Los regalos comprados no se bloquean nunca: los saldos son vivos (§6).

Cambiar de modo con regalos ya cogidos: las filas existentes siguen siendo válidas y se pueden comprar, soltar o deshacer; solo se impide **crear** filas del `kind` que el modo nuevo no admite.

### 3.3 Presupuesto y «comprometido»

- **Comprometido de la plaza r** = Σ filas `pot`: `paidCents` si `bought`; precio de lista (0 si no tiene) si `reserved`.
- En modo **individual** (no hay hucha) se suman además las filas `self` y las aportaciones, como hace hoy `committedOn`.
- En **mixto**, lo individual y lo a medias se pinta aparte bajo la barra: «Además, por su cuenta: 49,00 €». No resta del presupuesto de la hucha.
- **Restante** = presupuesto − comprometido. Barra: `BudgetBar` existente, sin cambios.

---

## 4. Modelo de datos (PocketBase 0.40)

Migración nueva `server/pb/pb_migrations/1762860000_plazas_hucha.js`. Las colecciones base siguen **sin** campos `created`/`updated` (un `updated` en `lists` o `groups` sería un canal lateral). Abreviaturas: `ME = @request.auth.id`.

### 4.1 `groups` (campos nuevos)

| Campo | Tipo | Notas |
|---|---|---|
| `buyMode` | select `hucha`·`individual`·`mixto`, required | existentes → `individual` |
| `allowNewNames` | bool | permitir «No estoy en la lista» |
| `treasurer` | relation → `lists`, max 1 | plaza del tesorero. Solo hook |
| `deputy` | relation → `lists`, max 1 | plaza del suplente. Solo hook |
| `revealAskedBy` | relation → `users`, max 1 | admin que propone abrir. Solo hook |
| `revealedAt` | number int | ms; 0 = cerrada. Solo hook |

```
listRule / viewRule: members ?= ME                                    (sin cambio)
createRule:          ME != ""                                         (sin cambio; el hook fija lo demás)
updateRule:          admins ?= ME
                     && @request.body.members:isset = false && @request.body.admins:isset = false
                     && @request.body.owner:isset = false && @request.body.treasurer:isset = false
                     && @request.body.deputy:isset = false && @request.body.revealAskedBy:isset = false
                     && @request.body.revealedAt:isset = false
deleteRule:          owner = ME                                       (sin cambio)
```

### 4.2 `lists` (campos nuevos)

| Campo | Tipo | Notas |
|---|---|---|
| `kind` | select `person`·`child`, required | existentes: `user != ""` → `person`; resto → `child` |
| `claimedAt` | number int | ms; 0 si libre |
| `via` | select `creator`·`personal`·`approved` | cómo se ocupó (visible a todo el grupo: transparencia R1) |
| `approvedBy` | relation → `users` | quién aceptó o generó el enlace |
| `prevUser` | relation → `users` | última cuenta que la ocupó (para traspasar al reclamar) |

```
listRule / viewRule: group.members ?= ME
createRule:  group.admins ?= ME && user = "" && claimedAt = 0 && via = "" && approvedBy = "" && prevUser = ""
             && ((kind = "child" && managers ?= ME) || (kind = "person" && managers:length = 0 && birthYear = 0))
updateRule:  group.members ?= ME
             && (user = ME || managers ?= ME || (kind = "person" && user = "" && group.admins ?= ME))
             && @request.body.group:isset = false && @request.body.user:isset = false
             && @request.body.managers:isset = false && @request.body.kind:isset = false
             && @request.body.claimedAt:isset = false && @request.body.via:isset = false
             && @request.body.approvedBy:isset = false && @request.body.prevUser:isset = false
deleteRule:  (kind = "child" && managers ?= ME) || (kind = "person" && user = "" && group.admins ?= ME)
índices:     CREATE INDEX idx_lists_group ON lists (`group`)                                   (existe)
             CREATE UNIQUE INDEX idx_lists_group_user ON lists (`group`, user) WHERE user != ''
```

Hook `onRecordDeleteRequest('lists')`: 400 «Esta plaza tiene compras apuntadas.» si alguna fila de `claims` de la lista está `bought` (quien borra nunca es su destinatario: no hay fuga).

### 4.3 `items` (campos nuevos)

| Campo | Tipo | Notas |
|---|---|---|
| `secret` | bool | regalo sorpresa: lo apuntó alguien que no es el dueño de la lista |
| `removed` | bool | el dueño lo quitó pero tenía reservas, compras o aportaciones |

```
VIS  = list.group.members ?= ME && (list.user != ME || (secret = false && removed = false))
OWN  = secret = false && removed = false && (list.user = ME || list.managers ?= ME)
SURP = secret = true && createdBy = ME && list.user != ME

listRule / viewRule: VIS
createRule:  list.group.members ?= ME && createdBy = ME && removed = false
             && ((secret = false && (list.user = ME || list.managers ?= ME))
                 || (secret = true && list.kind = "person" && list.user != ME))
updateRule:  list.group.members ?= ME && (OWN || SURP)
             && @request.body.list:isset = false && @request.body.createdBy:isset = false
             && @request.body.secret:isset = false && @request.body.removed:isset = false
deleteRule:  list.group.members ?= ME && (OWN || SURP)
```

Hook `onRecordDeleteRequest('items')`:
- regalo propio (`secret = false`) con alguna fila en `claims` o `contributions` → `removed = true`, guardar y responder **204 sin borrar** (misma respuesta que un borrado real, D6);
- sorpresa (`secret = true`) con alguna fila `bought` → 400 «Ya está comprado: deshaz la compra antes.» (quien borra no es el destinatario).

Para los demás, un regalo `removed` se pinta «Marta lo ha quitado de su lista» y conserva su estado.

### 4.4 `claims` (cambia)

| Campo | Tipo | Notas |
|---|---|---|
| `item` | relation → `items`, required, cascade | existe |
| `user` | relation → `users`, required | quien reserva / quien lo apuntó para la hucha |
| `kind` | select `self`·`pot`, required | **nuevo**; existentes → `self` |
| `status` | select `reserved`·`bought`, required | existe |
| `units` | number int 1…1 | siempre 1 |
| `paidBy` | relation → `users` | **nuevo**; obligatorio si `bought` |
| `paidCents` | number int 0…100000000 | **nuevo**; precio real; existentes `bought` → `paidBy = user`, `paidCents = item.priceCents` |
| `boughtAt` | number int | **nuevo**; ms |

```
SEE_ITEM = item.list.group.members ?= ME && item.list.user != ME        (sin cambio)
listRule / viewRule: SEE_ITEM
createRule / updateRule / deleteRule: null       (solo POST /api/lazo/gift)
índices: DROP idx_claims_item_user (único) · CREATE INDEX idx_claims_item ON claims (item)
```

Se elimina el hook `onRecordCreateRequest('claims')` actual.

### 4.5 `contributions` y `budgets`

Esquema y reglas **sin cambios**. Hook nuevo `onRecordCreateRequest('contributions')`, en este orden: (1) si `list.user = auth` → 403 fijo, antes de leer nada más; (2) 400 si `group.buyMode = "hucha"` o si el regalo tiene alguna fila en `claims` («Este regalo ya está cogido.»).

### 4.6 `payments` (nueva) — dinero que pasa entre una persona y quien lleva la hucha

| Campo | Tipo | Notas |
|---|---|---|
| `group` | relation → `groups`, required, cascade | |
| `from` | relation → `users`, required | quien entrega |
| `to` | relation → `users`, required | quien recibe |
| `amountCents` | number int 1…100000000, required | |
| `sub` | bool | `false`: cuenta general (con T) · `true`: cuenta de la plaza de T (con T2) |
| `at` | number int | ms, lo fija el cliente; informativo |

```
listRule / viewRule: from = ME || to = ME
createRule:  (from = ME || to = ME) && from != to && group.members ?= from && group.members ?= to
             && ((sub = false && (from = group.treasurer.user || to = group.treasurer.user))
                 || (sub = true && (from = group.deputy.user || to = group.deputy.user)
                     && from != group.treasurer.user && to != group.treasurer.user))
updateRule:  null                                  (se borra y se vuelve a apuntar)
deleteRule:  from = ME || to = ME
índices:     CREATE INDEX idx_pay_group ON payments (`group`)
```

El tesorero nunca es parte de un pago `sub = true`; por tanto nunca ve uno.

### 4.7 `invites` (campo nuevo) y `joinRequests` (nueva)

`invites.list`: relation → `lists`, opcional, cascade. Con valor = enlace personal (`maxUses = 1`). Reglas: todas `null` (sin cambio).

`joinRequests`:

| Campo | Tipo | Notas |
|---|---|---|
| `group` | relation → `groups`, required, cascade | |
| `user` | relation → `users`, required, cascade | la cuenta que pide (aún no es miembro) |
| `list` | relation → `lists`, cascade | plaza pedida; vacío si es nombre nuevo |
| `name` | text max 40, required | nombre de la plaza pedida o nombre nuevo |
| `code` | text, pattern `^\d{4}$` | lo ve el solicitante y el admin |
| `status` | select `pending`·`approved`·`rejected`, required | |
| `decidedBy` | relation → `users` | |

```
listRule / viewRule: user = ME || (status = "pending" && group.admins ?= ME)
createRule / updateRule / deleteRule: null                      (solo hooks)
índices: CREATE UNIQUE INDEX idx_joinreq_group_user ON joinRequests (`group`, user)
```

### 4.8 `users`, `draws`, `assignments`, `deviceCodes`

Sin cambios. Un solicitante pendiente no es miembro: `users.listRule` no le deja ver a nadie y nadie le ve a él (el admin lee su nombre en `joinRequests.name`).

### 4.9 Invariantes que la migración y las pruebas deben mantener

- **I1.** Ningún registro visible para X tiene una relación **directa** hacia un registro oculto para X. Los datos ocultos (`claims`, `contributions`, `budgets`, `payments`, `items` secretos o retirados) solo son alcanzables desde lo visible por relaciones **inversas**, que corta el cortafuegos `_via_|@collection` existente.
- **I2.** Ningún campo de `groups`, `lists`, `users` ni de un `item` visible para su dueño cambia como efecto de una acción sobre la plaza de ese dueño (ni contadores, ni fechas, ni banderas).
- **I3.** Toda escritura que X dirige a su propia plaza se rechaza con la misma respuesta **antes** de leer `claims`, `contributions` o `budgets`.

---

## 5. Endpoints y hooks (`server/pb/pb_hooks/lazo.pb.js`)

Todos exigen sesión salvo `invite-info` y `join`. Toda mutación va en `$app.runInTransaction` (SQLite serializa escrituras: las comprobaciones son atómicas). Mensajes de rechazo por token: siempre el mismo («Esta invitación no existe o ha caducado. Pide un enlace nuevo.»).

| Endpoint | Quién | Qué hace y qué valida |
|---|---|---|
| hook `onRecordCreateRequest('groups')` (amplía el actual) | sesión | Fija `owner`, `members`, `admins`, `buyMode` (por defecto `mixto`), `revealedAt = 0`; crea la plaza del creador (`kind = person`, `user`, `via = creator`, `claimedAt`). Lee `body.plazas` (array ≤ 40 de textos ≤ 40): recorta, quita vacíos y repetidos (comparación sin mayúsculas ni tildes) y el nombre del creador; crea una plaza libre por nombre. |
| `POST /api/lazo/invite` `{group, list?}` | admin | Sin `list`: enlace general (14 días, 30 usos). Con `list`: debe ser `kind = person`, `user = ""`, del grupo → revoca enlaces personales anteriores de esa plaza y crea uno de **1 uso**, 14 días; guarda `createdBy`. |
| `POST /api/lazo/invite-info` `{token}` | público, 20/min | Devuelve `{group: {name, occasion, date}, organizer: nombre, personal: {list, name} \| null, free: [{list, name}], allowNewNames}`. `free` solo en enlaces generales. Nada más (ni recuentos ni regalos). |
| `POST /api/lazo/join` `{token, list?, name?}` | público, 10/min | Valida token. Crea la cuenta si no hay sesión (como hoy). Si la sesión ya es miembro → 400 «Ya estás en este grupo.». **Personal:** en transacción, la plaza sigue `user = ""` → `reclamar(plaza, cuenta, 'personal', invite.createdBy)`; `uses++`. Devuelve sesión + `{group}`. **General:** exactamente uno de `list` (plaza libre de ese grupo) o `name` (requiere `allowNewNames`; no puede coincidir con una plaza existente → «Ya hay una plaza con ese nombre: elígela en la lista.»). Máximo 1 solicitud por cuenta y grupo y 20 pendientes por grupo. Crea `joinRequests` con `code` aleatorio de 4 cifras; `uses++`. Devuelve sesión + `{pending: true, request, code}`. **No** añade a `members`. |
| `POST /api/lazo/join-decide` `{request, accept}` | admin del grupo | Solicitud `pending`. Rechazar → `status = rejected`. Aceptar, en transacción: si lleva `list`, sigue `user = ""` (si no → 400 «Esa plaza ya está ocupada.»); si lleva `name`, crea la plaza; `reclamar(plaza, cuenta, 'approved', admin)`; `status = approved`, `decidedBy`. |
| `POST /api/lazo/plaza-release` `{list}` | admin | `kind = person`, `user != ""`, `user != auth.id`, `user != group.owner`. En transacción: quita la cuenta de `members` y `admins`; `prevUser = user`; `user = ""`; `claimedAt = 0`; `via = ""`; revoca sus enlaces personales. No borra reservas, compras ni pagos. |
| `POST /api/lazo/gift` `{action, item?, claim?, kind?, paidCents?, paidBy?}` | miembro, no destinatario | Ver §3.2. Orden obligatorio: (1) cargar regalo y lista; si no existe **o** es sorpresa de la plaza del que llama → 404 idéntico; (2) si `list.user = auth.id` → 403 «No puedes reservar regalos de tu propia lista.» **antes de leer `claims`**; (3) pertenencia al grupo; (4) en transacción: modo, unidades (`COUNT(claims) < quantity`), aportaciones, permisos de la acción. Devuelve la fila de `claims`. |
| `POST /api/lazo/hucha-roles` `{group, treasurer, deputy}` | admin | Solo si **ambos campos están vacíos** (se fijan una vez). Dos plazas distintas, `kind = person`, ocupadas, del grupo. |
| `POST /api/lazo/reveal` `{group, action}` | ver fila | `ask`: admin → `revealAskedBy = auth`. `confirm`: miembro con `auth != revealAskedBy` y `revealAskedBy != ""` → `revealedAt = now`, `revealAskedBy = ""`. `cancel`: admin → `revealAskedBy = ""`. `close`: admin → `revealedAt = 0`. |
| `GET /api/lazo/received/{group}` | miembro con plaza | Ver §8. |

`reclamar(plaza, cuenta, via, quien)` (función de `lib/`): `user = cuenta`, `claimedAt = now`, `via`, `approvedBy = quien`; `group.members += cuenta`; si la cuenta es nueva, `users.name = plaza.name`; si `prevUser != ""` y `prevUser != cuenta`: reasigna en ese grupo `claims.user`, `claims.paidBy`, `contributions.user`, `payments.from`, `payments.to` de `prevUser` a `cuenta`; `prevUser = ""`.

Límites de peticiones nuevos: `POST /api/lazo/invite-info` 20/60 s; `POST /api/lazo/gift` 60/60 s (`@auth`); `GET /api/lazo/received` 10/60 s (`@auth`).

Nota de revisión: el lote (`/api/batch`) está activado para importar Excel y el cortafuegos solo inspecciona la URL exterior. Los lotes no admiten lecturas y `expand` respeta las reglas, así que no hay fuga conocida; se añade una prueba que lo fija (§9.3, PB-14).

---

## 6. Hucha y ajuste de cuentas

### 6.1 Reparto

Para cada plaza r (persona ocupada, persona libre o niño):

- `pagadores(r)` = miembros del grupo menos el ocupante de r (si r está libre o es de un niño: todos).
- `S_r` = Σ `paidCents` de las filas `pot` + `bought` de la lista r.
- `cuota_i(r)` = `equalShares(S_r, pagadores(r))[i]` (mayor resto de `core/split.ts`: cuadra al céntimo y es determinista).
- `adelanto_i(r)` = Σ `paidCents` de esas filas con `paidBy = i`.
- `λ_i(r) = adelanto_i(r) − cuota_i(r)`. Σ sobre los pagadores de r = 0: **cada L_r es un libro cerrado del que su destinatario no forma parte.**

Si entra alguien nuevo, las cuotas se recalculan solas (cálculo vivo). Compras pagadas por una cuenta que ya no está: su adelanto sigue contando y aparece como «(ya no está)»; lo liquida el tesorero a mano.

`ponytail:` reparto a partes iguales entre todos los miembros. Si hace falta que alguien no participe o pese distinto, `byWeights` ya lo soporta: añadir `groups.potWeights`.

### 6.2 Dos cuentas, dos cajas

- **Cuenta general** (caja de T): todas las L_r salvo la de la plaza de T.
- **Cuenta de los regalos de T** (caja de T2): solo L_T. T no participa ni la ve.

Saldo pendiente de la persona j (positivo = le falta poner; negativo = hay que devolverle):

```
general(j)  = − Σ_{r ≠ plaza(j), r ≠ plaza(T)} λ_j(r)  − pagos(j→T, sub=false) + pagos(T→j, sub=false)      para j ≠ T
aparte(j)   = − λ_j(plaza(T))                          − pagos(j→T2, sub=true) + pagos(T2→j, sub=true)      para j ∉ {T, T2}
```

T y T2 no se pagan a sí mismos: lo que les toca queda en su caja (lo que reciben menos lo que devuelven cuadra exactamente con su propio λ).

Transferencias: como mucho **una por persona con T** y **una con T2** → n−1 + n−2 en total, y casi siempre menos (quien está a cero no hace nada). Con grupos de 1–2 personas no hay nada que saldar.

### 6.3 Pseudocódigo (`src/core/hucha.ts`, funciones puras sobre las filas que el servidor ha entregado al que mira)

```
type Ctx = { me, members: Id[], lists: GiftList[], items: Item[], claims: Claim[], payments: Payment[],
             treasurer?: Id /*usuario*/, deputy?: Id, treasurerList?: Id }

ledger(r: GiftList, ctx):
  sharers = ctx.members.filter(m => m !== r.user)
  rows    = ctx.claims.filter(c => c.kind === 'pot' && c.status === 'bought' && itemOf(c).list === r.id)
  spent   = sum(rows.paidCents)
  quota   = equalShares(spent, sharers)
  adv     = groupSum(rows, by paidBy)
  return { spent, quota, adv, sharers }

lambda(j, r, ctx) = (L = ledger(r, ctx); (L.adv[j] ?? 0) - (L.quota[j] ?? 0))

// Lo que j tiene pendiente. Solo se llama con j = me, o siendo me el tesorero/suplente de esa cuenta.
due(j, ctx):
  mainLists = ctx.lists.filter(r => r.user !== j && r.id !== ctx.treasurerList)
  general   = -sum(mainLists.map(r => lambda(j, r, ctx)))
              - paid(ctx.payments, j, ctx.treasurer, false) + paid(ctx.payments, ctx.treasurer, j, false)
  aparte    = (ctx.treasurerList && j !== ctx.treasurer && j !== ctx.deputy)
              ? -lambda(j, listById(ctx.treasurerList), ctx)
                - paid(ctx.payments, j, ctx.deputy, true) + paid(ctx.payments, ctx.deputy, j, true)
              : 0
  return { general, aparte }

// «Tu parte» por destinatario, para el desglose.
myShares(ctx) = ctx.lists.filter(r => r.user !== ctx.me)
                         .map(r => ({ list: r, spent: ledger(r).spent, mine: ledger(r).quota[ctx.me] ?? 0,
                                      advanced: ledger(r).adv[ctx.me] ?? 0 }))

// Previsión: lo ya apuntado para la hucha y aún sin comprar, a precio de lista.
forecast(ctx) = sum over r ≠ mía of equalShares(committedPot(r), sharers(r))[me]

// Tabla de cobro: solo la calcula quien lleva esa caja.
collectTable(ctx):
  if ctx.me === ctx.treasurer: return members.filter(j => j !== me).map(j => ({ j, due: due(j).general }))
  if ctx.me === ctx.deputy:    return members.filter(j => j !== me && j !== ctx.treasurer).map(j => ({ j, due: due(j).aparte }))
  return []
```

Corrección por construcción: `ctx.claims` nunca contiene filas de la plaza de `me` (regla `SEE_ITEM`), así que si alguien llamara a `ledger` con su propia plaza obtendría `spent = 0`; aun así `due` y `myShares` la excluyen explícitamente. `ctx.payments` solo contiene pagos en los que `me` es parte.

### 6.4 Por qué no el greedy global de Repartito

Cuatro personas: A (la que mira), B, C, D. Visible para A: un regalo para B de 90 € que pagó C → A, C y D ponen 30. Con solo eso, A calcula saldos A −30, C +60, D −30 y espera «paga 30 € a C».
Oculto para A: un regalo para A de 120 € que pagó D → B, C y D ponen 40. Saldos reales: A −30, B −40, C +20, D +50. El greedy global empareja B→D 40, A→D 10, A→C 20.
A ve «paga 10 € a D y 20 € a C». No coincide con lo que podía predecir: deduce que **D adelantó dinero de un regalo suyo** y acota su importe. Mostrar a cada uno «solo sus transferencias» de un cálculo global **filtra**.

Con tesorero C: A paga 30 a C, exactamente lo que A calcula sola; todo lo demás no la toca. Lo que A ve es función solo de datos que A ya tiene.

El greedy de Repartito se conserva donde no hay nada que esconder: saldar un regalo **a medias** entre sus aportantes (`core/split.ts → settle`, ya existe).

### 6.5 Qué ve cada uno en la pantalla «Hucha»

| Quién mira | Ve |
|---|---|
| Cualquiera (i) | Su parte por destinatario (todos menos él), lo que ha adelantado, lo que ha entregado, lo que le falta o hay que devolverle, y **a quién**: T (general) y T2 (regalos de T). Previsión con lo apuntado sin comprar. Sus propios pagos. |
| Tesorero T | Lo anterior (sin la línea de T2) + tabla de cobro de la cuenta general: por persona, pendiente / al día / a devolver. Rótulo: «Sin contar tus regalos: esos los lleva Papá.» |
| Suplente T2 | Lo de cualquiera + tabla de cobro de «Regalos de Samira». |
| Nadie | Total de la hucha, suma de presupuestos, gasto total, saldos de otros, tabla global de aportaciones, porcentajes del grupo. |

En la **lista de r vista por los demás** (no por r): presupuesto, comprometido, restante con barra, y «Hucha de Marta: 124,90 € entre 4 · 31,23 € cada uno · adelantó Samira».

---

## 7. Fugas por inferencia

X = quien mira; «lo suyo» = presupuesto de su plaza, S_X, quién compró o adelantó, qué regalos sorpresa hay, si algo está reservado.

### 7.1 Por colección / endpoint

| Vista / endpoint | Qué recibe X | Por qué no puede deducir lo suyo |
|---|---|---|
| `GET groups` | nombre, fecha, modo, miembros, admins, plazas de T y T2, estado de la entrega | Ningún campo es un agregado ni cambia con acciones sobre una plaza (I2). `buyMode` se cambia sin validar contra datos (D7). |
| `GET lists` | todas las plazas: nombre, ocupante, `via`, `claimedAt` | Sin contadores ni estado. |
| `GET items` | regalos de otros (todos) y los suyos **no secretos y no retirados** | Los sorpresa y los retirados de su plaza no existen para X (ni en `totalItems`). Sus regalos visibles no llevan estado. Quitar uno responde igual tenga o no reservas (D6). |
| `GET claims` | filas de plazas ajenas | `SEE_ITEM` excluye su plaza en list, view, `expand`, filtros, orden, `totalItems` y tiempo real. |
| `GET contributions` | ídem | Misma regla. |
| `GET budgets` | presupuestos de plazas ajenas | `SEE_LIST`. No hay presupuesto de grupo ni total (D13). Crear uno sobre su plaza falla igual exista o no (la regla se evalúa antes de insertar). |
| `GET payments` | pagos en los que X es parte | Importes de la cuenta general: función de L_r con r ≠ X y r ≠ plaza(T). Si X = T: ve lo que cada uno le entrega, que por definición excluye L_T. Los pagos `sub` nunca tienen a T como parte. |
| `GET joinRequests` | las suyas; las pendientes si es admin | No tocan listas. |
| `GET users` | nombre y color de su grupo | — |
| Tiempo real (`/api/realtime`) | eventos de registros que su regla le deja ver | PocketBase evalúa la regla por evento, también en borrados; el cortafuegos corta `_via_` en la suscripción. |
| `POST /api/lazo/gift` sobre su plaza | 403 fijo (regalo propio) o 404 fijo (id de sorpresa: indistinguible de inexistente) | Se responde antes de leer estado (I3). |
| `POST contributions` / `budgets` sobre su plaza | rechazo fijo de la regla | Ídem. |
| `DELETE items/{suyo}` | 204 siempre | D6. |
| `POST /api/lazo/hucha-roles` | éxito o «ya están elegidos» | Depende solo de campos visibles de `groups`. |
| `POST /api/lazo/plaza-release`, `DELETE lists/{libre}` | — | Quien lo hace nunca es el destinatario de esa plaza. |
| `POST /api/lazo/reveal` | cambia campos visibles de `groups` | No lee listas. |
| `GET /api/lazo/received/{group}` cerrado | 403 fijo | Comprueba `revealedAt` antes de leer nada. |
| `GET /api/lazo/received/{group}` abierto | título, foto, enlace y «de parte de» de lo comprado | Revelación deliberada (§8). Sin precios, presupuesto, adelantos ni reservas. |
| `POST /api/lazo/invite-info` | nombres de plazas libres | Público con token; sin estado. |
| `/api/batch` | solo escrituras; cada una pasa su regla | Sin lecturas; `expand` respeta reglas. |

### 7.2 Por agregado en pantalla

| Agregado | Qué ve X | Por qué es seguro |
|---|---|---|
| Presupuesto / comprometido / restante de una plaza | de todas menos la suya; en su tarjeta, el aviso de sorpresa sin hueco de barra | Función de filas de esa plaza, que X sí ve. |
| «N regalos · M libres» | de otros; en la suya solo «N regalos» (los que apuntó él) | M se calcula con `claims`; los sorpresa no cuentan para X. |
| «Tu parte» | Σ_{r≠X} cuota_X(r) | D10: X no es pagador de su plaza. |
| «Has adelantado / has entregado» | sus compras y sus pagos | Datos propios. |
| «Te falta / hay que devolverte» | `due(X)` | Función de L_r (r ≠ X) y de sus pagos. |
| A quién paga | T, y T2 por los regalos de T | Lo fija el rol, no los datos: no cambia con ninguna compra. |
| Total de la hucha, gasto total, suma de presupuestos, % del grupo | **no existen** | Contendrían S_X o B_X. La pantalla dice «sin contar lo tuyo» donde suma varias plazas. |
| Saldos o estado («al día») de otros | **no existen** para X; T ve los de la cuenta general; T2 los de L_T | El saldo completo de j contiene λ_j(X). T solo ve la parte sin L_T. |
| Quién es acreedor | X solo ve quién **adelantó** cada compra ajena | Adelantos sobre su plaza son filas ocultas. |
| Pestaña «Hucha» visible | si el modo ≠ individual o X ve alguna fila `pot` | Si las únicas filas `pot` son de su plaza, X no ve pestaña; los demás sí. Ninguna de las dos condiciones lee lo suyo. |
| Número de miembros y cambios de cuota al entrar alguien | sí | Es público y no depende de lo suyo. |
| Mis compras | sus reservas, compras y aportaciones en plazas ajenas | Datos propios. |
| Lista de niño / plaza libre | todo, para todos | No tienen cuenta que proteger; al ocuparse una plaza libre, su ocupante empieza ciego. |

### 7.3 Canales laterales revisados

- **Reclamar con reservas previas.** La cuenta nueva no era miembro antes: no hay caché, ni suscripción, ni historial que arrastrar. Los regalos que otros apuntaron son todos `secret`.
- **Alternar de plaza.** Una cuenta no puede tener dos plazas ni soltar la suya; liberar la expulsa. Volver con otro nombre exige de nuevo enlace personal o aprobación.
- **Cambio de modo, de roles, de fecha.** Ninguno valida contra el estado de las listas.
- **Pagar de más al tesorero.** Si j entrega a T, por error, también lo que debía a T2, T ve un importe que no cuadra con su tabla y podría sospechar. El importe va prerrellenado y la pantalla separa las dos cuentas; el error humano equivale a decirlo en voz alta. Aceptado.
- **Sorteo del amigo invisible.** Independiente; sin cambios.
- **Tiempos de respuesta.** Los rechazos sobre la plaza propia salen antes de consultar estado; no hay rama que haga más trabajo según lo oculto.

---

## 8. Día de la entrega

**Estado.** `groups.revealedAt = 0` cerrada; `> 0` abierta. `revealAskedBy != ""` = propuesta pendiente de una segunda persona.

**Flujo.** Pasada la fecha, el admin ve en el grupo «Ya ha pasado el 24. ¿Abrís la entrega?» → `ask`. Todos los demás ven «Alberto quiere abrir la entrega» con «De acuerdo» → `confirm` (cualquiera menos quien propuso). El admin puede proponerlo antes de la fecha: la segunda llave es la que protege. `close` vuelve a cerrar (no borra lo ya visto).

**`GET /api/lazo/received/{group}`** — orden estricto:

1. Sesión y pertenencia al grupo; si no → 403.
2. `group.revealedAt > 0`; si no → 403 «La entrega aún no está abierta.» **Sin leer listas ni reservas.**
3. `plaza` = lista `kind = person` con `user = auth.id` en ese grupo.
4. Para cada fila de `claims` con `status = bought` de regalos de esa plaza (incluidos sorpresa y retirados), devuelve **solo**:

```json
{ "title": "Chal de lana merino", "image": "https://…", "url": "https://…",
  "from": [{ "id": "…", "name": "Samira" }], "fromAll": false }
```

- `kind = self` sin aportaciones → `from = [claim.user]`.
- `kind = self` con aportaciones en el regalo → `from` = aportantes.
- `kind = pot` → `from = []`, `fromAll = true` («De parte de todos»).

Nunca: `paidCents`, `paidBy`, presupuesto, aportaciones, filas `reserved`, nada de otras plazas. Las reglas de `claims`, `contributions`, `budgets` y `payments` **no cambian** con la entrega: las cuentas siguen siendo secretas después.

**Opcional.** El cliente no llama al endpoint hasta que la persona toca «Ver qué me regalaron». Quien prefiera no saberlo, no lo sabe.

---

## 9. Pruebas que deben existir

Familia de las pruebas: `FAMILY = [alberto (creador, admin, tesorero), javier, samira (suplente), marta, papa]`. «∀X» = `for (const who of FAMILY)`.

### 9.1 Unitarias (Vitest, `src/core`)

| Id | Archivo | Caso |
|---|---|---|
| U-1 | `status.test.ts` | Tabla parametrizada `(modo, filas, aportaciones) → estado` para los 5 estados × 3 modos, con `quantity` 1 y 3. |
| U-2 | `status.test.ts` | `transiciones(modo, estado, actor)` devuelve exactamente las acciones de §3.2; ninguna para el ocupante. |
| U-3 | `budget.test.ts` | Comprometido por modo: hucha/mixto solo `pot` (reservado a precio de lista, comprado a precio real, sin precio = 0); individual suma `self` y aportaciones. |
| U-4 | `hucha.test.ts` | `ledger`: Σ cuotas = `spent` al céntimo para importes 1, 99, 100, 10 001 y 2…7 pagadores; determinista ante el orden de entrada. |
| U-5 | `hucha.test.ts` | ∀X: `myShares` y `due` no cambian si se añaden, quitan o modifican filas de la plaza de X (aunque se le pasen por error). |
| U-6 | `hucha.test.ts` | Cierre: tras aplicar todos los pagos sugeridos (cada j a T y a T2), `due` de todos es 0 y la caja de T y la de T2 quedan en su propio λ. |
| U-7 | `hucha.test.ts` | Plaza libre y lista de niño: pagan todos. Al ocuparse la plaza libre, su ocupante no paga la suya y sí las demás. |
| U-8 | `hucha.test.ts` | Tesorero: `collectTable` no depende de L_T. Suplente: solo L_T. Resto: tabla vacía. |
| U-9 | `hucha.test.ts` | Contraejemplo de §6.4 como prueba de regresión: lo que ve A es idéntico con y sin el regalo oculto de 120 €. |
| U-10 | `plazas.test.ts` | Normalización de nombres (mayúsculas, tildes, espacios), duplicados, máximo 40. |
| U-11 | `visibility.test.ts` | `canSeeStatus` con plaza libre (todos), ocupada (todos menos su ocupante), niño (todos). |

### 9.2 Demo (`DemoApi`, Vitest)

| Id | Caso |
|---|---|
| D-1 | **No interferencia** ∀X: dos mundos idénticos salvo en lo de X (reservas, compras `pot` y `self`, presupuesto, sorpresas, retirados, aportaciones y pagos `sub` si X es tesorero). El volcado de **todas** las llamadas de lectura de `Api` como X es `deepEqual` en ambos. |
| D-2 | Reclamar una plaza libre con presupuesto, 2 sorpresas, una reserva y una compra de hucha previas: la nueva ocupante recibe lista vacía, sin presupuesto ni reservas; los demás siguen viendo lo mismo. |
| D-3 | Suplantación: reclamar plaza ocupada falla; una cuenta miembro no puede pedir otra plaza; solicitud pendiente no lee ningún grupo; nombre nuevo con `allowNewNames = false` falla; nombre igual a una plaza existente falla. |
| D-4 | Admin y su plaza: como Alberto, su lista no trae estado, presupuesto ni sorpresas; no puede liberar su plaza; liberar la de Papá le expulsa y la plaza conserva sus compras; al reclamarla otra cuenta, hereda reservas y pagos. |
| D-5 | Cada transición de §3.2 por modo: permitidas pasan, el resto lanza `ApiError`; última unidad con dos intentos: gana uno. |
| D-6 | Quitar un regalo propio con y sin reservas: mismo resultado para el dueño; los demás lo ven «retirado» con su estado. |
| D-7 | Entrega: cerrada → error fijo; `ask` + `confirm` del mismo usuario falla; abierta → solo comprados, sin precios; hucha → `fromAll`. |
| D-8 | Cambiar `buyMode` con filas existentes nunca falla. |

### 9.3 Contra PocketBase real (`server/test/rules.test.mjs`, `node --test`)

| Id | Caso |
|---|---|
| PB-1 | ∀X (amplía la prueba actual): su plaza no devuelve `claims`, `contributions`, `budgets`, sorpresas ni retirados por list, view, `expand`, `filter`, `sort`, `fields`, `totalItems`, `_via_`, `@collection` ni tiempo real (creación, edición **y borrado**). |
| PB-2 | **No interferencia** ∀X contra el servidor: se vuelcan todas las colecciones y endpoints GET como X, se ejecuta como otros un guion sobre la plaza de X (reservar, pasar a hucha, comprar, deshacer, presupuesto, sorpresa, pago `sub`), se vuelca de nuevo: idéntico byte a byte. |
| PB-3 | Reclamar con historial: plaza libre «Marta» con presupuesto, sorpresa, reserva y compra de hucha; entra con enlace personal; PB-1 se cumple para la cuenta nueva desde su primera petición. |
| PB-4 | Enlace personal: un solo uso (el segundo falla con el mensaje genérico); generar otro revoca el anterior; no se puede generar para plaza ocupada. |
| PB-5 | Enlace general: tras `join` la cuenta no está en `members` y recibe 0 registros de `groups`, `lists`, `items`, `claims`, `users`; ve solo su `joinRequests`. Aceptar → entra. Rechazar → sigue fuera. |
| PB-6 | Suplantación: (a) Marta, con su sesión, pide la plaza «Papá» → 400; (b) dos solicitudes para «Papá», se acepta una, la otra → «ya está ocupada»; (c) carrera: dos `join` personales simultáneos sobre la misma plaza → uno gana (índice único); (d) no admin llama a `join-decide`, `invite`, `plaza-release` → 403; (e) `PATCH lists/{id}` con `user`, `kind`, `via`, `claimedAt` → rechazado. |
| PB-7 | Admin y su plaza: Alberto no puede `plaza-release` de la suya ni de la del dueño; `PATCH groups` con `treasurer`, `deputy`, `revealedAt`, `members` → rechazado; PB-1 y PB-2 pasan con X = Alberto. |
| PB-8 | `gift` ∀X sobre su plaza: mismo código y cuerpo con el regalo libre, reservado, comprado y con aportaciones; id de sorpresa propia ≡ id inexistente. |
| PB-9 | `gift` transiciones y modos (tabla de §3.2); 20 `reserve` concurrentes sobre un regalo de 1 unidad → exactamente 1 fila. |
| PB-10 | `DELETE items` del dueño: 204 con y sin reservas; con reservas queda `removed` y el dueño recibe 404 al pedirlo. |
| PB-11 | `budgets` ∀X: crear sobre su plaza devuelve lo mismo exista o no un presupuesto. |
| PB-12 | `payments`: solo las partes los ven; `sub = false` exige a T como parte; `sub = true` exige a T2 y rechaza a T; un tercero no puede crear ni borrar; T nunca recibe un pago `sub` ni por tiempo real. |
| PB-13 | Cada agregado de la hucha ∀X, calculado con `core/hucha` sobre lo que el servidor entrega a X: «tu parte», `due`, previsión, desglose y tabla de cobro coinciden con el valor esperado **y** no cambian al variar lo de X (reutiliza el guion de PB-2). |
| PB-14 | `/api/batch` con `expand` o `filter` que contengan `_via_`: no devuelve nada de la plaza propia. |
| PB-15 | Entrega: `received` cerrado → 403 sin variar con el estado; `ask` por no admin → 403; `confirm` por quien propuso → 403; abierta → para cada X solo sus comprados, sin `paidCents` ni `paidBy`; `claims` de su plaza siguen ocultos después. |
| PB-16 | `hucha-roles`: solo una vez; plazas distintas y ocupadas; no admin → 403. |
| PB-17 | `invite-info` con token falso, caducado o revocado: mismo error; con válido no devuelve ids de usuarios ni recuentos. |

E2E (Playwright, demo): «Ver como…» recorriendo a los cinco en Grupo, Lista y Hucha y comprobando que la propia plaza no pinta barra, ni cifras, ni línea en el desglose.

---

## 10. Interfaz y microcopy

Reglas de «La bandeja» que aplican aquí: una pantalla, un trabajo; frases con sujeto y verbo; un `primary` por vista; dinero en Atkinson 700 `tabular-nums`; sin exclamaciones, emojis, rejillas de cifras ni tarjetas dentro de tarjetas; el chip dorado con ojo tachado (`VisibilityNote`) es el único y significa «esto es secreto para alguien».

### 10.1 Crear grupo

Hoja de 5 campos, el último plegable:

| Campo | Etiqueta | Ayuda |
|---|---|---|
| Nombre | ¿Cómo se llama? | Navidad en familia |
| Fecha | ¿Cuándo es? | — |
| Modo | ¿Cómo compráis? — segmentado **Hucha común** · **Cada uno lo suyo** · **Mixto** | Hucha común: «Ponéis dinero entre todos y los regalos salen de ahí.» · Cada uno lo suyo: «Cada regalo lo paga quien lo reserva.» · Mixto: «Se decide regalo a regalo.» |
| Plazas | ¿Quiénes sois? (opcional) | «Un nombre por línea. Cada uno tendrá su sitio aunque aún no haya entrado.» |
| Casilla | Dejar que alguien entre con un nombre que no esté en la lista | «Tendrás que aceptarlo tú.» |

Botón: `primary` **Crear grupo**.

### 10.2 Tarjeta de plaza libre (en Grupo)

Misma `MemberCard`, avatar con contorno discontinuo (sin relleno de sabor). Meta: **«Aún no ha entrado»**. Fila 2: `BudgetBar` o «Poner presupuesto». Para el admin, botón `ghost sm` **Invitar**. Bajo el nombre de toda plaza ocupada, en la pantalla «Quién está» (menú de cabecera): «Entró el 12 nov con su enlace» / «Entró el 12 nov · la aceptó Alberto».

### 10.3 Invitar (hoja, solo admin)

```
Invitar                                              ✕
Envía a cada uno su enlace. Entra con un toque y nadie puede ocupar su sitio.

(M) Marta          Aún no ha entrado      [ Enviar enlace ]
(P) Papá          Aún no ha entrado      [ Enviar enlace ]
[ + Añadir a alguien ]                                         ghost

Enlace para todos                                              --t-xl
Quien lo abra elige su nombre y espera a que le aceptes.
[ Copiar enlace ]                                              secondary, wide
```

Mensaje de WhatsApp (personal): «Marta, este es tu enlace para "Navidad en familia" en Lazo. Es solo para ti: {url}». General: «Entrad en "Navidad en familia" en Lazo y elegid vuestro nombre: {url}».

### 10.4 Entrar eligiendo plaza

Enlace personal:

```
Navidad en familia
24 de diciembre · lo organiza Alberto

Eres Marta                                                      Bodoni --t-2xl
[ Entrar ]                                                     primary, lg, wide
No soy Marta                                                    ghost → «Pide a Alberto tu enlace.»
```

Enlace general:

```
Navidad en familia
24 de diciembre · lo organiza Alberto

¿Quién eres?                                                   --t-xl
( ) Marta
( ) Papá
( ) Samira
No estoy en la lista                                           ghost (solo si se permite) → campo «Tu nombre»

[ Soy Marta ]                                                   primary, lg, wide (cambia con la elección)
Elige solo tu nombre. Alberto tiene que aceptarte.             15 px --ink-2
```

Filas de radio de 56 px con avatar; sin plazas libres y sin nombres nuevos: «Ya han entrado todos. Pide a Alberto que te añada.»

### 10.5 Pendiente de aprobación

```
Falta que Alberto te acepte

4 8 2 1                                                        Atkinson 700, --t-3xl, tabular
Dile este código a Alberto. Así sabe que eres tú.

Puedes cerrar esto: te avisamos aquí cuando entres.
[ Cancelar ]                                                   ghost
```

Al aceptarse: pasa sola al grupo. Rechazada: «Alberto no ha aceptado esta entrada. Habla con él.»

Para el admin, en Grupo, aviso sobre las tarjetas (fondo `--foil-tint`, sin chip de ojo):

```
Alguien quiere entrar como Papá · código 4821
Pregúntale el código a Papá antes de aceptar.
[ Aceptar ]  [ No es él ]                                      primary sm · secondary sm
```

Nombre nuevo: «Alguien quiere entrar como Tía Loli · código 4821». Aviso tras aceptar: «Papá ya está dentro.»
Errores: «Esa plaza ya está ocupada.» · «Ya estás en este grupo como Marta.» · «Ya hay una plaza con ese nombre: elígela en la lista.»

Liberar (en «Quién está», `danger sm`, confirmación en la hoja): «¿Sacar a esta persona de la plaza de Papá? Tendrá que volver a entrar con un enlace nuevo. Sus reservas y compras se quedan en la plaza.» → **Sí, liberar** / **No**.

### 10.6 Tarjeta de regalo por modo (lista ajena)

Se mantiene la `GiftCard` (pie con estado a la izquierda y botón a la derecha).

| Estado | Línea de estado | Botón del pie |
|---|---|---|
| Libre · individual | **Libre** | `primary` Me lo reservo |
| Libre · hucha | **Libre** | `primary` Para la hucha |
| Libre · mixto | **Libre** (sobre el filete) | pie con dos botones iguales: `primary` Me lo reservo · `secondary` Para la hucha |
| Me lo reservo, mío | **Lo reservas tú** | `secondary` Ya lo compré |
| Me lo reservo, de otro | **Lo reserva Samira** | — |
| Para la hucha | **Para la hucha · lo apuntó Samira** | `secondary` Ya comprado |
| Ya comprado, individual | **Lo compró Papá** / **Lo compraste tú** | — |
| Ya comprado, hucha | **Comprado con la hucha · adelantó Papá** | — |
| Retirado por su dueño | **Marta lo ha quitado de su lista** + estado | el que corresponda |
| Sorpresa | etiqueta única de la tarjeta: **Sorpresa** (sustituye a «Me encantaría») | igual |

Avisos (6 s, con Deshacer): «Reservado. Marta no lo verá.» · «Apuntado para la hucha. Marta no lo verá.» · «Lo has soltado. Vuelve a estar libre.» · «Quitado de la hucha.»

Al final de la sección «Disponibles» de una lista ajena: `ghost` **Apuntar una sorpresa** → formulario corto de regalo con la ayuda «Marta no lo verá en su lista.»

### 10.7 «Ya comprado» en 2 toques

**Toque 1:** «Ya lo compré» / «Ya comprado» en la tarjeta. **Toque 2:** «Guardar».

```
Ya comprado                                          ✕
Marco digital de fotos

¿Cuánto costó?
[ 129,00 € ]                    ← prerrellenado con el precio de la lista; inputMode="decimal"; sin foco (no abre teclado)

¿Quién lo pagó?
[ Yo ]  [ La hucha ]  [ Otra persona ]      ← segmentado; «Yo» marcado. «La hucha» solo si es de hucha.

¿De dónde sale?                              ← solo en mixto y compra directa
[ De la hucha ]  [ Lo pago yo ]

⦸ Marta no ve esto
[ Guardar ]                                  ← primary, wide, 48, con el foco
```

- Sin precio en la lista: campo vacío **con** foco y «Guardar» desactivado hasta escribir (único caso con tercer paso).
- «La hucha» = lo pagó quien la lleva con el dinero del bote. «Otra persona» despliega los nombres (nunca el destinatario).
- Aviso: «Apuntado como comprado.» + Deshacer. En la ficha, `ghost` «Cambiar precio o quién pagó».

### 10.8 Lista ajena: presupuesto con hucha

`BudgetPanel` existente, con dos líneas nuevas bajo la barra:

```
Presupuesto para Marta                          [Cambiar]
124,90 € de 200,00 €                     Quedan 75,10 €
████████████░░░░░░░
Sale a 31,23 € por persona · adelantó Samira
Además, por su cuenta: 49,00 €                         ← solo en mixto, si hay
⦸ Marta no ve esto
```

Hoja de presupuesto, botón adicional `ghost` **Poner el mismo a todos** → «Puesto a todos menos a ti. El tuyo lo pone otra persona.»

### 10.9 Pantalla «Hucha» (pestaña nueva; no aparece en «Cada uno lo suyo»)

Un trabajo: saber cuánto me falta y a quién se lo doy. Sin tabla, sin rejilla de cifras: una frase grande, una barra y una lista de renglones.

```
┌──────────────────────────────────────┐
│ ←  Hucha                             │
│    La lleva Samira                   │
├──────────────────────────────────────┤
│ Te falta poner                       │  .meta 700
│ 26,40 €                              │  Atkinson 700, --t-3xl
│ 60,00 € de 86,40 €                   │  BudgetBar («Has puesto 60,00 € de 86,40 €»)
│ ████████████████░░░░░░               │
│ [ Ya se lo di a Samira ]             │  primary, wide, 48
│ ⦸ Aquí no sale lo que se gasta en ti │  VisibilityNote
│                                      │
│ Tu parte, persona a persona          │  Bodoni --t-xl
│ (M) Marta              31,23 €        │  renglón 56: avatar 32 · nombre · cifra a la derecha
│     124,90 € entre 4                 │  .meta
│ (P) Papá              22,50 €        │
│     90,00 € entre 4                  │
│ (J) Javier       20,00 €        │
│ (S) Samira            12,67 €        │
│     Lo de Samira se lo das a Papá    │  .meta 700
│ ───────────────────────────────────  │
│ Si se compra todo lo apuntado, tu    │
│ parte llegará a 118,00 €.            │  .meta
│                                      │
│ Lo que has puesto                    │  Bodoni --t-xl
│ Compraste el chal de Marta    49,00 € │
│ Le diste a Samira            11,00 € │  cada renglón, «Quitar» al deslizar o en su ficha
└──────────────────────────────────────┘
```

Variantes de la cabecera (misma posición, misma tipografía):

| Situación | Texto grande | Botón |
|---|---|---|
| Debe | **Te falta poner** 26,40 € | `primary` Ya se lo di a Samira |
| A cero | **Estás al día** | — |
| A favor | **Samira te tiene que devolver** 12,00 € | `secondary` Ya me lo dio |
| Sin tesorero elegido | **Falta elegir quién lleva la hucha** | admin: `primary` Elegir |
| Debe por los regalos del tesorero (segunda línea, bajo la barra) | «Y 8,10 € a Papá, por los regalos de Samira.» | `secondary` Ya se lo di a Papá |

Hoja «Ya se lo di a Samira»: importe prerrellenado con lo que falta, `primary` **Apuntar**. Aviso: «Apuntado. Solo lo veis Samira y tú.»

**Tesorero**, sección adicional al final:

```
Quién te ha dado ya                                  Bodoni --t-xl
Sin contar tus regalos: esos los lleva Papá.         .meta
(A) Alberto        Le falta 26,40 €    [ Me lo dio ]
(M) Marta           Al día
(P) Papá           Hay que devolverle 12,00 €   [ Se lo di ]
```

**Suplente**: la misma sección titulada «Regalos de Samira (los llevas tú)» con la ayuda «Samira no ve nada de esto.»

Elegir roles (hoja, una sola vez): «¿Quién lleva la hucha?» (lista de personas) y «¿Quién lleva las cuentas de sus regalos?» con la ayuda «Quien lleva la hucha no puede ver lo que se gasta en él. Esa parte la lleva otra persona.» · `primary` **Guardar** · «No se puede cambiar después.»

Vacía: «Aún no se ha comprado nada con la hucha.»
Escritorio: columna única de 744 px centrada en el lienzo (dos módulos); nada de paneles de cifras.

### 10.10 Mi tarjeta y mi lista

Sin cambios de principio: «Tu presupuesto y tus reservas son sorpresa» y «Tú no ves quién te regala qué. Los demás sí.» Quitar un regalo: «Quitado de tu lista.» + Deshacer, siempre igual.

### 10.11 Día de la entrega

| Dónde | Texto |
|---|---|
| Aviso al admin, pasada la fecha | **Ya ha pasado el 24.** ¿Abrís la entrega? Cada uno podrá ver qué le regalaron y de parte de quién. Los precios no se enseñan. · `primary` Proponer abrirla |
| Aviso a los demás | **Alberto quiere abrir la entrega.** Cada uno podrá ver qué le regalaron. · `primary` De acuerdo · `ghost` Aún no |
| A quien propuso, en espera | Falta que alguien más diga que sí. · `ghost` Retirar |
| Mi tarjeta, entrega abierta | **La entrega está abierta** · `secondary` Ver qué me regalaron |
| Antes de mostrar (hoja) | ¿Quieres verlo? Verás los regalos y de parte de quién. Si prefieres quedarte con la sorpresa, cierra. · `primary` Verlo · `ghost` Ahora no |
| Pantalla «Lo que te regalaron» | renglones: miniatura 72 · título · **De parte de Samira** / **De parte de Samira y Papá** / **De parte de todos** |
| Vacía | Aún no hay nada apuntado como comprado para ti. |
| Pie | No se enseñan precios ni cuentas. |
| Cerrar (admin, menú) | Cerrar la entrega |

El sobre del amigo invisible (`.envelope .cover`, 420 ms) se reutiliza para la hoja «¿Quieres verlo?»: el contenido no se pide al servidor hasta que se abre.

---

## 11. Cambios en el cliente (resumen para el plan)

| Archivo | Cambio |
|---|---|
| `src/core/types.ts` | `Group` + `buyMode`, `allowNewNames`, `treasurer`, `deputy`, `revealAskedBy`, `revealedAt`; `GiftList` + `kind`, `claimedAt`, `via`, `approvedBy`; `Item` + `secret`, `removed`; `Claim` + `kind`, `paidBy`, `paidCents`, `boughtAt`; nuevos `Payment`, `JoinRequest`, `Received`. |
| `src/core/hucha.ts` (nuevo) | §6.3. |
| `src/core/status.ts`, `budget.ts` | Estados y comprometido por modo (§3). |
| `src/api/types.ts` | `inviteInfo`, `join(token, {list?, name?})`, `joinRequests`, `decideJoin`, `releasePlaza`, `addPlaza`, `createInvite(group, list?)`, `gift(action…)` (sustituye a `claim`, `setClaimStatus`, `releaseClaim`), `hucha(group)` (filas visibles: claims `pot`, pagos), `addPayment`, `removePayment`, `setHuchaRoles`, `reveal`, `received`. |
| `src/api/demo.ts`, `seed.ts` | Mismas reglas que el servidor; semilla con una plaza libre, modo `mixto`, tesorero y suplente, dos compras de hucha y una sorpresa. |
| `src/api/pocketbase.ts` | Las consultas son **las mismas para todos**; quien filtra es el servidor. |
| `server/pb` | Migración §4, hooks §5, `lib/plazas.js`. |
| `SECURITY.md`, spec base §4–5 | Añadir R1, plazas, hucha y entrega. |

Orden: (1) plazas y entrada → (2) `gift` y modos → (3) hucha → (4) entrega. Cada paso con sus pruebas de §9 antes de seguir.
