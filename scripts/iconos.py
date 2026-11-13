"""Iconos de Lazo: una sola geometría del lazo (en la rejilla de 108 dp del icono adaptativo de Android) de la que
salen los vector drawables, el SVG de la web, todos los PNG y la lámina de comprobación.

Uso (Windows, sin npm): python -P scripts/iconos.py
Solo necesita Pillow. Las curvas son M/L/C/Z absolutas: el mismo pathData vale para SVG y para Android.
"""
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'
PUB = ROOT / 'public'
PAPEL, TERRACOTA, TERRA_TINTA, ORO, TINTA, OSCURO = '#f6efe2', '#b4532e', '#9a4222', '#c9a24a', '#2a1d14', '#1b1612'


def mirror(d):
    """Refleja un pathData respecto al eje x = 54."""
    out, i = [], 0
    for tok in re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?', d):
        if tok.isalpha():
            out.append(tok)
            i = 0
        else:
            out.append(f'{(108 - float(tok)) if i % 2 == 0 else float(tok):g}')
            i += 1
    return ' '.join(out)


def scale(d, k):
    """Escala un pathData respecto al centro (54, 54)."""
    return re.sub(r'-?\d+(?:\.\d+)?', lambda m: f'{54 + (float(m.group()) - 54) * k:.2f}', d)


def tail(x0, y0, x1, y1, hw, notch):
    """Cabo: cinta recta de media anchura hw con el corte en uve al final."""
    dx, dy = x1 - x0, y1 - y0
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    px, py = -uy * hw, ux * hw
    pts = [(x0 + px, y0 + py), (x1 + px, y1 + py), (x1 - ux * notch, y1 - uy * notch), (x1 - px, y1 - py), (x0 - px, y0 - py)]
    return 'M ' + ' L '.join(f'{x:.2f} {y:.2f}' for x, y in pts) + ' Z'


def rrect(x, y, w, h, r):
    k = r * 0.5523
    return (f'M {x + r} {y} L {x + w - r} {y} C {x + w - r + k} {y} {x + w} {y + r - k} {x + w} {y + r} '
            f'L {x + w} {y + h - r} C {x + w} {y + h - r + k} {x + w - r + k} {y + h} {x + w - r} {y + h} '
            f'L {x + r} {y + h} C {x + r - k} {y + h} {x} {y + h - r + k} {x} {y + h - r} '
            f'L {x} {y + r} C {x} {y + r - k} {x + r - k} {y} {x + r} {y} Z')


# Geometría del lazo (108 × 108, centro 54). Lazadas rellenas y gruesas, separadas del nudo por una rendija para que
# el nudo se lea también en una sola tinta. Todo cabe en el círculo de 33 dp de radio (la zona segura).
LOOP_L = 'M 45 44 C 39 35 29 27 24 31 C 18.5 35.5 18.5 57 24 61 C 29 65 39 60 45 54 Z'
LOOP_R = mirror(LOOP_L)
TAIL_L = tail(49.5, 57, 39.5, 80, 5, 4.5)
TAIL_R = mirror(TAIL_L)
KNOT = rrect(47.5, 41.5, 13, 15, 4.5)
# Dibujado con radio ~35 y reducido a ~30: margen dentro del círculo de 33 que ningún launcher recorta.
PARTS = [(scale(d, 0.86), c) for d, c in
         [(LOOP_L, TERRACOTA), (LOOP_R, TERRACOTA), (TAIL_L, TERRA_TINTA), (TAIL_R, TERRA_TINTA), (KNOT, TERRACOTA)]]


# --- rasterizado propio (Pillow no lee SVG) ---
def polys(d, s, ox):
    """pathData → polígonos en píxeles: escala s y origen ox (en unidades de 108)."""
    toks = re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?', d)
    out, cur, i, cmd = [], [], 0, None
    P = lambda x, y: ((x - ox) * s, (y - ox) * s)
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
            if cmd == 'Z':
                out.append(cur)
                cur = []
            continue
        a = [float(t) for t in toks[i:i + (6 if cmd == 'C' else 2)]]
        i += len(a)
        if cmd in 'ML':
            cur.append(P(*a))
        else:
            (x0, y0) = cur[-1]
            x0, y0 = x0 / s + ox, y0 / s + ox
            for k in range(1, 25):
                t = k / 24
                m = 1 - t
                x = m ** 3 * x0 + 3 * m * m * t * a[0] + 3 * m * t * t * a[2] + t ** 3 * a[4]
                y = m ** 3 * y0 + 3 * m * m * t * a[1] + 3 * m * t * t * a[3] + t ** 3 * a[5]
                cur.append(P(x, y))
    return out


def render(size, crop=0, bg=PAPEL, mask=None, mono=None):
    """Icono de size px. crop: margen en unidades de 108 que se recorta por cada lado. mask: None, 'circle', 'rrect'.
    mono: color único para el lazo (icono temático); si no, los colores de la marca."""
    S = size * 4
    s = S / (108 - 2 * crop)
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0) if bg is None else bg)
    dr = ImageDraw.Draw(img)
    for d, col in PARTS:
        for p in polys(d, s, crop):
            dr.polygon(p, fill=mono or col)
    if mask:
        m = Image.new('L', (S, S), 0)
        md = ImageDraw.Draw(m)
        if mask == 'circle':
            md.ellipse((0, 0, S - 1, S - 1), fill=255)
        else:
            md.rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.22), fill=255)
        img.putalpha(Image.composite(img.getchannel('A'), m, m))
    return img.resize((size, size), Image.LANCZOS)


