import { describe, expect, it } from 'vitest';
import { DemoApi } from '../../src/api/demo';
import { COPIA_MAX, exportGroup, parseCopia, restoreCopia, type Copia } from '../../src/core/copia';

const FAMILY = ['alberto', 'javier', 'samira', 'marta', 'papa'];
const NOW = new Date('2026-12-01T10:00:00Z');

/** Lo que los demás hacen en la plaza de X sin que X lo sepa: sorpresas, presupuesto, reservas, compras, aportaciones. */
async function meddle(api: DemoApi, x: string) {
  let done = 0;
  api.setViewer(x);
  for (const { id: gid } of await api.groups()) {
    api.setViewer(x);
    const { lists, members, group } = await api.groupDetail(gid);
    const list = lists.find((l) => l.user === x)!;
    for (const y of members.filter((m) => m.id !== x).map((m) => m.id)) {
      api.setViewer(y);
      const d = await api.listDetail(list.id);
      const free = d.items.filter((i) => !i.removed && !d.claims.some((c) => c.item === i.id) && !d.contributions.some((c) => c.item === i.id));
      await api.addSurprise(list.id, { title: `Sorpresa secreta de ${y}`, priority: 1, quantity: 1, priceCents: 3000 });
      await api.setBudget(list.id, 98765);
      done += 2;
      const a = free.shift();
      if (a) {
        await api.gift({ action: 'reserve', item: a.id, kind: group.buyMode === 'hucha' ? 'pot' : 'self' });
        done++;
      }
      const b = free.shift();
      if (b && group.buyMode !== 'individual') {
        await api.gift({ action: 'buy', item: b.id, kind: 'pot', paidCents: 4321, paidBy: y });
        done++;
      }
      const c = free.shift();
      if (c && group.buyMode === 'mixto') {
        await api.contribute(c.id, 1500);
        done++;
      }
    }
  }
  return done;
}

async function exportsOf(api: DemoApi, x: string) {
  api.setViewer(x);
  const out: Copia[] = [];
  for (const g of await api.groups()) out.push(await exportGroup(api, g.id, NOW));
  return out;
}

