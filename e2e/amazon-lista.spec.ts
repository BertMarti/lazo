import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { DEMO_AMAZON_BLOQUEA, DEMO_AMAZON_HTML, DEMO_AMAZON_LISTA } from '../src/api/seed';
import { hostilAnidadas, hostilEnlaces } from '../test/fixtures/amazon-lista/grande';

// Importar una lista de Amazon copiando y pegando (camino b). Lazo no hace ninguna petición a Amazon.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
      localStorage.setItem('lazo:vista-explicada', '1');
      sessionStorage.setItem('lazo:inicio', '1');
      sessionStorage.setItem('e2e', '1');
    }
  });
});

/** Un pegado de verdad (Ctrl+V): el evento trae text/plain y, si se copió de una página, text/html. */
const paste = (page: Page, text: string, html?: string) =>
  page.evaluate(([t, h]) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t!);
    if (h) dt.setData('text/html', h);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [text, html] as const);

test('pegar el enlace de la lista la lee sola (servidor con AMAZON_IMPORT=on; la demo lo simula) y cada regalo lleva su /dp/', async ({ page, baseURL }) => {
  const fuera: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) fuera.push(r.url());
  });
  await page.goto('/#/l/l-alberto/nuevo');
  await expect(page.getByRole('heading', { name: 'Añadir a tu lista' })).toBeVisible();
  await paste(page, `¡Echa un vistazo a mi lista! ${DEMO_AMAZON_LISTA}`);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Importar lista de Amazon' })).toBeVisible();
  await expect(sheet.getByText('Leyendo tu lista…')).toBeVisible();
  await expect(sheet.getByRole('progressbar', { name: 'Leyendo tu lista' })).toBeVisible();
  await expect(sheet.getByText('He encontrado 8 productos.')).toBeVisible();
  await expect(sheet.getByText('1 ya está en tu lista')).toBeVisible();
  await expect(sheet.getByText('Las fotos aparecerán al añadirlos.')).toHaveCount(0);
  await expect(sheet.getByRole('checkbox', { name: /Teclado mecánico compacto/ })).not.toBeChecked();
  await sheet.getByRole('button', { name: 'Añadir 7', exact: true }).click();
  await expect(page.getByText('7 regalos añadidos.')).toBeVisible();
  const urls = await page.evaluate(() => JSON.parse(localStorage.getItem('lazo-demo-v4') ?? '{}').items.filter((i: { title: string }) => /Termo de acero|Puzle de 1000/.test(i.title)).map((i: { url: string }) => i.url));
  expect(urls.sort()).toEqual(['https://www.amazon.es/dp/B0LAZODM02', 'https://www.amazon.es/dp/B0LAZODM08']);
  expect(fuera).toEqual([]); // la demo no sale a ningún sitio
});

test('si Amazon bloquea: el aviso, «Reintentar» y, como alternativa, copiar y pegar la página', async ({ page }) => {
  await page.goto('/#/l/l-alberto/nuevo');
  await paste(page, `https://www.amazon.es/hz/wishlist/ls/${DEMO_AMAZON_BLOQUEA}?ref_=wl_share`);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('status')).toHaveText('Amazon no deja leer la lista ahora mismo. Prueba dentro de un rato.');
  await sheet.getByRole('button', { name: 'Reintentar' }).click();
  await expect(sheet.getByText('Leyendo tu lista…')).toBeVisible();
  await expect(sheet.getByRole('status')).toHaveText(/Amazon no deja leer la lista/);
  await sheet.getByRole('button', { name: 'Copiar y pegar la página' }).click();
  await expect(sheet.getByRole('button', { name: 'Pegar', exact: true })).toBeVisible();
  await paste(page, 'texto de la página', DEMO_AMAZON_HTML);
  await expect(sheet.getByText('He encontrado 8 productos.')).toBeVisible();
  await expect(sheet.getByText('Las fotos aparecerán al añadirlos.')).toBeVisible(); // lo pegado: sin fotos antes de confirmar
});

