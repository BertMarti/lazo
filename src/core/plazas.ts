/** Nombres de plaza: sin mayúsculas, tildes ni espacios de más, para detectar repetidos. */
export const normName = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** «¿Quiénes sois?» (un nombre por línea) → plazas: sin vacíos, sin repetidos, sin el creador, máx. 40 de 40 caracteres. */
export function parsePlazas(text: string | string[], creatorName = ''): string[] {
  const seen = new Set([normName(creatorName)]);
  const out: string[] = [];
  for (const raw of Array.isArray(text) ? text : text.split(/\r?\n|,/)) {
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, 40);
    const key = normName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 40) break;
  }
  return out;
}

/** Código de 4 cifras para aprobar una entrada. */
export const joinCode = () => String(crypto.getRandomValues(new Uint16Array(1))[0]! % 10000).padStart(4, '0');

/** Inicial de un nombre, sin «Tía», «Abuelo»…: lo único que se enseña de quien ya está en el grupo. */
export const initial = (name: string) => [...name.replace(/^(abuela|abuelo|tía|tío)\s+/i, '').trim()][0]?.toUpperCase() ?? '·';
