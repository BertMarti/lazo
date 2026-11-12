import { describe, expect, it } from 'vitest';
import { shareMessage } from '../../src/ui/screens/Draw';

describe('shareMessage', () => {
  it('solo lleva tu persona y el enlace a su lista', () => {
    const m = shareMessage('Navidad en familia', 'Javier', 'https://x.test/#/l/l-javier');
    expect(m.text).toBe('Amigo invisible de Navidad en familia: te toca regalar a Javier.');
    expect(m.url).toBe('https://x.test/#/l/l-javier');
    expect(m.copy).toBe('Amigo invisible de Navidad en familia: te toca regalar a Javier. https://x.test/#/l/l-javier');
  });
  it('lleva el número de sorteo para no confundir uno viejo (V-25)', () => {
    expect(shareMessage('G', 'Ana', undefined, 2).text).toBe('Amigo invisible de G (sorteo n.º 2): te toca regalar a Ana.');
  });
  it('sin lista, solo el texto', () => {
    expect(shareMessage('G', 'Ana').copy).toBe('Amigo invisible de G: te toca regalar a Ana.');
  });
});
