import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { DemoApi } from '../../src/api/demo';
import { toShared } from '../../src/core/shared';
import { Catalog, qrSrc } from '../../src/ui/screens/Printable';

let api: DemoApi;
beforeEach(() => {
  api = new DemoApi(null);
});

const printed = async (viewer: string, list: string) => {
  api.setViewer(viewer);
  const d = await api.listDetail(list);
  const data = toShared(d.list.name, d.group.occasion, d.items);
  return { data, html: renderToStaticMarkup(createElement(Catalog, { data })) };
};

describe('lista para imprimir', () => {
  it('sin sorpresas, sin retirados y sin ningún estado, aunque quien imprime sí los vea', async () => {
    const { data, html } = await printed('samira', 'l-marta'); // Samira ve reservas, compras, presupuesto y la sorpresa de Papá
    expect(data.items.map((i) => i.title)).toEqual(['Marco digital de fotos', 'Robot de cocina', 'Chal de lana merino', 'Novela «La casa de los veranos»']);
    expect(html).not.toMatch(/Pañuelo de seda|Sorpresa|Reservad|Comprad|cogido|hucha|Presupuesto|reserva|compr[oó]/i);
    expect(JSON.stringify(data)).not.toMatch(/"(id|list|createdBy|secret|removed|quantity|notes)"/);
    expect(html).toContain('Marta');
    expect(html).toContain('Navidad');
    expect(html).toContain('Me encantaría');
  });

  it('sale igual la imprima Marta o cualquiera del grupo: no deja deducir qué está cogido', async () => {
    const own = await printed('marta', 'l-marta');
    for (const who of ['alberto', 'samira', 'papa']) expect((await printed(who, 'l-marta')).html).toBe(own.html);
  });

  it('un retirado con reserva no sale (su existencia delataría la reserva)', async () => {
    api.setViewer('marta');
    await api.deleteItem('i1'); // el marco estaba reservado por Alberto: queda «retirado» para los demás
    const { data } = await printed('samira', 'l-marta');
    expect(data.items.map((i) => i.title)).not.toContain('Marco digital de fotos');
  });

  it('un QR por regalo con enlace web; sin enlace, sin QR', async () => {
    const { data, html } = await printed('marta', 'l-marta');
    const withUrl = data.items.filter((i) => i.url).length;
    expect(withUrl).toBeGreaterThan(0);
    expect(html.match(/class="catalog-qr"/g)?.length).toBe(withUrl);
    expect(qrSrc('https://tienda.example/a')).toMatch(/^data:image\/svg\+xml,/);
    expect(qrSrc(undefined)).toBeNull();
    expect(qrSrc('javascript:alert(1)')).toBeNull();
  });
});
