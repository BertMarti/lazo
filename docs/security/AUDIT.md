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
| **PB-13** | **Falta** | Agregados de `core/hucha` sobre lo que el servidor entrega a X, invariantes a lo de X |
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
- Pendientes: V-8 a V-15 (bajos) y las pruebas PB-2, PB-9, PB-13, PB-14 y PB-17.
