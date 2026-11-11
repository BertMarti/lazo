import { LIMITS, type Cents } from './types';

/**
 * Convierte lo que escribe una persona (o una celda de Excel) en céntimos: «12,5», «12.50», «1.234,56»,
 * «1,234.56», «€ 7», 19.99. Devuelve `null` si no es un importe válido. Adaptado de Repartito.
 */
export function parseAmount(input: string | number): Cents | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return null;
    const c = Math.round(input * 100);
    return c > 0 && c <= LIMITS.amount ? c : null;
  }
  const raw = input.replace(/[\s €$£]|EUR|USD|GBP/gi, '');
  if (!/^\d[\d.,]*$/.test(raw) || /[.,]{2}/.test(raw)) return null;
  const dec = Math.max(raw.lastIndexOf(','), raw.lastIndexOf('.'));
  const frac = dec === -1 ? '' : raw.slice(dec + 1);
  let normalized: string;
  if (dec !== -1 && frac.length >= 1 && frac.length <= 2) {
    normalized = raw.slice(0, dec).replace(/[.,]/g, '') + '.' + frac;
  } else {
    if (dec !== -1 && frac.length !== 3) return null;
    normalized = raw.replace(/[.,]/g, '');
  }
  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) && cents > 0 && cents <= LIMITS.amount ? cents : null;
}

export function formatMoney(cents: Cents, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(cents / 100);
}
