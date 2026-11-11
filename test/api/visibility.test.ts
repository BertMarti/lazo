import { describe, expect, it } from 'vitest';
import { DemoApi } from '../../src/api/demo';
import { FAMILY, seed } from '../../src/api/seed';

/**
 * La regla de Lazo, persona a persona: sobre la lista de X, todos menos X ven reservas, compras,
 * aportaciones y presupuesto. Se comprueba también que nada de eso se cuela por ninguna otra llamada.
 */
const db = seed();
const ownLists = (who: string) => db.lists.filter((l) => l.user === who).map((l) => l.id);
const itemsOf = (lists: string[]) => db.items.filter((i) => lists.includes(i.list)).map((i) => i.id);

/** Todo lo que la API le devuelve a una persona, serializado. */
async function everything(api: DemoApi) {
  const out: unknown[] = [];
  for (const g of await api.groups()) {
    const detail = await api.groupDetail(g.id);
    out.push(g, detail, await api.drawInfo(g.id));
    for (const l of detail.lists) out.push(await api.listDetail(l.id));
  }
  out.push(await api.purchases());
  return JSON.stringify(out);
}

describe.each(FAMILY)('vista de %s', (who) => {
  const api = new DemoApi(null);
  api.setViewer(who);
  const mine = ownLists(who);

  it('en su propia lista no hay reservas, compras, aportaciones ni presupuesto', async () => {
    for (const id of mine) {
      const d = await api.listDetail(id);
      expect(d.canSee).toBe(false);
      expect(d.claims).toEqual([]);
      expect(d.contributions).toEqual([]);
      expect(d.budget).toBeUndefined();
    }
  });

  it('en las listas de los demás lo ve todo', async () => {
    for (const l of db.lists.filter((x) => x.user !== who)) {
      const d = await api.listDetail(l.id);
      const ids = itemsOf([l.id]);
      expect(d.canSee).toBe(true);
      expect(d.claims).toEqual(db.claims.filter((c) => ids.includes(c.item)));
      expect(d.contributions).toEqual(db.contributions.filter((c) => ids.includes(c.item)));
      expect(d.budget).toEqual(db.budgets.find((b) => b.list === l.id));
    }
  });

  it('nada de su lista se filtra por ninguna otra respuesta', async () => {
    const all = await everything(api);
    const ownItems = itemsOf(mine);
    const secrets = [
      ...db.claims.filter((c) => ownItems.includes(c.item)).map((c) => `"id":"${c.id}"`),
      ...db.contributions.filter((c) => ownItems.includes(c.item)).map((c) => `"id":"${c.id}"`),
      ...db.budgets.filter((b) => mine.includes(b.list)).map((b) => `"id":"${b.id}"`),
    ];
    for (const s of secrets) expect(all).not.toContain(s);
  });

  it('no puede reservar, aportar ni tocar el presupuesto de su lista', async () => {
    for (const item of itemsOf(mine)) {
      await expect(api.claim(item, 'reserved')).rejects.toThrow();
      await expect(api.contribute(item, 1000)).rejects.toThrow();
    }
    for (const id of mine) await expect(api.setBudget(id, 1000)).rejects.toThrow();
  });
});

it('el ejemplo tiene secretos que proteger para cada persona', () => {
  // Si el seed cambia y alguien se queda sin reservas ni presupuesto, los tests anteriores no probarían nada.
  for (const who of FAMILY) {
    const ownItems = itemsOf(ownLists(who));
    const hasSecret =
      db.claims.some((c) => ownItems.includes(c.item)) || db.contributions.some((c) => ownItems.includes(c.item));
    expect(hasSecret, who).toBe(true);
    expect(db.budgets.some((b) => ownLists(who).includes(b.list)), who).toBe(true);
  }
});
