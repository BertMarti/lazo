import { z, type ZodType } from 'zod';

/**
 * IA opcional. Gratuita por defecto (Gemini con la clave del usuario); Claude es la opción de pago.
 * La clave vive SOLO en este dispositivo (localStorage) y las llamadas van del navegador al proveedor:
 * el servidor de Lazo nunca la ve.
 */
export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'nvidia' | 'ollama' | 'claude';

export interface Preset {
  id: ProviderId;
  name: string;
  baseUrl: string;
  model: string;
  free: boolean;
  keyUrl?: string;
  note: string;
}

export const PRESETS: Preset[] = [
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash', free: true, keyUrl: 'https://aistudio.google.com/apikey', note: 'Gratis con tu clave. Recomendado para empezar.' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'qwen/qwen3.8-27b', free: true, keyUrl: 'https://console.groq.com/keys', note: 'Gratis con tu clave, muy rápido.' },
  { id: 'openrouter', name: 'OpenRouter (modelos :free)', baseUrl: 'https://openrouter.ai/api/v1', model: 'nvidia/nemotron-3.5-super-vl:free', free: true, keyUrl: 'https://openrouter.ai/keys', note: 'Gratis con tu clave.' },
  { id: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'nvidia/nemotron-3.5-super-vl-120b-a12b', free: true, keyUrl: 'https://build.nvidia.com', note: 'Gratis con tu clave. Solo en la app de Android (el navegador lo bloquea).' },
  { id: 'ollama', name: 'Ollama (en tu ordenador)', baseUrl: 'http://localhost:11434/v1', model: 'gemma3', free: true, note: 'Gratis y sin que nada salga de casa.' },
  { id: 'claude', name: 'Claude (de pago)', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-haiku-5-5', free: false, keyUrl: 'https://console.anthropic.com/settings/keys', note: 'Más calidad. Cuesta céntimos al mes con tu clave.' },
];

export interface AiSettings {
  provider: ProviderId | 'none';
  apiKey: string;
  model?: string;
}

const KEY = 'lazo:ia';
export const loadAi = (): AiSettings => {
  try {
    return { provider: 'none', apiKey: '', ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { provider: 'none', apiKey: '' };
  }
};
export const saveAi = (s: AiSettings) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento */
  }
};

export class AiError extends Error {}

/** Saca el JSON de una respuesta aunque venga entre ```json o con texto alrededor. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const s = (fenced?.[1] ?? text).trim();
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (start < 0 || end < start) throw new AiError('La IA no ha devuelto datos válidos.');
  return JSON.parse(s.slice(start, end + 1));
}

/** Pide una respuesta JSON y la valida con Zod. */
export async function chatJson<T>(settings: AiSettings, schema: ZodType<T>, system: string, user: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const preset = PRESETS.find((p) => p.id === settings.provider);
  if (!preset) throw new AiError('Activa una IA en Ajustes.');
  const model = settings.model || preset.model;
  let res: Response;
  try {
    res =
      preset.id === 'claude'
        ? await fetchImpl(`${preset.baseUrl}/messages`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
          })
        : await fetchImpl(`${preset.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
            body: JSON.stringify({ model, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
          });
  } catch {
    throw new AiError(preset.id === 'nvidia' ? 'NVIDIA solo funciona desde la app de Android.' : 'No se ha podido conectar con la IA.');
  }
  if (res.status === 401 || res.status === 403) throw new AiError('La clave no es válida. Revísala en Ajustes.');
  if (res.status === 429) throw new AiError('La IA gratuita ha llegado a su límite. Prueba en un rato o con otro proveedor.');
  if (!res.ok) throw new AiError('La IA no ha podido responder ahora.');
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; content?: { text?: string }[] };
  const text = preset.id === 'claude' ? (body.content?.[0]?.text ?? '') : (body.choices?.[0]?.message?.content ?? '');
  const parsed = schema.safeParse(extractJson(text));
  if (!parsed.success) throw new AiError('La IA ha respondido algo que no entendemos. Inténtalo otra vez.');
  return parsed.data;
}

export { z };
