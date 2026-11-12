import { afterEach, describe, expect, it, vi } from 'vitest';
import { PocketBaseApi } from '../../src/api/pocketbase';
import { guardaCompartido, leeCompartido } from '../../src/ui/compartido';

// V-28: cerrar sesión deja el navegador sin nada de la persona.
const fill = (api: PocketBaseApi) => {
  localStorage.clear();
  api.pb.authStore.save('token.viejo.x', { id: 'u1', collectionId: 'users', collectionName: 'users', name: 'Papá' });
  localStorage.setItem('lazo:avisos:u1', '[{"id":"g"}]');
  localStorage.setItem('lazo:pendiente:abc', '{}');
  localStorage.setItem('lazo:last-group', 'g1');
  localStorage.setItem('lazo:ia', '{"apiKey":"k"}');
  localStorage.setItem('lazo:server', 'https://casa.example');
  guardaCompartido('Lista compartida desde otra app');
};
const left = () => Object.keys(localStorage).sort();

afterEach(() => vi.unstubAllGlobals());

describe('signOut', () => {
  it('en este móvil: sin sesión ni avisos, pendientes, último grupo ni clave de IA; sin llamar al servidor', async () => {
    const f = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', f);
    const api = new PocketBaseApi('http://lazo.test');
    fill(api);
    await api.signOut(false);
    expect(api.me()).toBeNull();
    expect(left()).toEqual(['lazo:server']);
    expect(leeCompartido()).toBeNull(); // V11-4
    expect(f).not.toHaveBeenCalled();
  });

  it('en todos: llama a logout-all y no guarda el token nuevo', async () => {
    const f = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ token: 'token.nuevo.y', record: { id: 'u1' } }), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', f);
    const api = new PocketBaseApi('http://lazo.test');
    fill(api);
    await api.signOut(true);
    expect(String(f.mock.calls[0]![0])).toContain('/api/lazo/logout-all');
    expect(api.me()).toBeNull();
    expect(left()).toEqual(['lazo:server']);
  });

  it('si logout-all falla, no dice que ha salido: sigue la sesión y avisa', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch'))));
    const api = new PocketBaseApi('http://lazo.test', [0]);
    fill(api);
    await expect(api.signOut(true)).rejects.toThrow();
    expect(api.me()?.id).toBe('u1');
  });
});
