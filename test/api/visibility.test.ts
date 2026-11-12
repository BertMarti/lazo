import { describe, expect, it } from 'vitest';
import { DemoApi } from '../../src/api/demo';
import { DEMO_GENERAL_TOKEN, FAMILY, seed } from '../../src/api/seed';
import type { Api } from '../../src/api/types';

/**
 * LA REGLA, persona a persona (spec plazas-hucha §9.2): sobre la plaza de X, todos menos X ven reservas,
 * compras, aportaciones, presupuesto, sorpresas, hucha y pagos. Se prueba con «no interferencia»: dos mundos
 * idénticos salvo en lo de X dan a X exactamente las mismas respuestas.
 */
const fresh = (who: string) => {
  const api = new DemoApi(null);
  api.setViewer(who);
  return api;
};

/** Todo lo que la API le devuelve a una persona, serializado. */
async function everything(api: Api) {
  const out: unknown[] = [];
  for (const g of await api.groups()) {
    const detail = await api.groupDetail(g.id);
    out.push(g, detail, await api.drawInfo(g.id), await api.hucha(g.id));
    for (const l of detail.lists) out.push(await api.listDetail(l.id));
  }
  out.push(await api.purchases());
  return JSON.stringify(out);
}

/** Otro miembro hace de todo sobre la plaza de X: reservar, hucha, comprar, presupuesto, sorpresa, a medias. */
async function meddle(x: string) {
  const other = FAMILY.find((f) => f !== x)!;
  const third = FAMILY.find((f) => f !== x && f !== other)!;
  const api = fresh(other);
  const plaza = seed().lists.find((l) => l.group === 'navidad' && l.user === x)!;
  const s = await api.addSurprise(plaza.id, { title: 'Sorpresa secreta', priceCents: 2500, priority: 2, quantity: 1 });
  await api.gift({ action: 'reserve', item: s.id, kind: 'pot' });
  await api.setBudget(plaza.id, 77700);
  const d = await api.listDetail(plaza.id);
  const free = d.items.find((i) => !d.claims.some((c) => c.item === i.id) && !d.contributions.some((c) => c.item === i.id));
  if (free) await api.gift({ action: 'buy', item: free.id, kind: 'pot', paidCents: 1234, paidBy: third });
  return api;
}

describe.each(FAMILY)('vista de %s', (who) => {
  it('en su propia plaza no hay estado, presupuesto ni sorpresas', async () => {
    const api = fresh(who);
    for (const l of seed().lists.filter((x) => x.user === who)) {
      const d = await api.listDetail(l.id);
      expect(d.canSee).toBe(false);
      expect(d.claims).toEqual([]);
      expect(d.contributions).toEqual([]);
      expect(d.budget).toBeUndefined();
      expect(d.items.some((i) => i.secret || i.removed)).toBe(false);
    }
  });

  it('en las plazas de los demás (también las libres) lo ve todo', async () => {
    const api = fresh(who);
    const db = seed();
    for (const l of db.lists.filter((x) => x.group === 'navidad' && x.user !== who)) {
      const d = await api.listDetail(l.id);
      const ids = db.items.filter((i) => i.list === l.id).map((i) => i.id);
      expect(d.canSee).toBe(true);
      expect(d.claims).toEqual(db.claims.filter((c) => ids.includes(c.item)));
      expect(d.budget).toEqual(db.budgets.find((b) => b.list === l.id));
    }
  });

  it('D-1 no interferencia: lo que pasa en su plaza no cambia NADA de lo que recibe', async () => {
    const before = await everything(fresh(who));
    const api = await meddle(who);
    api.setViewer(who);
    // `meddle` usa su propia DemoApi en memoria: rehacemos el mundo y comparamos sobre él.
    const world = api;
    expect(await everything(world)).toBe(before);
  });

  it('no puede reservar, aportar, poner presupuesto ni sorpresas en su plaza', async () => {
    const api = fresh(who);
    const db = seed();
    const plaza = db.lists.find((l) => l.group === 'navidad' && l.user === who)!;
    for (const item of db.items.filter((i) => i.list === plaza.id && !i.secret)) {
      await expect(api.gift({ action: 'reserve', item: item.id, kind: 'self' })).rejects.toThrow(/propia lista/);
      await expect(api.contribute(item.id, 1000)).rejects.toThrow();
    }
    // Un id de sorpresa propia es indistinguible de uno que no existe.
    for (const s of db.items.filter((i) => i.list === plaza.id && i.secret))
      await expect(api.gift({ action: 'reserve', item: s.id, kind: 'pot' })).rejects.toThrow('Ese regalo ya no existe.');
    await expect(api.setBudget(plaza.id, 1000)).rejects.toThrow();
    await expect(api.addSurprise(plaza.id, { title: 'x', priority: 2, quantity: 1 })).rejects.toThrow();
  });
});

