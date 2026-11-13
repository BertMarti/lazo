import { createContext, useContext, useEffect, useState } from 'react';
import type { Api } from '../api/types';
import type { GiftList, User } from '../core/types';
import { flavorOf, type Flavor } from './kit';

export const ApiCtx = createContext<Api>(null as unknown as Api);
export const useApi = () => useContext(ApiCtx);

/** Ruta actual en el hash (#/g/navidad → ['g', 'navidad']). */
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [r, setR] = useState(read);
  useEffect(() => {
    // La primera pantalla (entrar por un enlace) no tiene anterior.
    if (history.state == null) history.replaceState({}, '');
    const on = (e: HashChangeEvent) => {
      // Entrada nueva del historial: se apunta de qué pantalla venimos, para que «‹ Volver» vuelva atrás de verdad.
      if (history.state == null) history.replaceState({ prev: pathOf(new URL(e.oldURL).hash) }, '');
      setR(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
/** '#/g/navidad', '/g/navidad' y 'g/navidad/' son la misma pantalla. */
export const pathOf = (hash: string) => hash.replace(/^#?\/?/, '').replace(/\/$/, '');

/** Pasos atrás que llevan a `path` si es la pantalla anterior (contando las hojas abiertas encima), o 0. */
export const stepsBackTo = (path: string, state: { prev?: string; sheet?: number } | null): number =>
  state?.prev !== undefined && state.prev === pathOf(path) ? 1 + (state.sheet ?? 0) : 0;

/** Navega; si el destino es la pantalla anterior, vuelve atrás (no apila un duplicado). */
export const go = (path: string) => {
  const n = stepsBackTo(path, history.state);
  if (n) history.go(-n);
  else location.hash = path;
};

/** Sabor de una lista: el de su dueño; las de niños, canela. */
export const listFlavor = (list: GiftList, users: Pick<User, 'id' | 'color'>[]): Flavor =>
  list.user ? flavorOf(users.find((u) => u.id === list.user)?.color) : 'canela';

/** Último grupo abierto, para las pestañas. */
export const lastGroup = {
  get: () => {
    try {
      return localStorage.getItem('lazo:last-group');
    } catch {
      return null;
    }
  },
  set: (id: string) => {
    try {
      localStorage.setItem('lazo:last-group', id);
    } catch {
      /* sin almacenamiento */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem('lazo:last-group');
    } catch {
      /* sin almacenamiento */
    }
  },
};