test('la página copiada da la vista previa con el duplicado desmarcado', async ({ page }) => {
  await page.goto('/#/l/l-alberto/nuevo');
  await expect(page.getByRole('heading', { name: 'Añadir a tu lista' })).toBeVisible();
  await paste(page, 'texto de la página', DEMO_AMAZON_HTML);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('He encontrado 8 productos.')).toBeVisible();
  await expect(sheet.getByText('1 ya está en tu lista')).toBeVisible();
  await expect(sheet.getByRole('checkbox', { name: /Teclado mecánico compacto/ })).not.toBeChecked();
  await expect(sheet.getByRole('checkbox', { name: /Termo de acero/ })).toBeChecked();
  await sheet.getByRole('button', { name: 'Añadir 7', exact: true }).click();
  await expect(page.getByText('7 regalos añadidos.')).toBeVisible();
  const termo = page.locator('.gift', { hasText: 'Termo de acero inoxidable de 750 ml' });
  await expect(termo).toContainText('24,95');
  await expect(page.locator('.gift', { hasText: 'Teclado mecánico compacto' })).toHaveCount(1);
});

test('la lista de ejemplo de la demo y las pestañas por dispositivo', async ({ page }, info) => {
  await page.goto('/#/l/l-alberto/nuevo');
  await page.getByRole('button', { name: 'Importar lista de Amazon' }).click();
  const sheet = page.getByRole('dialog');
  // El dispositivo sale del user agent: Pixel 7 → Android; escritorio → Ordenador.
  await expect(sheet.getByRole('radio', { name: info.project.name === 'movil' ? 'Android' : 'Ordenador' })).toBeChecked();
  await expect(sheet.getByText(info.project.name === 'movil' ? /en Chrome, no en la app/ : /Ctrl \+ A/)).toBeVisible();
  await sheet.getByRole('radio', { name: 'iPhone' }).check();
  await expect(sheet.getByText(/en Safari, no en la app/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Probar con una lista de ejemplo' }).click();
  await expect(sheet.getByText('He encontrado 8 productos.')).toBeVisible();
  await sheet.getByRole('checkbox', { name: /Termo de acero/ }).uncheck();
  await sheet.getByRole('button', { name: 'Añadir 6', exact: true }).click();
  await expect(page.getByText('6 regalos añadidos.')).toBeVisible();
});

test('«Pegar» lee el portapapeles con un toque (text/html)', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Permisos de portapapeles solo en Chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/l/l-alberto/amazon');
  await page.evaluate((h) => navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }), 'text/plain': new Blob(['texto'], { type: 'text/plain' }) })]), DEMO_AMAZON_HTML);
  await page.getByRole('dialog').getByRole('button', { name: 'Pegar', exact: true }).click();
  await expect(page.getByText('He encontrado 8 productos.')).toBeVisible();
});

test('AMZ-9, AMZ-10 y AMZ-16: lo pegado hostil no ejecuta nada, no pide nada fuera y no se guarda', async ({ page, baseURL }) => {
  const fuera: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) fuera.push(r.url());
  });
  page.on('dialog', (d) => {
    fuera.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  await page.goto('/#/l/l-alberto/amazon');
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Importar lista de Amazon' })).toBeVisible();
  await paste(page, 'x', readFileSync('test/fixtures/amazon-lista/hostil.html', 'utf8'));
  await expect(sheet.getByText('He encontrado 3 productos.')).toBeVisible();
  await expect(sheet.getByText('<img src=x onerror=alert(1)> Taza')).toBeVisible(); // como texto
  await sheet.getByRole('button', { name: 'Añadir 3', exact: true }).click();
  await expect(page.getByText('3 regalos añadidos.')).toBeVisible();
  await expect(page.locator('img[src="x"], .gifts script, .gifts b')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __hostil?: number }).__hostil)).toBeUndefined();
  const stored = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join('\n'));
  expect(stored).not.toContain('onerror="alert(2)"'); // el HTML pegado no se guarda (el título, como texto, sí)
  expect(stored).not.toContain('javascript:');
  expect(fuera).toEqual([]);
});

