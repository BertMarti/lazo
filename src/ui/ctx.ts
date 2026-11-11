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
    const on = () => {
      setR(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
export const go = (path: string) => {
  location.hash = path;
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
};
