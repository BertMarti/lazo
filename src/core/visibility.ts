import type { GiftList, Id } from './types';

/**
 * La regla de la sorpresa: nadie ve el estado de su propia lista. Las listas de niños (sin `user`)
 * sí lo muestran a todos, padres incluidos: la sorpresa es para el niño. El servidor aplica la misma
 * regla en sus reglas de API (server/pb/pb_migrations).
 */
export const canSeeStatus = (viewer: Id, list: Pick<GiftList, 'user'>): boolean => list.user !== viewer;

/** Quién puede añadir o editar regalos de una lista. */
export const canEditList = (viewer: Id, list: Pick<GiftList, 'user' | 'managers'>): boolean =>
  list.user === viewer || list.managers.includes(viewer);
