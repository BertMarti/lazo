import { describe, expect, it } from 'vitest';
import { extractJson } from '../../src/ai/provider';
import { ageBand, mapColumnsAI, suggestIdeas } from '../../src/ai/tasks';

/** fetch falso que guarda lo que se envía y responde como un proveedor compatible con OpenAI. */
function fakeFetch(content: string, status = 200) {
  const sent: string[] = [];
  const f = (async (_url: string, init?: RequestInit) => {
    sent.push(String(init?.body ?? ''));
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
  }) as typeof fetch;
  return { f, sent };
}
const gemini = { provider: 'gemini' as const, apiKey: 'clave-de-prueba' };

describe('IA', () => {
  it('franjas de edad', () => {
    expect(ageBand(2020, 2026)).toBe('6-8');
    expect(ageBand(1950, 2026)).toBe('65+');
    expect(ageBand(2026, 2026)).toBe('0-2');
  });

  it('extrae JSON entre ``` o con texto alrededor', () => {
    expect(extractJson('Aquí va:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('vale {"b":[2]} gracias')).toEqual({ b: [2] });
  });

  it('las ideas nunca llevan nombre ni año, solo la franja', async () => {
    const { f, sent } = fakeFetch('{"ideas":[{"title":"Caja de acuarelas","why":"Para pintar","priceEur":19.9,"search":"acuarelas niños"}]}');
    const ideas = await suggestIdeas(gemini, { band: '6-8', likes: 'Le encanta pintar', budgetCents: 3000 }, f);
    expect(ideas[0]).toMatchObject({ title: 'Caja de acuarelas', priceCents: 1990 });
    expect(sent[0]).toContain('6-8');
    expect(sent[0]).not.toMatch(/Vera|2020|birthYear/);
  });

  it('el mapeo de columnas envía solo cabeceras y 3 filas, y descarta índices imposibles', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => [`Regalo ${i}`, i, `secreto-${i}`]);
    const { f, sent } = fakeFetch('{"title":0,"price":1,"url":null,"notes":2}');
    const map = await mapColumnsAI(gemini, ['Qué', 'Pasta', 'Cosas'], rows, f);
    expect(map).toEqual({ title: 0, price: 1, notes: 2 });
    expect(sent[0]).toContain('secreto-2');
    expect(sent[0]).not.toContain('secreto-3');
    const bad = fakeFetch('{"title":9}');
    await expect(mapColumnsAI(gemini, ['a'], [], bad.f)).rejects.toThrow();
  });

  it('errores claros: clave mala y límite gratuito', async () => {
    await expect(suggestIdeas(gemini, { band: '18-35', likes: '' }, fakeFetch('', 401).f)).rejects.toThrow(/clave/);
    await expect(suggestIdeas(gemini, { band: '18-35', likes: '' }, fakeFetch('', 429).f)).rejects.toThrow(/límite/);
    await expect(suggestIdeas({ provider: 'none', apiKey: '' }, { band: '18-35', likes: '' })).rejects.toThrow(/Ajustes/);
  });
});

import { parseInvite } from '../../src/ui/screens/Connect';
describe('enlace de invitación (Android)', () => {
  it('saca servidor y token; rechaza http y enlaces raros', () => {
    expect(parseInvite('Únete: https://milazo.duckdns.org/#/unirse/AbCdEfGhIjKlMnOpQrStUvWxYz012345 ¡te esperamos!')).toEqual({ server: 'https://milazo.duckdns.org', token: 'AbCdEfGhIjKlMnOpQrStUvWxYz012345' });
    expect(parseInvite('http://milazo.duckdns.org/#/unirse/AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBeNull();
    expect(parseInvite('https://evil.example/#/unirse/<script>')).toBeNull();
    expect(parseInvite('hola')).toBeNull();
  });
});
