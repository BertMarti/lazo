import { describe, expect, it } from 'vitest';
import { saneaProducto } from '../../src/core/amazonLista';
import type { AmazonProducto } from '../../src/core/amazonLista';

describe('saneaProducto (V-50)', () => {
  it('descarta null, arrays y ASIN que no son texto sin lanzar', () => {
    for (const p of [null, undefined, [], 'x', 42, { asin: ['B0AAAAAAAA'], title: 'x' }, { asin: 7, title: 'x' }]) {
      expect(saneaProducto(p as unknown as AmazonProducto)).toBeNull();
    }
  });
  it('construye el enlace desde el ASIN', () => {
    expect(saneaProducto({ asin: 'B0AAAAAAAA', title: 'Taza', url: 'https://malo.example/x' } as AmazonProducto)?.url).toBe('https://www.amazon.es/dp/B0AAAAAAAA');
  });
});