/** «Compartir → Lazo» en Android: lo mismo que hace main.tsx con el texto del intent. */
const compartir = (page: Page, text: string) =>
  page.evaluate(async ([m, t]) => {
    (await import(m!)).guardaCompartido(t);
    location.hash = '/amazon';
  }, ['/src/ui/compartido.ts', text] as const);

test('V11-2: lo que llega de otra app se dice y no crea nada sin pulsar «Añadir»', async ({ page }) => {
  await page.goto('/#/l/l-alberto');
  await expect(page.locator('.gift').first()).toBeVisible();
  await compartir(page, readFileSync('test/fixtures/amazon-lista/escritorio.txt', 'utf8'));
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('status')).toHaveText(/Texto recibido de otra app/);
  await expect(sheet.getByText(/He encontrado \d+ productos/)).toBeVisible();
  await expect(sheet.getByText('2 unidades')).toBeVisible(); // arreglo 6: la cantidad se ve antes de añadir
  await sheet.getByRole('button', { name: 'Cerrar' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.gift', { hasText: 'Lámpara de escritorio con brazo articulado' })).toHaveCount(0);
  expect(await page.evaluate(async (m) => (await import(m)).leeCompartido(), '/src/ui/compartido.ts')).toBeNull();
});

/** La API de la demo (window.__lazoDemo, solo con VITE_DEMO): aquí se espía o se cambia lo que respondería el servidor. */
type Demo = { amazonLista: (id: string) => Promise<unknown>; capacidades: () => Promise<{ amazon: boolean }>; __lecturas?: number };

test('V-41: el enlace de una lista que llega de otra app no se lee hasta pulsar «Leer la lista»', async ({ page }) => {
  await page.goto('/#/l/l-alberto');
  await expect(page.locator('.gift').first()).toBeVisible();
  await page.evaluate(() => {
    const d = (window as unknown as { __lazoDemo: Demo }).__lazoDemo;
    const real = d.amazonLista.bind(d);
    d.__lecturas = 0;
    d.amazonLista = (id) => (d.__lecturas!++, real(id));
  });
  await compartir(page, DEMO_AMAZON_LISTA);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('status')).toHaveText('Has compartido el enlace de una lista de Amazon.');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __lazoDemo: Demo }).__lazoDemo.__lecturas)).toBe(0);
  await sheet.getByRole('button', { name: 'Leer la lista' }).click();
  await expect(sheet.getByText('He encontrado 8 productos.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __lazoDemo: Demo }).__lazoDemo.__lecturas)).toBe(1);
});

for (const [caso, capacidades] of [
  ['apagada', 'false'],
  ['servidor antiguo, sin la ruta', 'falla'],
] as const) {
  test(`importación ${caso}: dice qué hacer para encenderla y el modo manual sigue debajo`, async ({ page, context, browserName }) => {
    await page.goto('/#/l/l-alberto/nuevo');
    await expect(page.getByRole('heading', { name: 'Añadir a tu lista' })).toBeVisible();
    await page.evaluate((c) => {
      const d = (window as unknown as { __lazoDemo: Demo }).__lazoDemo;
      d.capacidades = async () => {
        if (c === 'falla') throw new Error('404');
        return { amazon: false };
      };
    }, capacidades);
    await paste(page, DEMO_AMAZON_LISTA);
    const sheet = page.getByRole('dialog');
    const aviso = sheet.getByRole('status');
    await expect(aviso).toContainText('La importación automática está apagada en tu servidor. Quien lo aloja puede encenderla así:');
    await expect(aviso.locator('code', { hasText: '.env' })).toHaveText('server/.env');
    await expect(aviso.locator('.amz-copiable code')).toHaveText(['AMAZON_IMPORT=on', 'cd lazo/server && docker compose up -d --build']);
    await expect(aviso.getByRole('link', { name: 'lee los riesgos' })).toHaveAttribute('href', 'https://github.com/BertMarti/lazo/blob/main/docs/legal/AMAZON.md');
    await expect(aviso).toContainText('Si el servidor no es tuyo, enséñale esto a quien lo aloja.');
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await aviso.getByRole('button', { name: 'Copiar cd lazo/server && docker compose up -d --build' }).click();
      await expect(page.getByText('Copiado.')).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('cd lazo/server && docker compose up -d --build');
    }
    // Debajo, el modo manual de siempre.
    await expect(sheet.getByRole('button', { name: 'Pegar', exact: true })).toBeVisible();
    await paste(page, 'texto de la página', DEMO_AMAZON_HTML);
    await expect(sheet.getByText('He encontrado 8 productos.')).toBeVisible();
  });
}

