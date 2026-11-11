// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../src/ai/provider';
import { mapColumnsAI, suggestIdeas } from '../../src/ai/tasks';

/**
 * Pruebas en vivo con los proveedores gratuitos. Solo corren si hay claves en el entorno (p. ej. `.env.local`,
 * que no se sube). Nunca se imprimen. Uso (WSL): set -a; . ./.env.local; set +a; npx vitest run test/integration
 */
const GEMINI = process.env.GEMINI_API_KEY;
const NVIDIA = process.env.NVIDIA_API_KEY;

describe.skipIf(!GEMINI)('Gemini (gratuito, en vivo)', () => {
  const s = { provider: 'gemini' as const, apiKey: GEMINI ?? '' };
  it('el modelo por defecto existe', async () => {
    const preset = PRESETS.find((p) => p.id === 'gemini')!;
    const res = await fetch(`${preset.baseUrl}/models`, { headers: { Authorization: `Bearer ${GEMINI}` } });
    const ids = ((await res.json()) as { data: { id: string }[] }).data.map((m) => m.id.replace(/^models\//, ''));
    expect(ids).toContain(preset.model);
  });
  it('entiende un Excel con cabeceras raras', async () => {
    const map = await mapColumnsAI(s, ['Qué me pido', 'Pasta', 'Dónde', 'Comentario'], [['Bufanda', '20', 'https://tienda.example/b', 'gris'], ['Libro', '15,90', '', '']]);
    expect(map.title).toBe(0);
    expect(map.price).toBe(1);
  }, 60_000);
  it('sugiere ideas por franja de edad y presupuesto', async () => {
    const ideas = await suggestIdeas(s, { band: '6-8', likes: 'dinosaurios y pintar', budgetCents: 3000 });
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.every((i) => i.title.length > 1)).toBe(true);
  }, 60_000);
});

describe.skipIf(!NVIDIA)('NVIDIA NIM (gratuito, en vivo)', () => {
  it('el modelo por defecto existe y responde', async () => {
    const preset = PRESETS.find((p) => p.id === 'nvidia')!;
    const res = await fetch(`${preset.baseUrl}/models`, { headers: { Authorization: `Bearer ${NVIDIA}` } });
    const ids = ((await res.json()) as { data: { id: string }[] }).data.map((m) => m.id);
    expect(ids).toContain(preset.model);
    const ideas = await suggestIdeas({ provider: 'nvidia', apiKey: NVIDIA ?? '' }, { band: '65+', likes: 'jardinería', budgetCents: 4000 });
    expect(ideas.length).toBeGreaterThan(0);
  }, 90_000);
});
