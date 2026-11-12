import { describe, expect, it } from 'vitest';
import { shareMessage } from '../../src/ui/screens/Draw';

describe('shareMessage', () => {
  it('solo lleva tu persona y el enlace a su lista', () => {
    const m = shareMessage('Navidad en familia', 'Juan Carlos', 'https://x.test/#/l/l-juancarlos');
    expect(m.text).toBe('Amigo invisible de Navidad en familia: te toca regalar a Juan Carlos.');
    expect(m.url).toBe('https://x.test/#/l/l-juancarlos');
    expect(m.copy).toBe('Amigo invisible de Navidad en familia: te toca regalar a Juan Carlos. https://x.test/#/l/l-juancarlos');
  });
  it('sin lista, solo el texto', () => {
    expect(shareMessage('G', 'Ana').copy).toBe('Amigo invisible de G: te toca regalar a Ana.');
  });
});
