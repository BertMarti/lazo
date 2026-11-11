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
    await api.claim('i7', 'reserved'); // entradas de Papá: 2 unidades, 1 ya reservada
    await expect(api.claim('i7', 'reserved')).rejects.toThrow(/adelantado/);
  });

  it('no se editan listas ajenas', async () => {
    api.setViewer('alberto');
    await expect(api.saveItem('l-papa', { title: 'x', priority: 2, quantity: 1 })).rejects.toThrow();
  });

  it('el presupuesto de Mamá suma reservas y aportaciones', async () => {
    api.setViewer('papa');
    const d = await api.listDetail('l-mama');
    const p = budgetProgress(d.budget!.amountCents, d.items, d.claims, d.contributions);
    // marco 129 (reservado) + chal 49 (comprado) + robot a medias 100 + 150
    expect(p).toMatchObject({ target: 40000, committed: 12900 + 4900 + 25000, left: 40000 - 42800, over: true, percent: 100 });
  });

  it('cualquiera menos el destinatario puede fijar el presupuesto', async () => {
    api.setViewer('alberto');
    await api.setBudget('l-papa', 25000);
    api.setViewer('samira');
    expect((await api.listDetail('l-papa')).budget?.amountCents).toBe(25000);
  });

  it('el sorteo solo enseña la propia asignación', async () => {
    api.setViewer('alberto');
    await api.runDraw('navidad', ['alberto', 'juancarlos', 'samira', 'mama', 'papa'], [['mama', 'papa']]);
    const info = await api.drawInfo('navidad');
    expect(info.receiver!.id).not.toBe('alberto');
    expect(Object.keys(info)).toEqual(['draw', 'receiver']);
  });

  it('solo los miembros del grupo ven sus listas', async () => {
    api.setViewer('alberto');
    const g = await api.createGroup({ name: 'Boda', occasion: 'boda', currency: 'EUR' });
    api.setViewer('papa');
    await expect(api.groupDetail(g.id)).rejects.toThrow(/No perteneces/);
  });
});