test('V-44: la vista previa del servidor se repasa en la app (fotos de Amazon y enlaces /dp/ construidos)', async ({ page }) => {
  await page.goto('/#/l/l-alberto/nuevo');
  await expect(page.getByRole('heading', { name: 'Añadir a tu lista' })).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __lazoDemo: Demo }).__lazoDemo.amazonLista = async () => ({
      productos: [
        { title: 'Taza hostil', asin: 'B0LAZOHOS1', url: 'javascript:alert(1)', image: 'https://evil.example/x.jpg' },
        { title: 'Sin ASIN', url: 'https://evil.example/' },
        { title: 'Termo hostil', asin: 'B0LAZOHOS2', url: 'https://evil.example/dp/B0LAZOHOS2', image: 'https://m.media-amazon.com/images/I/lazo-ficticia-1._SS135_.jpg', priority: 9, quantity: -3 },
        { title: '', asin: 'B0LAZOHOS3' },
      ],
    });
  });
  await paste(page, DEMO_AMAZON_LISTA);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('He encontrado 2 productos.')).toBeVisible();
  for (const src of await sheet.locator('img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src'))))
    expect(src).toMatch(/^https:\/\/(m\.media-amazon\.com|images-(eu|na)\.ssl-images-amazon\.com)\//);
  await sheet.getByRole('button', { name: 'Añadir 2', exact: true }).click();
  await expect(page.getByText('2 regalos añadidos.')).toBeVisible();
  const urls = await page.evaluate(() => JSON.parse(localStorage.getItem('lazo-demo-v4') ?? '{}').items.filter((i: { title: string }) => / hostil$/.test(i.title)).map((i: { url: string }) => i.url));
  expect(urls.sort()).toEqual(['https://www.amazon.es/dp/B0LAZOHOS1', 'https://www.amazon.es/dp/B0LAZOHOS2']);
});

test('compartir el enlace de un producto suelto lo añade como siempre, sin pasar por la lista de Amazon', async ({ page }) => {
  await page.goto('/#/l/l-alberto');
  await expect(page.locator('.gift').first()).toBeVisible();
  await compartir(page, 'Mira esto en Amazon https://www.amazon.es/dp/B0LAZOPRU1?ref=x');
  await expect(page.getByText('Añadido a tu lista.')).toBeVisible();
  await expect(page.getByText(/No encuentro productos/)).toHaveCount(0);
});

test('V11-1: 2 MB de HTML preparado se analizan en menos de 500 ms en el navegador', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Se mide en Chromium');
  await page.goto('/#/l/l-alberto');
  for (const html of [hostilEnlaces(), hostilAnidadas()]) {
    const r = await page.evaluate(async ([m, h]) => {
      const { parseListaHtml } = await import(m!);
      parseListaHtml('<a href="/dp/B0LAZOPRU1">Calentar el analizador</a>');
      const t = performance.now();
      const n = parseListaHtml(h).length;
      return { n, ms: performance.now() - t };
    }, ['/src/core/amazonLista.ts', html] as const);
    console.log(`V11-1 en Chromium: ${html.length} caracteres, ${r.n} filas, ${Math.round(r.ms)} ms`);
    expect(r.n).toBeLessThanOrEqual(100);
    expect(r.ms).toBeLessThan(500);
  }
});
