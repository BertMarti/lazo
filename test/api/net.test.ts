import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_READ, OFFLINE_WRITE, retryingFetch } from '../../src/api/net';
import { PocketBaseApi } from '../../src/api/pocketbase';

const down = () => vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch')));
const empty = () => new Response(JSON.stringify({ page: 1, perPage: 1000, totalItems: 0, totalPages: 0, items: [] }), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('retryingFetch', () => {
  it('reintenta 3 veces si cae la red y luego se rinde', async () => {
    const f = down();
    await expect(retryingFetch([0, 0, 0], f)('http://x')).rejects.toThrow(TypeError);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it('para en cuanto responde, y no reintenta una respuesta HTTP (aunque sea 500)', async () => {
    const f = down().mockResolvedValueOnce(new Response('', { status: 500 }));
    const r = await retryingFetch([0, 0, 0], f)('http://x');
    expect(r.status).toBe(500);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('PocketBaseApi sin red', () => {
  it('una lectura (GET) se reintenta y, si sigue sin red, dice que se volverá a intentar', async () => {
    const f = down();
    vi.stubGlobal('fetch', f);
    await expect(new PocketBaseApi('http://lazo.test', [0, 0, 0]).groups()).rejects.toThrow(OFFLINE_READ);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it('una lectura que vuelve al segundo intento carga normal', async () => {
    const f = down().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(empty());
    vi.stubGlobal('fetch', f);
    await expect(new PocketBaseApi('http://lazo.test', [0, 0, 0]).groups()).resolves.toEqual([]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('una escritura (POST) NUNCA se reintenta: avisa de que no se ha guardado', async () => {
    const f = down();
    vi.stubGlobal('fetch', f);
    await expect(new PocketBaseApi('http://lazo.test', [0, 0, 0]).gift({ action: 'reserve', item: 'i1', kind: 'self' })).rejects.toThrow(OFFLINE_WRITE);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('PocketBaseApi.watch', () => {
  it('recarga al reconectar el tiempo real (nuevo clientId), no en la primera conexión', async () => {
    const api = new PocketBaseApi('http://lazo.test');
    vi.spyOn(api.pb.realtime, 'subscribe').mockResolvedValue(async () => {});
    const onChange = vi.fn();
    const stop = api.watch('g1', onChange);
    const connect = (clientId: string) => api.pb.beforeSend!('http://lazo.test/api/realtime', { method: 'POST', body: { clientId, subscriptions: [] } });
    await connect('a');
    await connect('a'); // otra suscripción, misma conexión
    await new Promise((r) => setTimeout(r, 350));
    expect(onChange).not.toHaveBeenCalled();
    await connect('b');
    await new Promise((r) => setTimeout(r, 350));
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    await connect('c');
    await new Promise((r) => setTimeout(r, 350));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
