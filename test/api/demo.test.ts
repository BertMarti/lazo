import { beforeEach, describe, expect, it } from 'vitest';
import { DemoApi } from '../../src/api/demo';

let api: DemoApi;
beforeEach(() => {
  api = new DemoApi(null);
});

describe('DemoApi aplica la sorpresa como el servidor', () => {
  it('Marta no ve que Pablo le compró los auriculares; Lucía sí', async () => {
    api.setViewer('marta');
    const own = await api.listDetail('l-marta');
    expect(own.canSee).toBe(false);
    expect(own.claims).toEqual([]);
    expect(own.contributions).toEqual([]);

    api.setViewer('lucia');
    const other = await api.listDetail('l-marta');
    expect(other.canSee).toBe(true);
    expect(other.claims.some((c) => c.item === 'i1' && c.status === 'bought')).toBe(true);
  });

  it('la lista de Vera (sin cuenta) la ven sus padres con estado', async () => {
    api.setViewer('marta');
    const vera = await api.listDetail('l-vera');
    expect(vera.canSee).toBe(true);
    expect(vera.canEdit).toBe(true);
    expect(vera.claims.length).toBeGreaterThan(0);
  });

  it('no se puede reservar en la propia lista ni editar listas ajenas', async () => {
    api.setViewer('marta');
    await expect(api.claim('i2', 'reserved')).rejects.toThrow(/propia lista/);
    await expect(api.saveItem('l-pablo', { title: 'x', priority: 2, quantity: 1 })).rejects.toThrow();
  });

  it('una reserva ocupa una unidad y luego se agota', async () => {
    api.setViewer('jorge');
    await api.claim('i4', 'reserved'); // calcetines: cantidad 2, uno ya reservado
    await expect(api.claim('i4', 'reserved')).rejects.toThrow(/adelantado/);
  });

  it('el sorteo solo enseña la propia asignación', async () => {
    api.setViewer('marta');
    await api.runDraw('navidad', ['marta', 'pablo', 'lucia', 'jorge', 'carmen'], [['marta', 'pablo']]);
    const info = await api.drawInfo('navidad');
    expect(info.receiver).toBeDefined();
    expect(info.receiver!.id).not.toBe('marta');
    expect(info.receiver!.id).not.toBe('pablo');
    expect(Object.keys(info)).toEqual(['draw', 'receiver']);
  });

  it('solo los miembros del grupo ven sus listas', async () => {
    api.setViewer('marta');
    const g = await api.createGroup({ name: 'Boda', occasion: 'boda', currency: 'EUR' });
    api.setViewer('jorge');
    await expect(api.groupDetail(g.id)).rejects.toThrow(/No perteneces/);
  });
});
