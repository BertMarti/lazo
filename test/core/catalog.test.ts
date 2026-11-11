import { describe, expect, it } from 'vitest';
import { IDEAS } from '../../src/ai/catalog';
import { AGE_BANDS } from '../../src/ai/tasks';

const TAGS = new Set(['lectura', 'juego', 'deporte', 'cocina', 'música', 'arte', 'tecnología', 'naturaleza', 'viajes', 'moda', 'hogar', 'bienestar', 'experiencias', 'aprendizaje', 'manualidades', 'coleccionismo']);

describe('catálogo de ideas (sin IA)', () => {
  it('cubre todas las franjas con ideas válidas', () => {
    for (const band of AGE_BANDS) {
      const list = IDEAS[band];
      expect(list.length, band).toBeGreaterThanOrEqual(10);
      for (const i of list) {
        expect(i.title.length, i.title).toBeLessThanOrEqual(45);
        expect(i.why.length, i.why).toBeLessThanOrEqual(80);
        expect(i.minCents, i.title).toBeGreaterThan(0);
        expect(i.minCents, i.title).toBeLessThan(i.maxCents);
        expect(i.tags.every((t) => TAGS.has(t)), i.title).toBe(true);
        expect(`${i.title} ${i.why}`, i.title).not.toMatch(/[!¡]|\p{Extended_Pictographic}/u);
      }
      expect(new Set(list.map((i) => i.title)).size, band).toBe(list.length);
    }
  });
});
