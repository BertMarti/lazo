import { beforeEach, describe, expect, it } from 'vitest';
import { DemoApi } from '../../src/api/demo';
import { budgetProgress } from '../../src/core/budget';

let api: DemoApi;
beforeEach(() => {
  api = new DemoApi(null);
});

describe('DemoApi', () => {
  it('una reserva ocupa una unidad y luego se agota', async () => {
    api.setViewer('samira');
    await api.gift({ action: 'reserve', item: 'i8', kind: 'self' }); // entradas de Papá: 2 unidades, 1 ya para la hucha
    await expect(api.gift({ action: 'reserve', item: 'i8', kind: 'self' })).rejects.toThrow(/adelantado/);
  });

  it('no se editan listas ajenas', async () => {
    api.setViewer('alberto');
    await expect(api.saveItem('l-papa', { title: 'x', priority: 2, quantity: 1 })).rejects.toThrow();
  });

  it('presupuesto de Mamá en modo mixto: cuenta la hucha; lo individual va aparte', async () => {
    api.setViewer('papa');
    const d = await api.listDetail('l-mama');
    const p = budgetProgress(d.budget!.amountCents, d.items, d.claims, d.contributions, d.group.buyMode);
    // robot comprado con la hucha 339,90 + pañuelo sorpresa para la hucha a precio de lista 35
    expect(p).toMatchObject({ target: 40000, committed: 33990 + 3500 });
  });

  it('cualquiera menos el destinatario puede fijar el presupuesto, también en una plaza libre', async () => {
    api.setViewer('alberto');
    await api.setBudget('l-papa', 25000);
    await api.setBudget('l-loli', 6000);
    api.setViewer('samira');
    expect((await api.listDetail('l-papa')).budget?.amountCents).toBe(25000);
    expect((await api.listDetail('l-loli')).budget?.amountCents).toBe(6000);
  });

  it('crear grupo con plazas: sin repetidos ni el propio creador', async () => {
    api.setViewer('alberto');
    const g = await api.createGroup({ name: 'Boda', occasion: 'boda', currency: 'EUR', buyMode: 'hucha', plazas: ['Lucía', 'lucia ', 'Alberto', '', 'Jorge'] });
    const d = await api.groupDetail(g.id);
    expect(d.lists.map((l) => [l.name, l.user ?? null])).toEqual([['Alberto', 'alberto'], ['Lucía', null], ['Jorge', null]]);
    api.setViewer('papa');
    await expect(api.groupDetail(g.id)).rejects.toThrow(/No perteneces/);
  });

  it('el sorteo solo enseña la propia asignación', async () => {
    api.setViewer('alberto');
    await api.runDraw('navidad', ['alberto', 'juancarlos', 'samira', 'mama', 'papa'], [['mama', 'papa']]);
    const info = await api.drawInfo('navidad');
    expect(info.receiver!.id).not.toBe('alberto');
    expect(Object.keys(info)).toEqual(['draw', 'receiver']);
  });

  it('pagos de la hucha: solo con el tesorero (o el suplente por sus regalos) y solo los ven sus dos partes', async () => {
    api.setViewer('papa');
    await expect(api.addPayment('navidad', { from: 'papa', to: 'mama', amountCents: 100, sub: false })).rejects.toThrow();
    await expect(api.addPayment('navidad', { from: 'papa', to: 'alberto', amountCents: 100, sub: true })).rejects.toThrow();
    await api.addPayment('navidad', { from: 'papa', to: 'samira', amountCents: 500, sub: true });
    api.setViewer('alberto');
    expect((await api.hucha('navidad')).payments.some((p) => p.sub)).toBe(false);
  });
});

import { generalProgress, type HuchaCtx } from '../../src/core/hucha';
describe('hucha en la demo', () => {
  it('P0 de Fable: la barra de Papá cuenta solo la cuenta general (lo del suplente va aparte)', async () => {
    const api = new DemoApi(null);
    api.setViewer('papa');
    const d = await api.hucha('navidad');
    const user = (id?: string) => d.lists.find((l) => l.id === id)?.user;
    const ctx: HuchaCtx = { me: 'papa', members: d.members.map((m) => m.id), lists: d.lists, items: d.items, claims: d.claims, payments: d.payments, treasurer: user(d.group.treasurer), deputy: user(d.group.deputy), treasurerList: d.group.treasurer };
    // Mamá 339,90 entre 4 (mayor resto: a Papá le tocan 84,97) + Juan Carlos 65/4 = 16,25 → 101,22; ha dado 30 al tesorero
    const g = generalProgress(ctx);
    expect(g.put).toBe(3000);
    expect(g.target).toBe(10122);
  });
});
