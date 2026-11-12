/** Mala cobertura: mensajes y reintentos de red (spec v1.0, tarea P). */
export const OFFLINE_READ = 'No hay conexión. Lo intentamos otra vez cuando vuelva.';
export const OFFLINE_WRITE = 'No se ha podido guardar: no hay conexión. Inténtalo otra vez.';
export const RETRY_DELAYS = [500, 1500, 4000];
const TIMEOUT_MS = 15_000;

/**
 * `fetch` que reintenta SOLO lecturas (quien lo usa decide: PocketBaseApi lo pone en los GET).
 * Reintenta si la red cae (TypeError) o si tarda más de 15 s; una respuesta HTTP, aunque sea 500, no se reintenta.
 */
export function retryingFetch(delays = RETRY_DELAYS, f: typeof fetch = (...a) => fetch(...a)): typeof fetch {
  return async (input, init) => {
    for (let i = 0; ; i++) {
      try {
        return await f(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) });
      } catch (e) {
        if (init?.signal?.aborted || i >= delays.length) throw e;
        await new Promise((r) => setTimeout(r, delays[i]));
      }
    }
  };
}
