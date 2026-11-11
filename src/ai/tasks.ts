import type { ColumnMap, Field } from '../core/columns';
import { chatJson, z, type AiSettings } from './provider';

export type AgeBand = '0-2' | '3-5' | '6-8' | '9-12' | '13-17' | '18-35' | '36-64' | '65+';
export const AGE_BANDS: AgeBand[] = ['0-2', '3-5', '6-8', '9-12', '13-17', '18-35', '36-64', '65+'];

/** Año de nacimiento → franja. A la IA solo le llega la franja: nunca el año ni el nombre. */
export function ageBand(birthYear: number, now = new Date().getFullYear()): AgeBand {
  const a = now - birthYear;
  if (a <= 2) return '0-2';
  if (a <= 5) return '3-5';
  if (a <= 8) return '6-8';
  if (a <= 12) return '9-12';
  if (a <= 17) return '13-17';
  if (a <= 35) return '18-35';
  if (a <= 64) return '36-64';
  return '65+';
}

const FIELDS: Field[] = ['title', 'price', 'url', 'size', 'color', 'notes', 'priority', 'quantity'];

/** Mapear columnas de un Excel raro: solo cabeceras y 3 filas de muestra, nunca la hoja entera. */
export async function mapColumnsAI(s: AiSettings, headers: string[], sample: unknown[][], fetchImpl?: typeof fetch): Promise<ColumnMap> {
  const schema = z.record(z.string(), z.number().int().min(0).max(headers.length - 1).nullable());
  const out = await chatJson(
    s,
    schema,
    'Eres un asistente que entiende hojas de cálculo de listas de regalos. Respondes SOLO con JSON.',
    `Cabeceras (índice: nombre): ${headers.map((h, i) => `${i}: ${String(h).slice(0, 60)}`).join(' | ')}
Tres filas de ejemplo: ${JSON.stringify(sample.slice(0, 3).map((r) => r.slice(0, headers.length).map((c) => String(c ?? '').slice(0, 60))))}
Devuelve un objeto JSON con estas claves y el índice de la columna que corresponde (o null): ${FIELDS.join(', ')}.
title = nombre del regalo; price = precio; url = enlace; priority = prioridad o ganas; quantity = cantidad.`,
    fetchImpl,
  );
  const map: ColumnMap = {};
  for (const f of FIELDS) if (typeof out[f] === 'number') map[f] = out[f] as number;
  return map;
}

export interface IdeaRequest {
  band: AgeBand;
  likes: string;
  budgetCents?: number;
}
export interface AiIdea {
  title: string;
  why: string;
  priceCents?: number;
  search: string;
}

/** Ideas de regalo por franja de edad, gustos y presupuesto. Sin datos personales en el prompt. */
export async function suggestIdeas(s: AiSettings, req: IdeaRequest, fetchImpl?: typeof fetch): Promise<AiIdea[]> {
  const schema = z.object({
    ideas: z
      .array(z.object({ title: z.string().min(2).max(80), why: z.string().max(140), priceEur: z.number().min(0).max(5000).optional(), search: z.string().max(80) }))
      .min(1)
      .max(8),
  });
  const likes = req.likes.replace(/\s+/g, ' ').trim().slice(0, 200);
  const out = await chatJson(
    s,
    schema,
    'Sugieres regalos concretos y genéricos (sin marcas) para una familia española. Frases cortas, sin exclamaciones ni emojis. Respondes SOLO con JSON.',
    `Franja de edad: ${req.band} años. Gustos: ${likes || 'sin especificar'}. ${req.budgetCents ? `Presupuesto máximo: ${Math.round(req.budgetCents / 100)} €.` : ''}
Devuelve {"ideas":[{"title":"…","why":"…","priceEur":25,"search":"términos para buscar en una tienda"}]} con 6 ideas.`,
    fetchImpl,
  );
  return out.ideas.map((i) => ({ title: i.title, why: i.why, priceCents: i.priceEur !== undefined ? Math.round(i.priceEur * 100) : undefined, search: i.search }));
}