# --- Android ---
def vector(paths, tint=None):
    body = ''.join(f'\n    <path android:fillColor="{tint or c}" android:pathData="{d}" />' for d, c in paths)
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!-- Generado por scripts/iconos.py: no editar a mano. -->\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            '    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">'
            f'{body}\n</vector>\n')


ADAPTIVE = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
'''

LEGACY_CROP = 16  # los PNG de respaldo y el icono «any» de la web enseñan los 80 dp centrales: el lazo, más grande


def android():
    (RES / 'drawable/ic_launcher_foreground.xml').write_text(vector(PARTS), encoding='utf-8')
    (RES / 'drawable/ic_launcher_monochrome.xml').write_text(vector(PARTS, '#FF000000'), encoding='utf-8')
    (RES / 'drawable/ic_launcher_background.xml').write_text(vector([('M 0 0 L 108 0 L 108 108 L 0 108 Z', PAPEL)]), encoding='utf-8')
    (RES / 'drawable-v24/ic_launcher_foreground.xml').unlink(missing_ok=True)
    for n in ('ic_launcher.xml', 'ic_launcher_round.xml'):
        (RES / 'mipmap-anydpi-v26' / n).write_text(ADAPTIVE, encoding='utf-8')
    for dpi, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        d = RES / f'mipmap-{dpi}'
        (d / 'ic_launcher_foreground.png').unlink(missing_ok=True)
        render(px, LEGACY_CROP, mask='rrect').save(d / 'ic_launcher.png', optimize=True)
        render(px, LEGACY_CROP, mask='circle').save(d / 'ic_launcher_round.png', optimize=True)


# --- web ---
def web():
    o, w = LEGACY_CROP, 108 - 2 * LEGACY_CROP
    paths = ''.join(f'\n  <path fill="{c}" d="{d}"/>' for d, c in PARTS)
    (PUB / 'icon.svg').write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{o} {o} {w} {w}">\n'
        f'  <rect x="{o}" y="{o}" width="{w}" height="{w}" rx="{w * 0.22:g}" fill="{PAPEL}"/>{paths}\n</svg>\n', encoding='utf-8')
    render(192, LEGACY_CROP, mask='rrect').save(PUB / 'icon-192.png', optimize=True)
    render(512, LEGACY_CROP, mask='rrect').save(PUB / 'icon-512.png', optimize=True)
    # Maskable: el lienzo entero de 108; el lazo (radio ≤ 33) queda dentro del 80 % central (radio 43).
    render(512).save(PUB / 'icon-maskable-512.png', optimize=True)
    # iOS no admite transparencia: cuadrado crema entero, iOS redondea las esquinas.
    render(180, LEGACY_CROP).convert('RGB').save(PUB / 'apple-touch-icon.png', optimize=True)
    render(32, LEGACY_CROP, mask='rrect').save(PUB / 'favicon-32.png', optimize=True)


# --- lámina de comprobación ---
def lamina():
    sizes, pad, lab = (48, 72, 192), 24, 150
    rows = [('Claro', '#f4f4f4', None), ('Oscuro', '#121212', None), ('Recargado', 'stripes', None),
            ('Temático claro', '#f1f3fb', ('#dde3f7', '#2f4373')), ('Temático oscuro', '#16181f', ('#33405f', '#d3dcff'))]
    W = lab + sum(max(z, 110) for z in sizes) * 2 + pad * (len(sizes) * 2 + 1)
    H = (192 + pad) * len(rows) + pad + 30
    sheet = Image.new('RGB', (W, H), '#ffffff')
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('arial.ttf', 15)
    except OSError:
        font = ImageFont.load_default(15)
    x = lab + pad
    for sz in sizes:
        for kind in ('círculo', 'squircle'):
            dr.text((x, 8), f'{sz} px {kind}', fill='#333', font=font)
            x += max(sz, 110) + pad
    for r, (name, bg, theme) in enumerate(rows):
        y0 = 30 + pad + r * (192 + pad)
        band = Image.new('RGB', (W, 192 + pad), bg if bg != 'stripes' else '#000')
        if bg == 'stripes':
            bd = ImageDraw.Draw(band)
            cols = ['#e6194b', '#ffe119', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6']
            for i in range(-20, 60):
                bd.polygon([(i * 22, 0), (i * 22 + 22, 0), (i * 22 + 22 - 200, 216), (i * 22 - 200, 216)], fill=cols[i % len(cols)])
        sheet.paste(band, (0, y0 - pad // 2))
        dr.rectangle((0, y0 - pad // 2, lab - 8, y0 + 24), fill='#ffffff')
        dr.text((8, y0), name, fill='#333', font=font)
        x = lab + pad
        for sz in sizes:
            for mask in ('circle', 'rrect'):
                # El launcher solo enseña los 72 dp centrales del icono adaptativo (recorte de 18 por lado).
                icon = render(sz, 18, theme[0], mask, theme[1]) if theme else render(sz, 18, mask=mask)
                sheet.paste(icon, (x, y0 + (192 - sz) // 2), icon)
                x += max(sz, 110) + pad
    out = ROOT / 'docs/design/v1.1.2/icono-lamina.png'
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, optimize=True)


if __name__ == '__main__':
    android()
    web()
    lamina()
    print('Iconos generados.')