describe('plazas y entrada', () => {
  it('D-2: reclamar una plaza libre con historial: la nueva ocupante empieza ciega y los demás siguen viendo', async () => {
    const admin = fresh('alberto');
    const before = await admin.listDetail('l-loli');
    expect(before.claims.length).toBeGreaterThan(0);
    const { url } = await admin.createInvite('navidad', 'l-loli');
    const token = url.split('/unirse/')[1]!;
    const res = await admin.join(token, {});
    expect(res).toEqual({ group: 'navidad' });
    const loli = await admin.listDetail('l-loli'); // la api ya ve como Loli
    expect(loli.canSee).toBe(false);
    expect(loli.items).toEqual([]);
    expect(loli.budget).toBeUndefined();
    admin.setViewer('marta');
    expect((await admin.listDetail('l-loli')).claims).toEqual(before.claims);
    // Enlace personal de un solo uso
    await expect(admin.join(token, {})).rejects.toThrow(/no existe o ha caducado/);
  });

  it('caras del enlace: solo inicial y color de quien está; un enlace falso no dice nada', async () => {
    const api = fresh('alberto');
    const info = await api.inviteInfo(DEMO_GENERAL_TOKEN);
    expect(info.faces).toEqual([
      { initial: 'A', color: 'cielo' },
      { initial: 'J', color: 'menta' },
      { initial: 'S', color: 'fresa' },
      { initial: 'M', color: 'violeta' },
      { initial: 'P', color: 'canela' },
    ]);
    expect(JSON.stringify(info.faces)).not.toMatch(/alberto|javier|samira|marta|papa/);
    await expect(api.inviteInfo('Z'.repeat(32))).rejects.toThrow(/no existe o ha caducado/);
  });

  it('perder el móvil: liberar y volver con un enlace nuevo conserva su lista', async () => {
    const api = fresh('alberto');
    const before = await api.listDetail('l-papa');
    await api.releasePlaza('l-papa');
    expect((await api.inviteInfo(DEMO_GENERAL_TOKEN)).faces.map((f) => f.initial)).toEqual(['A', 'J', 'S', 'M']);
    const { url } = await api.createInvite('navidad', 'l-papa');
    const token = url.split('/unirse/')[1]!;
    expect((await api.inviteInfo(token)).personal).toEqual({ list: 'l-papa', name: 'Papá', color: 'canela' });
    await api.join(token, {});
    const now = await api.listDetail('l-papa');
    expect(now.items.map((i) => i.id)).toEqual(before.items.map((i) => i.id));
    expect(now.canSee).toBe(false);
    // La cuenta vieja ya no está en el grupo
    api.setViewer('papa');
    await expect(api.groupDetail('navidad')).rejects.toThrow(/No perteneces/);
  });

  it('D-3: suplantación: enlace general → pendiente sin acceso; plaza ocupada; nombres repetidos', async () => {
    const api = fresh('alberto');
    const info = await api.inviteInfo(DEMO_GENERAL_TOKEN);
    expect(info.free.map((f) => f.name)).toEqual(['Tía Loli']);
    await expect(api.join(DEMO_GENERAL_TOKEN, { list: 'l-papa' })).rejects.toThrow(/ocupada/);
    await expect(api.join(DEMO_GENERAL_TOKEN, { name: 'márta ' })).rejects.toThrow(/Ya hay una plaza/);
    const r = await api.join(DEMO_GENERAL_TOKEN, { list: 'l-loli' });
    expect('pending' in r && r.code).toMatch(/^\d{4}$/);
    expect(await api.groups()).toEqual([]); // pendiente: no lee nada
    await expect(api.groupDetail('navidad')).rejects.toThrow(/No perteneces/);
    await expect(api.listDetail('l-marta')).rejects.toThrow(/No perteneces/);
    // Otra persona pide la misma plaza; se acepta una y la otra ya no puede entrar.
    const second = await api.join(DEMO_GENERAL_TOKEN, { list: 'l-loli' });
    api.setViewer('alberto');
    const reqs = await api.joinRequests('navidad');
    expect(reqs).toHaveLength(2);
    await api.decideJoin('request' in r ? r.request : '', true);
    await expect(api.decideJoin('request' in second ? second.request : '', true)).rejects.toThrow(/ocupada/);
    // Un no admin no decide
    api.setViewer('papa');
    await expect(api.joinRequests('navidad')).rejects.toThrow(/organiza/);
  });

  it('D-4: el admin no ve su plaza, no puede liberarla y liberar otra conserva su historial', async () => {
    const api = fresh('alberto');
    expect((await api.listDetail('l-alberto')).claims).toEqual([]);
    await expect(api.releasePlaza('l-alberto')).rejects.toThrow();
    const papaBefore = seed().claims.filter((c) => c.user === 'papa');
    await api.releasePlaza('l-papa');
    api.setViewer('marta');
    const d = await api.groupDetail('navidad');
    expect(d.members.some((m) => m.id === 'papa')).toBe(false);
    expect(d.lists.find((l) => l.id === 'l-papa')!.user).toBeUndefined();
    // Reclamarla con una cuenta nueva hereda lo que hizo la anterior
    api.setViewer('alberto');
    const { url } = await api.createInvite('navidad', 'l-papa');
    await api.join(url.split('/unirse/')[1]!, {});
    const newPapa = api.me().id;
    api.setViewer('marta');
    const all = (await api.listDetail('l-javier')).claims;
    expect(all.filter((c) => c.user === newPapa)).toHaveLength(papaBefore.filter((c) => c.item === 'i12').length);
  });
});