describe('copia del grupo: nada de la propia plaza', () => {
  for (const x of FAMILY) {
    it(`la copia de ${x} no lleva estados ni sorpresas de su plaza`, async () => {
      const api = new DemoApi(null);
      const before = await exportsOf(api, x);
      expect(await meddle(api, x)).toBeGreaterThan(8);
      const after = await exportsOf(api, x);
      // Lo que hacen los demás en su plaza no cambia ni un byte de su copia: no se puede deducir nada.
      expect(after).toEqual(before);

      for (const copia of after) {
        api.setViewer(x);
        const { lists } = await api.groupDetail((await api.groups()).find((g) => g.name === copia.grupo.name)!.id);
        const plaza = lists.find((l) => l.user === x)!;
        const own = copia.listas.filter((l) => l.name === plaza.name);
        expect(own).toHaveLength(1);
        expect(Object.keys(own[0]!).sort()).toEqual(['kind', 'name', 'regalos']);

        // Lo que ve otra persona de la plaza de X: los regalos pedidos coinciden; las sorpresas no salen nunca.
        const y = FAMILY.find((f) => f !== x)!;
        api.setViewer(y);
        const seenByY = await api.listDetail(plaza.id);
        const asked = seenByY.items.filter((i) => !i.secret && !i.removed).map((i) => i.title).sort();
        expect(own[0]!.regalos.map((g) => g.title).sort()).toEqual(asked);
        const text = JSON.stringify(copia);
        for (const i of seenByY.items.filter((i) => i.secret || i.removed)) expect(text).not.toContain(i.title);
        expect(text).not.toContain('98765');
        expect(text).not.toContain('Sorpresa secreta');
      }
    });
  }

  it('V-27: las listas son idénticas la descargue quien la descargue, y sin estados de nadie', async () => {
    const api = new DemoApi(null);
    for (const x of FAMILY) await meddle(api, x);
    const all = await Promise.all(FAMILY.map(async (x) => (await exportsOf(api, x)).find((c) => c.grupo.name === 'Navidad en familia')!));
    for (const c of all) {
      expect(JSON.stringify(c.listas)).toBe(JSON.stringify(all[0]!.listas));
      const text = JSON.stringify(c);
      expect(text).not.toMatch(/reservas|aportaciones|sorpresas|retirados|presupuesto/);
      expect(text).not.toContain('Sorpresa secreta');
      expect(text).not.toContain('98765');
      expect(c.version).toBe(1);
      expect(c.fecha).toBe(NOW.toISOString());
    }
  });

  it('sigue leyendo copias v1 antiguas con estados, y los descarta', () => {
    const old = { lazo: 'copia-grupo', version: 1, fecha: NOW.toISOString(), grupo: { name: 'Navidad', occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', allowNewNames: false }, listas: [{ name: 'Ana', kind: 'person', propia: false, presupuestoCents: 5000, sorpresas: [{ title: 'Secreto', priority: 1, quantity: 1 }], regalos: [{ title: 'Libro', priority: 2, quantity: 1, reservas: [{ quien: 'Bea', tipo: 'self', estado: 'bought', unidades: 1 }] }] }] };
    const r = parseCopia(JSON.stringify(old));
    expect(r.listas).toEqual([{ name: 'Ana', kind: 'person', regalos: [{ title: 'Libro', priority: 2, quantity: 1 }] }]);
  });
});

describe('copia del grupo: el validador', () => {
  const ok = (): Copia => ({
    lazo: 'copia-grupo',
    version: 1,
    fecha: NOW.toISOString(),
    grupo: { name: 'Navidad', occasion: 'navidad', date: '2027-12-24', currency: 'EUR', buyMode: 'mixto', allowNewNames: false },
    listas: [{ name: 'Ana', kind: 'person', regalos: [{ title: 'Libro', priority: 2, quantity: 1 }] }],
  });
  const parse = (v: unknown) => () => parseCopia(typeof v === 'string' ? v : JSON.stringify(v));

  it('acepta una copia buena y descarta los estados', () => {
    const c = ok() as unknown as { listas: Record<string, unknown>[] };
    c.listas[0]!.regalos = [{ title: 'Libro', priority: 2, quantity: 1, reservas: [{ quien: 'Bea', tipo: 'self', estado: 'bought', unidades: 1 }], aportaciones: [] }];
    const r = parseCopia(JSON.stringify(c));
    expect(r.listas[0]!.regalos).toEqual([{ title: 'Libro', priority: 2, quantity: 1 }]);
    expect(JSON.stringify(r)).not.toMatch(/reservas|aportaciones|Bea/);
  });

  it('rechaza lo que no es JSON, otro formato u otra versión', () => {
    expect(parse('{"lazo":')).toThrow(/no es una copia/);
    expect(parse('alert(1)')).toThrow();
    expect(parse([ok()])).toThrow();
    expect(parse({ ...ok(), lazo: 'otra-cosa' })).toThrow();
    expect(parse({ ...ok(), version: 2 })).toThrow(/otra versión/);
  });

  it('rechaza tipos que no son los suyos', () => {
    const gift = (g: object) => ({ ...ok(), listas: [{ name: 'Ana', kind: 'person', regalos: [{ title: 'Libro', ...g }] }] });
    expect(parse(gift({ title: 42 }))).toThrow();
    expect(parse(gift({ title: '   ' }))).toThrow();
    expect(parse(gift({ title: 'x'.repeat(201) }))).toThrow();
    expect(parse(gift({ priceCents: 12.5 }))).toThrow();
    expect(parse(gift({ priceCents: -1 }))).toThrow();
    expect(parse(gift({ priceCents: '100' }))).toThrow();
    expect(parse(gift({ priority: 7 }))).toThrow();
    expect(parse(gift({ quantity: 1e9 }))).toThrow();
    expect(parse(gift({ notes: { toString: 'x' } }))).toThrow();
    expect(parse({ ...ok(), grupo: { ...ok().grupo, occasion: 'fiesta' } })).toThrow();
    expect(parse({ ...ok(), grupo: { ...ok().grupo, date: '24/12/2027' } })).toThrow();
    expect(parse({ ...ok(), grupo: { ...ok().grupo, buyMode: 'gratis' } })).toThrow();
    expect(parse({ ...ok(), listas: [{ name: 'Ana', kind: 'admin', regalos: [] }] })).toThrow();
    expect(parse({ ...ok(), listas: [{ name: 'Ana', kind: 'person', regalos: [] }, { name: 'ána', kind: 'person', regalos: [] }] })).toThrow();
  });

  it('descarta enlaces que no son http(s) y no contamina prototipos', () => {
    const text = JSON.stringify({ ...ok(), listas: [{ name: 'Ana', kind: 'person', regalos: [{ title: 'Libro', url: 'javascript:alert(1)', image: 'data:image/png;base64,AAAA' }] }] }).replace('"lazo"', '"__proto__":{"polluted":true},"lazo"');
    const r = parseCopia(text);
    expect(r.listas[0]!.regalos[0]).toEqual({ title: 'Libro', priority: 2, quantity: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rechaza copias enormes', () => {
    expect(parse('x'.repeat(COPIA_MAX.bytes + 1))).toThrow(/demasiado grande/);
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `R${i}` }));
    expect(parse({ ...ok(), listas: Array.from({ length: COPIA_MAX.lists + 1 }, (_, i) => ({ name: `P${i}`, kind: 'person', regalos: [] })) })).toThrow(/demasiadas personas/);
    expect(parse({ ...ok(), listas: [{ name: 'Ana', kind: 'person', regalos: many(COPIA_MAX.itemsPerList + 1) }] })).toThrow(/demasiados regalos/);
    const lots = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, kind: 'person', regalos: many(COPIA_MAX.itemsPerList) }));
    expect(parse({ ...ok(), listas: lots })).toThrow(/demasiados regalos/);
  });
});

