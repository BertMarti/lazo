import type { Api, HuchaData } from '../api/types';
import { due, type HuchaCtx } from './hucha';
import { formatMoney } from './money';
import type { Cents, Id } from './types';

/**
 * Avisos del grupo (campana de la cabecera). Se calculan en el cliente SOLO con lo que el servidor ya
 * entrega a quien mira, y además se descarta a mano todo lo de sus propias plazas: nada de reservas,
 * compras, sorpresas ni presupuesto, ni contado ni deducible. Lo último visto vive en localStorage.
 */

/** Lo que una persona sabe de un grupo, reducido a lo que puede dar un aviso. Nada de sus plazas. */
export interface Facts {
  id: Id;
  name: string;
  members: { id: Id; name: string }[];
  lists: { id: Id; name: string; user?: Id }[];
  /** Regalos visibles de las listas ajenas, sin sorpresas ni retirados ni los que apuntó uno mismo. */
  items: { id: Id; list: Id; by: Id }[];
  draw?: Id;
  /** Lo que me toca poner en la hucha (cuenta general + aparte). */
  due: Cents;
  /** Cuenta atrás: 10, 3 o 1 día (el umbral) y los días que faltan de verdad. */
  stage?: 10 | 3 | 1;
  days?: number;
}

export interface Notice {
  key: string;
  text: string;
  group: string;
  href: string;
}

const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
const daysTo = (iso: string, today: Date) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - day(today)) / 86_400_000);
};

export function buildFacts(me: Id, h: HuchaData, drawId: Id | undefined, today: Date): Facts {
  const mine = new Set(h.lists.filter((l) => l.user === me).map((l) => l.id));
  const userOf = (listId?: Id) => h.lists.find((l) => l.id === listId)?.user;
  const T = userOf(h.group.treasurer);
  const T2 = userOf(h.group.deputy);
  // Nunca se pasan filas de mis plazas, aunque el servidor ya no las mande.
  const foreign = h.items.filter((i) => !mine.has(i.list));
  const ids = new Set(foreign.map((i) => i.id));
  const ctx: HuchaCtx = {
    me,
    members: h.members.map((m) => m.id),
    lists: h.lists,
    items: foreign,
    claims: h.claims.filter((c) => ids.has(c.item)),
    payments: h.payments,
    treasurer: T,
    deputy: T2,
    treasurerList: h.group.treasurer,
  };
  const d = T && T2 ? due(me, ctx) : { general: 0, aparte: 0 };
  const days = h.group.date ? daysTo(h.group.date, today) : undefined;
  const stage = days === undefined || days < 1 ? undefined : days === 1 ? 1 : days <= 3 ? 3 : days <= 10 ? 10 : undefined;
  return {
    id: h.group.id,
    name: h.group.name,
    members: h.members.filter((m) => m.id !== me).map((m) => ({ id: m.id, name: m.name })),
    lists: h.lists.filter((l) => !mine.has(l.id)).map((l) => ({ id: l.id, name: l.name, user: l.user })),
    items: foreign.filter((i) => !i.secret && !i.removed && i.createdBy !== me).map((i) => ({ id: i.id, list: i.list, by: i.createdBy })),
    draw: drawId,
    due: Math.max(0, d.general) + Math.max(0, d.aparte),
    stage,
    days: stage ? days : undefined,
  };
}

/** Todo lo que la persona puede saber, grupo a grupo. Solo llamadas que ya respetan la regla. */
export async function collectFacts(api: Api, today = new Date()): Promise<Facts[]> {
  const me = api.me();
  if (!me) return [];
  const groups = await api.groups();
  return Promise.all(groups.map(async (g) => buildFacts(me.id, await api.hucha(g.id), (await api.drawInfo(g.id)).draw?.id, today)));
}

const plural = (n: number) => (n === 1 ? '1 regalo' : `${n} regalos`);

/** Lo nuevo desde la última vez. Sin `prev` de un grupo, sus regalos y personas cuentan como ya vistos. */
export function notices(prev: Facts[], now: Facts[]): Notice[] {
  const out: Notice[] = [];
  for (const g of now) {
    const p = prev.find((x) => x.id === g.id);
    const add = (key: string, text: string, href: string) => out.push({ key: `${g.id}:${key}`, text, group: g.name, href });
    if (g.stage && g.stage !== p?.stage) add(`dia-${g.stage}`, g.days === 1 ? `${g.name} es mañana` : `Faltan ${g.days} días para ${g.name}`, `/g/${g.id}`);
    if (g.draw && g.draw !== p?.draw) add(`sorteo-${g.draw}`, 'Han hecho el sorteo', `/sorteo/${g.id}`);
    if (g.due > 0 && g.due !== p?.due) add(`hucha-${g.due}`, `Te toca poner ${formatMoney(g.due, 'EUR', true)} en la hucha`, `/hucha/${g.id}`);
    if (!p) continue;
    const seen = new Set(p.members.map((m) => m.id));
    for (const m of g.members) if (!seen.has(m.id)) add(`entra-${m.id}`, `${m.name} ha entrado en el grupo`, `/g/${g.id}`);
    const old = new Set(p.items.map((i) => i.id));
    const fresh = new Map<string, number>();
    for (const i of g.items) if (!old.has(i.id)) fresh.set(`${i.list}|${i.by}`, (fresh.get(`${i.list}|${i.by}`) ?? 0) + 1);
    for (const [k, n] of fresh) {
      const [listId, by] = k.split('|') as [Id, Id];
      const list = g.lists.find((l) => l.id === listId);
      const who = g.members.find((m) => m.id === by)?.name ?? 'Alguien';
      const where = list?.user === by ? 'a su lista' : `a la lista de ${list?.name ?? 'alguien'}`;
      add(`regalos-${k}`, `${who} ha añadido ${plural(n)} ${where}`, `/l/${listId}`);
    }
  }
  return out;
}

/** Un grupo que no se había visto nunca: sus regalos y personas, ya vistos; fecha, sorteo y hucha, aún no. */
export const withBaseline = (prev: Facts[], now: Facts[]): Facts[] => [
  ...prev,
  ...now.filter((g) => !prev.some((p) => p.id === g.id)).map((g) => ({ ...g, draw: undefined, due: 0, stage: undefined, days: undefined })),
];

// — Lo último visto, por persona (la demo cambia de persona en el mismo navegador) —
const KEY = (me: Id) => `lazo:avisos:${me}`;
export const seenFacts = {
  get(me: Id): Facts[] {
    try {
      return JSON.parse(localStorage.getItem(KEY(me)) ?? '[]') as Facts[];
    } catch {
      return [];
    }
  },
  set(me: Id, facts: Facts[]) {
    try {
      localStorage.setItem(KEY(me), JSON.stringify(facts));
    } catch {
      /* sin almacenamiento: los avisos vuelven a salir */
    }
  },
};
