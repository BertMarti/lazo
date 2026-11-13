import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Los iconos los genera scripts/iconos.py: aquí se comprueba que el manifiesto y Android apuntan a ellos. */
const png = (p: string) => {
  const b = readFileSync(p);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const RES = 'android/app/src/main/res';

describe('iconos de la marca', () => {
  it('el manifiesto lista PNG reales con su tamaño, incluido el maskable', () => {
    const icons = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')).icons as { src: string; sizes: string; purpose: string }[];
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const i of icons.filter((i) => i.src.endsWith('.png'))) {
      const [w, h] = png(`public/${i.src}`);
      expect(`${w}x${h}`).toBe(i.sizes);
    }
    expect(png('public/apple-touch-icon.png')).toEqual([180, 180]);
  });

  it('el icono adaptativo de Android es el lazo, con versión monocroma', () => {
    for (const n of ['ic_launcher', 'ic_launcher_round']) {
      const xml = readFileSync(`${RES}/mipmap-anydpi-v26/${n}.xml`, 'utf8');
      expect(xml).toContain('@drawable/ic_launcher_foreground');
      expect(xml).toContain('<monochrome android:drawable="@drawable/ic_launcher_monochrome"/>');
    }
    expect(readFileSync(`${RES}/drawable/ic_launcher_foreground.xml`, 'utf8')).toContain('#b4532e');
    // El foreground de Capacitor (drawable-v24) taparía el nuestro en Android 7 o superior.
    expect(existsSync(`${RES}/drawable-v24/ic_launcher_foreground.xml`)).toBe(false);
    expect(png(`${RES}/mipmap-xxxhdpi/ic_launcher.png`)).toEqual([192, 192]);
  });
});