describe('copia del grupo: restaurar', () => {
  it('crea un grupo nuevo con plazas libres y solo los regalos pedidos', async () => {
    const api = new DemoApi(null);
    api.setViewer('alberto');
    const text = JSON.stringify(await exportGroup(api, 'navidad', NOW));
    const id = await restoreCopia(api, parseCopia(text));
    expect(id).not.toBe('navidad');
    const d = await api.groupDetail(id);
    expect(d.members.map((m) => m.id)).toEqual(['alberto']);
    expect(d.lists.map((l) => l.name).sort()).toEqual(['Alberto', 'Javier', 'Marta', 'Papá', 'Samira', 'Tía Loli']);
    expect(d.lists.filter((l) => l.user).map((l) => l.user)).toEqual(['alberto']);
    const h = await api.hucha(id);
    expect(h.claims).toEqual([]);
    expect(h.items.some((i) => i.secret || i.removed)).toBe(false);
    // Marta pidió lo mismo que en el grupo original; la sorpresa de Papá no viaja.
    const titles = (await api.listDetail(d.lists.find((l) => l.name === 'Marta')!.id)).items.map((i) => i.title);
    expect(titles).toContain('Marco digital de fotos');
    expect(titles).not.toContain('Pañuelo de seda estampado');
    expect(h.items.map((i) => i.title)).not.toContain('Bufanda de punto');
  });

  it('solo en un grupo recién creado y con listas suyas', async () => {
    const api = new DemoApi(null);
    api.setViewer('alberto');
    await expect(api.restoreItems('navidad', [{ list: 'l-loli', items: [{ title: 'X', priority: 2, quantity: 1 }] }])).rejects.toThrow(/recién creado/);
    const g = await api.createGroup({ name: 'Nuevo', occasion: 'otro', currency: 'EUR', buyMode: 'mixto', plazas: ['Bea'] });
    await expect(api.restoreItems(g.id, [{ list: 'l-loli', items: [] }])).rejects.toThrow(/no encaja/);
    api.setViewer('samira');
    await expect(api.restoreItems(g.id, [])).rejects.toThrow();
  });
});
