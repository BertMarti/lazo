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
| Deducción por ausencia | Inherente | «Mamá ha comprado para todos menos para mí» se deduce mirando las otras listas |

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

**Ataque.** Mamá quiere saber si ya le han cogido la batidora (id `A`, lo ve en su lista):

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

**Escenario.** Se abre el 24 de diciembre. El 3 de enero Papá compra el regalo de Reyes de Mamá. Mamá abre «Ver qué me regalaron» y lo ve con título y «de parte de Papá». Tras la primera apertura, X tiene un canal permanente sobre las compras de su plaza.

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
- `server/test/rules.test.mjs`: **22/22 en verde contra PocketBase 0.40.6**, con PB-2 (no interferencia byte a byte para Mamá), PB-3 (plaza con historial antes de reclamarla), PB-9 (20 reservas simultáneas → 1 fila), PB-14 (lotes con `expand` y `_via_`), PB-17 (enlace usado ≡ falso) y una prueba de V-9/V-10/V-11/V-13.
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

**Escenario.** X, desde la wifi de casa, manda `CF-Connecting-IP: 203.0.113.N` con un N distinto en cada petición: ningún límite por IP le cuenta (`*:auth`, `device-claim`, `join`, `/api/`). O pone la IP del móvil de Mamá y le agota `POST /api/lazo/join` (10 por minuto): Mamá no puede entrar. Aparte: quien controle el panel de Cloudflare puede apuntar el túnel a `pocketbase:8090` y saltarse todos los bloqueos de Caddy.

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

**Escenario.** Papá usó Lazo en el ordenador del salón; su sesión ya no vale (pulsó «cerrar sesión en todos los dispositivos» desde el móvil). Mamá abre su enlace personal en ese navegador y entra con su cuenta. En las herramientas del navegador lee `lazo:avisos:<id de Papá>` → `due`. Lo que debe Papá es la suma de sus partes en todas las plazas menos la suya, **incluida la de Mamá**. Mamá conoce las demás plazas, resta y obtiene cuánto se ha gastado con la hucha en sus regalos (exacto si Papá aún no ha pagado nada o si Mamá es la tesorera). Rompe la regla por deducción. Hace falta navegador compartido: por eso no es alto.

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

**Prueba.** En `test/core/avisos.test.ts`, con un `localStorage` falso: `seenFacts.set('papa', …)`, `seenFacts.forget('mama')` → no queda ninguna clave `lazo:avisos:papa`; `seenFacts.forget()` → no queda ninguna.

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

**Escenario.** Papá se envía «te toca regalar a Juan Carlos». Se repite el sorteo y ahora le toca Samira. Papá mira su chat, compra para Juan Carlos y Samira se queda sin regalo: se descubre que hubo dos sorteos y quién tenía a quién.

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

- **V-20:** prueba nueva en `server/test/rules.test.mjs` («V-20: …»): `src/core/avisos.ts` empaquetado con esbuild (como PB-13) calcula los `Facts` de Mamá con las mismas consultas que `PocketBaseApi.hucha()` y `drawInfo()`. Con las filas del superusuario (sorpresas y reservas de su plaza incluidas) salen los mismos `Facts` que con su token, y tras sorpresas nuevas, reservas, una compra con la hucha y una reserva en su plaza no cambian ni dan aviso. Comprobado que falla si `buildFacts` deja pasar las sorpresas de la plaza propia. Siguen sin hacer los otros puntos de V-20 sobre `flujo.test.mjs` (`view()` antes y después, `PB_BIN` obligatorio en CI, pasos de entrega y de quitar un regalo reservado).
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

**Comprobado** en PocketBase 0.40.6 (sonda S1 y S2), con Mamá como dueña:

| Petición de Mamá | Regalo que estaba cogido | Regalo que estaba libre |
|---|---|---|
| `DELETE items/records/ID` | 204 | 204 |
| `POST items/records` con `"id":"ID"` | **400** `validation_not_unique` | **200** |
| `POST /api/batch` con `PUT items/records` e `"id":"ID"` | **400** (dentro, 404) | **200** |

**Escenario.** Mamá quiere saber si ya le han cogido la bicicleta. La quita de su lista y la vuelve a crear con el mismo id. Si responde 200, estaba libre, y el regalo queda como estaba, con el mismo id. Si responde 400, alguien la tenía reservada o comprada. Vale para cualquier regalo suyo, uno a uno, y también meses después para regalos que quitó en su día. Es la misma fuga que V-1 y V-2 por otra puerta.

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

**Escenario.** Papá organiza y descarga la copia en el ordenador de casa, o se la manda a Mamá «para que la guarde». Mamá abre el archivo y lee sus sorpresas, quién le ha comprado qué, por cuánto y su presupuesto. No hacen falta herramientas ni sesión, y el archivo no caduca. Es la vía de V-19 (navegador compartido), más fácil y portátil. La copia lleva además el año de nacimiento de los niños.

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

**Escenario 1.** Papá entra con un código en la tableta del salón para apuntar regalos. No puede salir. Mamá abre Lazo en la tableta, es Papá, y ve quién ha reservado qué en su lista.

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

**Lote `POST` con `?expand=…_via_`.** El cortafuegos **no** lo para: solo mira la URL exterior (`/api/batch`), y la petición interior responde 200. **No filtra nada**, porque cada salto del `expand` pasa por la regla de la colección de destino. Probado con Mamá creando un regalo en su lista (que tenía una reserva viva, un presupuesto, un regalo retirado y una sorpresa) con `expand=list.items_via_list.claims_via_item,list.budgets_via_list,list.items_via_list.contributions_via_item,claims_via_item`: la respuesta trae solo sus regalos visibles, sin reservas, presupuesto, retirado ni sorpresa. Control: la misma consulta hecha por Samira sí trae la reserva y el presupuesto. Un `filter` con `_via_` en la URL interior de un `POST` se ignora. El mismo `expand` fuera de un lote da 403.

**Mejoras que no bloquean.**

- Segunda capa en `onBatchRequest`: rechazar también las peticiones interiores cuya `url` case `/_via_|@collection/i` tras descodificarla, para que el lote no dependa solo de las reglas.
- `firmar-apk.sh` no comprueba `debuggable` por sí mismo; hoy es un paso manual de `SECURITY.md`. Añadir al script `"$BT/aapt2" dump badging "$OUT" | grep -q application-debuggable && exit 1`.
- Siguen los bajos antiguos (G-12, G-4, V-20, token de DuckDNS, copias sin autenticación).

**Veredicto: apto.** Con V-26 a V-29 corregidos y probados contra PocketBase real, no conozco ninguna vía por la que alguien vea o deduzca el estado de su propia lista desde su sesión, ni hay secretos en el repositorio o en los builds. Condición de publicación: el APK de la release sale de `scripts/firmar-apk.sh` y `aapt2 dump badging … | grep -c debuggable` da 0 antes de subirlo.