describe('regalos, modos y entrega', () => {
  it('D-5: transiciones por modo y última unidad', async () => {
    const api = fresh('marta');
    await api.gift({ action: 'reserve', item: 'i13', kind: 'self' });
    await expect(api.gift({ action: 'reserve', item: 'i13', kind: 'pot' })).rejects.toThrow(/adelantado/);
    const c = (await api.listDetail('l-javier')).claims.find((x) => x.item === 'i13')!;
    await api.gift({ action: 'move', claim: c.id, kind: 'pot' });
    api.setViewer('papa');
    await api.gift({ action: 'buy', claim: c.id, paidCents: 7500, paidBy: 'alberto' });
    await expect(api.gift({ action: 'buy', item: 'i7', paidCents: 100, paidBy: 'papa' })).rejects.toThrow(/propia lista/);
    api.setViewer('alberto');
    await api.updateGroup('navidad', { buyMode: 'hucha' });
    api.setViewer('marta');
    await expect(api.gift({ action: 'reserve', item: 'i7', kind: 'self' })).rejects.toThrow(/hucha/);
    await expect(api.contribute('i7', 500)).rejects.toThrow(/hucha/);
    await api.gift({ action: 'reserve', item: 'i7', kind: 'pot' });
  });

  it('D-6: quitar un regalo propio responde igual con y sin reservas; los demás lo ven retirado', async () => {
    const api = fresh('marta');
    await api.deleteItem('i1'); // reservado por Alberto
    await api.deleteItem('i4'); // libre
    const own = await api.listDetail('l-marta');
    expect(own.items.map((i) => i.id)).not.toContain('i1');
    expect(own.items.map((i) => i.id)).not.toContain('i4');
    api.setViewer('papa');
    const seen = await api.listDetail('l-marta');
    expect(seen.items.find((i) => i.id === 'i1')?.removed).toBe(true);
    expect(seen.items.find((i) => i.id === 'i4')).toBeUndefined();
  });

  it('D-7: entrega con dos llaves y sin precios', async () => {
    const api = fresh('marta');
    await expect(api.received('navidad')).rejects.toThrow(/no está abierta/);
    api.setViewer('alberto');
    await api.reveal('navidad', 'ask');
    await expect(api.reveal('navidad', 'confirm')).rejects.toThrow();
    api.setViewer('papa');
    await api.reveal('navidad', 'confirm');
    api.setViewer('marta');
    const r = await api.received('navidad');
    expect(r.map((x) => x.title).sort()).toEqual(['Chal de lana merino', 'Robot de cocina']);
    expect(r.find((x) => x.title === 'Robot de cocina')).toMatchObject({ fromAll: true, from: [] });
    expect(JSON.stringify(r)).not.toMatch(/paidCents|priceCents|4900|33990/);
    // Las cuentas siguen siendo secretas después
    expect((await api.listDetail('l-marta')).claims).toEqual([]);
  });

  it('D-8: cambiar de modo nunca falla', async () => {
    const api = fresh('alberto');
    for (const m of ['hucha', 'individual', 'mixto'] as const) await expect(api.updateGroup('navidad', { buyMode: m })).resolves.toBeUndefined();
  });
});
