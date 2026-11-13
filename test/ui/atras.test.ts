import { describe, expect, it } from 'vitest';
import { androidBack } from '../../src/ui/atras';
import { pathOf, stepsBackTo } from '../../src/ui/ctx';

describe('androidBack', () => {
  it('con una hoja abierta, atrás (la cierra)', () => expect(androidBack(true, false)).toBe('back'));
  it('con historial, atrás', () => expect(androidBack(false, true)).toBe('back'));
  it('en la pantalla raíz, sale de la app', () => expect(androidBack(false, false)).toBe('exit'));
});

describe('stepsBackTo', () => {
  it('normaliza las rutas', () => {
    expect(pathOf('#/g/navidad')).toBe('g/navidad');
    expect(pathOf('#/')).toBe('');
    expect(pathOf('')).toBe('');
  });
  it('vuelve atrás si el destino es la pantalla anterior', () => {
    expect(stepsBackTo('/g/navidad', { prev: 'g/navidad' })).toBe(1);
    expect(stepsBackTo('/', { prev: '' })).toBe(1);
  });
  it('salta también las hojas abiertas encima', () => expect(stepsBackTo('/l/m', { prev: 'l/m', sheet: 1 })).toBe(2));
  it('sin pantalla anterior (entrar por un enlace) o de otro flujo, no', () => {
    expect(stepsBackTo('/g/navidad', {})).toBe(0);
    expect(stepsBackTo('/g/navidad', null)).toBe(0);
    expect(stepsBackTo('/g/navidad', { prev: 'l/marta/nuevo' })).toBe(0);
  });
});
