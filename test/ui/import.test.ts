import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { MAX_INFLATED, zipInflatedSize } from '../../src/core/columns';
import { readSheet } from '../../src/ui/screens/Import';

const xlsx = (rows: unknown[][]): ArrayBuffer => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Hoja');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer;
};
// happy-dom no trae File.arrayBuffer: basta con lo que readSheet usa.
const file = (buf: ArrayBuffer) => ({ name: 'regalos.xlsx', type: '', size: buf.byteLength, arrayBuffer: async () => buf }) as unknown as File;

describe('V-24: importar no cuelga la pestaña', () => {
  it('una hoja de 100 000 filas se lee en menos de 2 s y se queda en cabecera + 300', async () => {
    const buf = xlsx([['Regalo', 'Precio'], ...Array.from({ length: 100_000 }, (_, i) => [`Regalo ${i}`, i])]);
    const t = performance.now();
    const rows = await readSheet(file(buf));
    expect(performance.now() - t).toBeLessThan(2000);
    expect(rows).toHaveLength(301);
  });

  it('cuenta lo descomprimido del .xlsx; un csv no es zip', () => {
    const buf = xlsx([['Regalo'], ['Tren']]);
    expect(zipInflatedSize(buf)).toBeGreaterThan(buf.byteLength);
    expect(zipInflatedSize(new TextEncoder().encode('Regalo\nTren').buffer as ArrayBuffer)).toBeNull();
  });

  it('un .xlsx que se infla por encima del tope se rechaza antes de abrirlo', async () => {
    const buf = xlsx([['Regalo'], ['Tren']]);
    const v = new DataView(buf);
    // Infla en el directorio central el tamaño descomprimido declarado de la primera entrada.
    let eocd = v.byteLength - 22;
    while (v.getUint32(eocd, true) !== 0x06054b50) eocd--;
    v.setUint32(v.getUint32(eocd + 16, true) + 24, MAX_INFLATED + 1, true);
    await expect(readSheet(file(buf))).rejects.toThrow('demasiado grande por dentro');
  });
});
