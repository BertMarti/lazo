import { describe, expect, it } from 'vitest';
import { DemoApi } from '../../src/api/demo';
import { collectFacts, notices, seenFacts, withBaseline } from '../../src/core/avisos';

const TODAY = new Date(2026, 11, 14); // faltan 10 días para el 24 de diciembre
const as = async (api: DemoApi, who: string) => {
  api.setViewer(who);
  return collectFacts(api, TODAY);
};

/** Todo lo que los demás pueden hacer sobre la plaza de X sin que X lo sepa. */
async function meddle(api: DemoApi, x: string) {
  let done = 0;
  api.setViewer(x);
  for (const { id: gid } of await api.groups()) {
    api.setViewer(x);
    const { lists, members, group } = await api.groupDetail(gid);
    const list = lists.find((l) => l.user === x)!;
    const others = members.filter((m) => m.id !== x).map((m) => m.id);
    for (const y of others) {
      api.setViewer(y);
      const d = await api.listDetail(list.id);
      const free = d.items.filter((i) => !i.removed && !d.claims.some((c) => c.item === i.id) && !d.contributions.some((c) => c.item === i.id));
      await api.addSurprise(list.id, { title: `Sorpresa de ${y}`, priority: 1, quantity: 1, priceCents: 3000 });
      await api.setBudget(list.id, 12345 + done);
      done += 2;
      const pot = group.buyMode !== 'individual';
      const self = group.buyMode !== 'hucha';
      const a = free.shift();
      if (a) {
        await api.gift({ action: 'reserve', item: a.id, kind: self ? 'self' : 'pot' });
        done++;
      }
      const b = free.shift();
      if (b && pot) {
        await api.gift({ action: 'buy', item: b.id, kind: 'pot', paidCents: 4321, paidBy: y });
        done++;
      }
      const c = free.shift();
      if (c && self && pot) {
        await api.contribute(c.id, 1500);
        done++;
      }
    }
  }
  return done;
}

describe('avisos: nunca dependen de la propia lista', () => {
  for (const x of ['alberto', 'javier', 'samira', 'marta', 'papa']) {
    it(`lo que hacen los demás en la plaza de ${x} no cambia sus avisos`, async () => {
      const api = new DemoApi(null);
      const before = await as(api, x);
      const n0 = notices([], before);
      const n0b = notices(withBaseline([], before), before);
      const acted = await meddle(api, x);
      expect(acted).toBeGreaterThan(8); // de verdad se han hecho cosas
      const after = await as(api, x);
      expect(after).toEqual(before);
      expect(notices([], after)).toEqual(n0);
      expect(notices(withBaseline([], after), after)).toEqual(n0b);
      expect(notices(before, after)).toEqual([]);
      // Y ningún aviso habla de su propia plaza.
      const mine = (await api.groupDetail('navidad')).lists.filter((l) => l.user === x).map((l) => l.id);
      expect(after.flatMap((g) => g.items).some((i) => mine.includes(i.list))).toBe(false);
    });
  }

  it('sí avisa de lo que hacen los demás en sus propias listas', async () => {
    const api = new DemoApi(null);
    const before = await as(api, 'marta');
    api.setViewer('papa');
    for (const t of ['Libro', 'Bufanda', 'Gorro']) await api.saveItem('l-papa', { title: t, priority: 2, quantity: 1 });
    api.setViewer('samira');
    await api.addSurprise('l-papa', { title: 'Sorpresa', priority: 2, quantity: 1 }); // no la añade Papá
    api.setViewer('alberto');
    await api.runDraw('navidad', ['alberto', 'javier', 'samira', 'marta', 'papa'], []);
    const after = await as(api, 'marta');
    const texts = notices(before, after).map((n) => n.text);
    expect(texts).toContain('Papá ha añadido 3 regalos a su lista');
    expect(texts).toContain('Han hecho el sorteo');
    expect(texts.some((t) => /Samira/.test(t))).toBe(false); // las sorpresas no son «regalos que ha añadido»
  });

  it('cuenta atrás, hucha y quién entra', async () => {
    const api = new DemoApi(null);
    const now = await as(api, 'marta');
    const texts = notices(withBaseline([], now), now).map((n) => n.text);
    expect(texts).toContain('Faltan 10 días para Navidad en familia');
    expect(texts.some((t) => /^Te toca poner .+ en la hucha$/.test(t))).toBe(true);
    expect(notices(withBaseline([], now), now)).toEqual(notices([], now)); // primera vez: sin regalos ni personas
    const gone = now.map((g) => ({ ...g, members: g.members.filter((m) => m.id !== 'samira') }));
    expect(notices(gone, now).map((n) => n.text)).toContain('Samira ha entrado en el grupo');
    api.setViewer('marta');
    const tomorrow = await collectFacts(api, new Date(2026, 11, 23));
    expect(notices(now, tomorrow).map((n) => n.text)).toContain('Navidad en familia es mañana');
  });
});

describe('V-19: lo visto muere con la sesión', () => {
  it('forget borra lo de otras personas, y todo sin sesión', () => {
    const store = new Map<string, string>();
    const fake = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    const ls = new Proxy(fake, { ownKeys: () => [...store.keys()], getOwnPropertyDescriptor: (_t, k) => (store.has(String(k)) ? { enumerable: true, configurable: true, value: store.get(String(k)) } : undefined) });
    const prev = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
    try {
      seenFacts.set('papa', []);
      seenFacts.set('marta', []);
      store.set('otra-cosa', '1');
      seenFacts.forget('marta');
      expect([...store.keys()].sort()).toEqual(['lazo:avisos:marta', 'otra-cosa']);
      seenFacts.forget();
      expect([...store.keys()]).toEqual(['otra-cosa']);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
    }
  });
});
