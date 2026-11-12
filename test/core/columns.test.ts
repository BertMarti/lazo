import { describe, expect, it } from 'vitest';
import { assignColumn, fieldForColumn, guessColumns, rowsToDrafts } from '../../src/core/columns';

describe('mapeo de columnas sin IA', () => {
  it.each([
    ['Nombre', 'title'], ['REGALO', 'title'], ['Artículo', 'title'], ['Productos', 'title'], ['Title', 'title'],
    ['Precio', 'price'], ['€', 'price'], ['Coste aprox.', 'price'], ['Price', 'price'], ['¿Cuánto cuesta?', 'price'],
    ['Enlace', 'url'], ['URL', 'url'], ['Links', 'url'],
    ['Tienda', 'store'], ['Store', 'store'],
    ['Talla', 'size'], ['Color', 'color'], ['Prioridad', 'priority'], ['Notas', 'notes'], ['Cantidad', 'quantity'],
  ])('«%s» → %s', (header, field) => expect(guessColumns([header])).toEqual({ [field]: 0 }));

  it('normaliza acentos, mayúsculas, espacios y signos', () => {
    expect(guessColumns(['  ARTÍCULO deseado ', 'Precio (€)', 'TALLA/Número', 'Nº de unidades', 'Observación'])).toEqual({
      title: 0, price: 1, size: 2, quantity: 3, notes: 4,
    });
  });

  it('cuando la cabecera nombra dos cosas gana la más concreta', () => {
    expect(guessColumns(['Nombre de la tienda', 'Enlace del producto', 'Precio por unidad', 'Notas del regalo', 'Qué quiero'])).toEqual({
      store: 0, url: 1, price: 2, notes: 3, title: 4,
    });
  });

  it('cada campo sale de una sola columna: la primera que encaja', () => {
    expect(guessColumns(['Regalo', 'Producto', 'Precio'])).toEqual({ title: 0, price: 2 });
  });

  it('sin pistas en la cabecera, mira el contenido (enlaces y euros)', () => {
    const map = guessColumns(['Cosa', 'Columna B', 'Columna C', 'Columna D'], [
      ['Libro', 'https://a.example/1', '12,50 €', 'x'],
      ['Taza', 'http://b.example/2', '€ 7', ''],
    ]);
    expect(map).toEqual({ title: 0, url: 1, price: 2 });
  });

  it('cabeceras desconocidas quedan sin importar', () => {
    expect(guessColumns(['Fecha', 'Columna rara', ''])).toEqual({});
  });

  it('asignar a mano: una columna por campo y «No importar»', () => {
    let map = guessColumns(['Regalo', 'Precio', 'Extra']);
    expect(fieldForColumn(map, 2)).toBeUndefined();
    map = assignColumn(map, 2, 'price'); // el precio pasa de la columna 1 a la 2
    expect(map).toEqual({ title: 0, price: 2 });
    expect(fieldForColumn(map, 1)).toBeUndefined();
    map = assignColumn(map, 0, 'notes'); // la columna 0 deja de ser el regalo
    expect(map).toEqual({ notes: 0, price: 2 });
    map = assignColumn(map, 2, undefined);
    expect(map).toEqual({ notes: 0 });
  });

  it('la tienda llega al borrador', () => {
    expect(rowsToDrafts([['Taza', 'Zara Home']], { title: 0, store: 1 })[0]).toMatchObject({ title: 'Taza', store: 'Zara Home' });
  });
});
