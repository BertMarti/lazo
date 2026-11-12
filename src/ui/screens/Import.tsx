import { FileArrowUp, Sparkle } from '@phosphor-icons/react';
import { loadAi } from '../../ai/provider';
import { mapColumnsAI } from '../../ai/tasks';
import { useMemo, useState } from 'react';
import { assignColumn, fieldForColumn, FIELD_LABEL, guessColumns, MAX_INFLATED, rowsToDrafts, zipInflatedSize, type ColumnMap, type Field, type ItemDraft } from '../../core/columns';
import { LIMITS } from '../../core/types';
import { formatMoney } from '../../core/money';
import { Button, ButtonGroup, FileButton } from '../Button';
import { useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { errorText, Sheet, useToast } from '../kit';

const FIELDS = Object.keys(FIELD_LABEL) as Field[];
const PREVIEW = 5;

function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

/** Primer valor no vacío de la columna (en las 5 primeras filas), para reconocerla de un vistazo. */
function example(rows: unknown[][], col: number): string {
  const v = rows.slice(1, 6).map((r) => String(r[col] ?? '').trim()).find(Boolean);
  return v ? (v.length > 40 ? `${v.slice(0, 39)}…` : v) : '—';
}

function previewCell(d: ItemDraft, f: Field): string {
  if (f === 'price') return d.priceCents ? formatMoney(d.priceCents) : '—';
  if (f === 'url') return d.url ? new URL(d.url).hostname.replace(/^www\./, '') : '—';
  if (f === 'priority') return PRIORITY[d.priority];
  if (f === 'quantity') return String(d.quantity);
  return d[f] ?? '—';
}

/** Lee la primera hoja de un .xlsx/.xls/.ods/.csv. SheetJS se carga solo aquí (carga diferida). */
export async function readSheet(file: File): Promise<unknown[][]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('El archivo pesa más de 5 MB. Prueba con uno más pequeño.');
  const buf = await file.arrayBuffer();
  // V-24: un .xlsx de 5 MB puede descomprimirse a GB y colgar la pestaña.
  if ((zipInflatedSize(buf) ?? 0) > MAX_INFLATED) throw new Error('El archivo es demasiado grande por dentro. Prueba con uno más pequeño.');
  const XLSX = await import('xlsx');
  // Cabecera + las filas que la importación acepta: SheetJS deja de leer ahí.
  const opts = { cellDates: false, dense: true, sheetRows: LIMITS.importRows + 1 } as const;
  // Un CSV es texto: lo decodificamos nosotros (UTF-8 con o sin BOM o, si no lo es, el ANSI de Excel en Windows).
  const wb = /\.csv$/i.test(file.name) || file.type === 'text/csv' ? XLSX.read(decodeText(buf), { ...opts, type: 'string' }) : XLSX.read(buf, { ...opts, type: 'array' });
  const first = wb.SheetNames[0];
  if (!first) throw new Error('El archivo no tiene hojas.');
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first]!, { header: 1, blankrows: false, defval: '' });
}

export function ImportSheet({ listId, onClose, onDone }: { listId: string; onClose: () => void; onDone: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [map, setMap] = useState<ColumnMap>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const headers = (rows?.[0] ?? []).map((h) => String(h ?? ''));
  const drafts = useMemo(() => (rows ? rowsToDrafts(rows.slice(1), map) : []), [rows, map]);
  const shown = FIELDS.filter((f) => map[f] !== undefined);

  const onFile = async (f?: File) => {
    if (!f) return;
    setErr('');
    setBusy(true);
    try {
      const r = await readSheet(f);
      if (r.length < 2) throw new Error('La hoja está vacía o solo tiene la cabecera.');
      setRows(r);
      setMap(guessColumns(r[0]!.map((h) => String(h ?? '')), r.slice(1, 6)));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const n = await api.importItems(listId, drafts);
      toast(`${n} ${n === 1 ? 'regalo importado' : 'regalos importados'}.`);
      onDone();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Importar desde Excel"
      onClose={onClose}
      footer={
        rows && (
          <ButtonGroup align="stretch">
            <Button variant="primary" loading={busy} disabled={drafts.length === 0} onClick={run}>
              {drafts.length ? `Importar ${drafts.length} ${drafts.length === 1 ? 'regalo' : 'regalos'}` : 'Elige la columna del regalo'}
            </Button>
          </ButtonGroup>
        )
      }
    >
      {!rows && (
        <div className="stack">
          <p>Sube un Excel, una hoja de Google exportada o un CSV. La primera fila tiene que ser la cabecera: regalo, precio, enlace, talla…</p>
          <FileButton
            variant="primary"
            icon={FileArrowUp}
            loading={busy}
            wide
            input={<input type="file" className="sr-only" accept=".xlsx,.xls,.ods,.csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />}
          >
            Elegir archivo
          </FileButton>
          <p className="meta">Se lee en tu dispositivo; el archivo no se sube a ningún sitio. Como mucho 300 filas.</p>
        </div>
      )}
      {rows && (
        <>
          <p className="meta">Hemos adivinado qué es cada columna. Corrige lo que no cuadre y mira abajo cómo quedará antes de importar.</p>
          {loadAi().provider !== 'none' && (
            <>
            <Button
              variant="secondary"
              icon={Sparkle}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setErr('');
                try {
                  // Solo cabeceras y 3 filas de muestra: la hoja entera no sale del dispositivo.
                  setMap(await mapColumnsAI(loadAi(), headers, rows.slice(1, 4)));
                } catch (e) {
                  setErr(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Que la IA lo ordene
            </Button>
            <p className="meta">Envía a la IA solo los títulos de las columnas y 3 filas de ejemplo.</p>
            </>
          )}
          <div className="table-wrap">
            <table className="preview map-table" aria-label="Qué es cada columna">
              <thead><tr><th scope="col">Columna</th><th scope="col">Se importa como</th></tr></thead>
              <tbody>
                {headers.map((h, i) => {
                  const name = h.trim() || `Columna ${i + 1}`;
                  return (
                    <tr key={i}>
                      <th scope="row">{name}<span className="meta map-example">{example(rows, i)}</span></th>
                      <td>
                        <select
                          className="select"
                          aria-label={`Columna «${name}»`}
                          value={fieldForColumn(map, i) ?? ''}
                          onChange={(e) => setMap((m) => assignColumn(m, i, (e.target.value || undefined) as Field | undefined))}
                        >
                          <option value="">No importar</option>
                          {FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {drafts.length > 0 && (
            <>
              <h3 className="h-section" style={{ fontSize: 'var(--t-3)' }}>Así quedarán los primeros</h3>
              <div className="table-wrap">
                <table className="preview" aria-label="Vista previa">
                  <thead><tr>{shown.map((f) => <th key={f} scope="col">{FIELD_LABEL[f]}</th>)}</tr></thead>
                  <tbody>
                    {drafts.slice(0, PREVIEW).map((d, i) => (
                      <tr key={i}>{shown.map((f) => <td key={f}>{previewCell(d, f)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {drafts.length > PREVIEW && <p className="meta">…y {drafts.length - PREVIEW} más.</p>}
        </>
      )}
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
