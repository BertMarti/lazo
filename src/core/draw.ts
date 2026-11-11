import type { Id } from './types';

export class DrawImpossible extends Error {
  constructor(
    public reason: string,
    public who?: Id,
  ) {
    super(reason);
    this.name = 'DrawImpossible';
  }
}

const MAX_STEPS = 10_000;

/**
 * Amigo invisible: a cada persona le toca otra distinta, nadie se regala a sí mismo y se respetan las
 * exclusiones (pares simétricos). Barajado + búsqueda con retroceso, con tope de pasos para no colgarse.
 * Este mismo código lo usa el servidor (se compila a server/pb/pb_hooks/lib/draw.cjs).
 */
export function drawPairs(ids: Id[], exclusions: [Id, Id][], rand: () => number): Map<Id, Id> {
  const people = [...new Set(ids)];
  if (people.length < 3) throw new DrawImpossible('Hacen falta al menos 3 personas.');
  const banned = new Set<string>();
  for (const [a, b] of exclusions) {
    banned.add(`${a}>${b}`);
    banned.add(`${b}>${a}`);
  }
  const allowed = (g: Id, r: Id) => g !== r && !banned.has(`${g}>${r}`);
  for (const g of people) {
    if (!people.some((r) => allowed(g, r)))
      throw new DrawImpossible('Con estas exclusiones, hay alguien que no puede regalar a nadie.', g);
  }
  const shuffle = <T,>(xs: T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  const givers = shuffle(people);
  const taken = new Set<Id>();
  const out = new Map<Id, Id>();
  let steps = 0;
  const solve = (i: number): boolean => {
    if (i === givers.length) return true;
    const g = givers[i]!;
    for (const r of shuffle(people)) {
      if (++steps > MAX_STEPS) return false;
      if (taken.has(r) || !allowed(g, r)) continue;
      taken.add(r);
      out.set(g, r);
      if (solve(i + 1)) return true;
      taken.delete(r);
      out.delete(g);
    }
    return false;
  };
  if (!solve(0)) throw new DrawImpossible('Con estas exclusiones no hay ningún reparto posible. Quita alguna.');
  return out;
}

/** Aleatorio criptográfico en [0, 1) con Web Crypto (navegador y Node). En PocketBase se pasa su propio generador. */
export const cryptoRand = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
