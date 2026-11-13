import { describe, expect, it } from 'vitest';
import { normName } from '../../src/core/plazas';

// v1.1.3: la confirmación de «Eliminar grupo» comparaba el nombre escrito con igualdad exacta y fallaba en el móvil.
// Ya no se usa para confirmar, pero normName compara nombres en otros sitios (plazas repetidas, servidor).
describe('normName: el mismo nombre escrito de formas distintas', () => {
  const variantes = [
    'Navidad 2026',
    ' Navidad 2026 ',
    'navidad 2026',
    'NAVIDAD  2026',
    'Navidad 2026', // espacio duro
    'Navidad 2026', // espacio fino
    'Navidad 2026​', // ancho cero al final
    '﻿Navidad 2026',
  ];
  for (const v of variantes) it(JSON.stringify(v), () => expect(normName(v)).toBe('navidad 2026'));

  it('tildes en NFC y NFD, y sin tilde', () => {
    const nfc = 'Cumpleaños de Mónica'.normalize('NFC');
    const nfd = 'Cumpleaños de Mónica'.normalize('NFD');
    expect(nfc).not.toBe(nfd);
    expect(normName(nfc)).toBe(normName(nfd));
    expect(normName('Cumpleanos de Monica')).toBe(normName(nfc));
    expect(normName('Reyes Magos · Tía Loli')).toBe(normName('reyes magos · tia loli'));
  });

  it('nombres distintos siguen siendo distintos', () => {
    expect(normName('Navidad 2026')).not.toBe(normName('Navidad 2025'));
    expect(normName('Navidad 2026')).not.toBe(normName('Navidad'));
  });
});
