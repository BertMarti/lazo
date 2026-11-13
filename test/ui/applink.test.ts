import { describe, expect, it } from 'vitest';
import { linkAction } from '../../src/ui/screens/Connect';

const T = 'A'.repeat(20);
const ok = `https://milazo.example/#/unirse/${T}`;

describe('linkAction (V-33)', () => {
  it('sin servidor guardado y sin host de compilación, ninguna URL fija servidor', () => {
    expect(linkAction(ok, null)).toBeNull();
    expect(linkAction(ok, null, '')).toBeNull();
  });
  it('con host, solo https://<host>/#/unirse/<token>', () => {
    expect(linkAction(ok, null, 'milazo.example')).toEqual({ hash: `/unirse/${T}`, server: 'https://milazo.example' });
    expect(linkAction(ok, null, 'MiLazo.Example')).toEqual({ hash: `/unirse/${T}`, server: 'https://milazo.example' });
  });
  it('rechaza http, content, otro host, userinfo, token corto y enlaces escondidos', () => {
    for (const bad of [
      `http://milazo.example/#/unirse/${T}`,
      `content://milazo.example/#/unirse/${T}`,
      `https://otro.example/#/unirse/${T}`,
      `https://milazo.example@otro.example/#/unirse/${T}`,
      'https://milazo.example/#/unirse/corto',
      `https://milazo.example/#/g/navidad`,
      `content://x/?u=${ok}`,
      `https://otro.example/?u=${ok}`,
      `https://otro.example/ ${ok}`,
    ])
      expect(linkAction(bad, null, 'milazo.example'), bad).toBeNull();
  });
  it('con servidor guardado, solo cambia la ruta si el origen coincide', () => {
    expect(linkAction(ok, 'https://milazo.example')).toEqual({ hash: `/unirse/${T}` });
    expect(linkAction(ok, 'https://milazo.example', 'milazo.example')).toEqual({ hash: `/unirse/${T}` });
    expect(linkAction(`https://otro.example/#/unirse/${T}`, 'https://milazo.example', 'otro.example')).toBeNull();
  });
});
