import { FileArrowUp, Sparkle } from '@phosphor-icons/react';
import { loadAi } from '../../ai/provider';
import { mapColumnsAI } from '../../ai/tasks';
import { useMemo, useState } from 'react';
import { FIELD_LABEL, guessColumns, rowsToDrafts, type ColumnMap, type Field } from '../../core/columns';
import { formatMoney } from '../../core/money';
import { Button, ButtonGroup, FileButton } from '../Button';
import { useApi } from '../ctx';
import { errorText, Sheet, useToast } from '../kit';

const FIELDS = Object.keys(FIELD_LABEL) as Field[];

/** Lee la primera hoja de un .xlsx/.xls/.ods/.csv. SheetJS se carga solo aquí (carga diferida). */
async function readSheet(file: File): Promise<unknown[][]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('El archivo pesa más de 5 MB. Prueba con uno más pequeño.');
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, dense: true });
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

  const onFile = async (f?: File) => {
    if (!f) return;
    setErr('');
    setBusy(true);
    try {
      const r = await readSheet(f);
      if (r.length < 2) throw new Error('La hoja está vacía o solo tiene la cabecera.');
      setRows(r);
      setMap(guessColumns(r[0]!.map((h) => String(h ?? ''))));
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
          <p className="meta">Hemos adivinado qué es cada columna. Corrige lo que no cuadre.</p>
          {loadAi().provider !== 'none' && (
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
          )}
          <div className="grid-2">
            {FIELDS.map((f) => (
              <label className="field" key={f}>
                <span>{FIELD_LABEL[f]}</span>
                <select
                  className="select"
                  value={map[f] ?? ''}
                  onChange={(e) => setMap((m) => ({ ...m, [f]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                >
                  <option value="">—</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          {drafts.length > 0 && (
            <div className="table-wrap">
              <table className="preview">
                <thead><tr><th>Regalo</th><th>Precio</th><th>Talla</th><th>Cantidad</th></tr></thead>
                <tbody>
                  {drafts.slice(0, 8).map((d, i) => (
                    <tr key={i}><td>{d.title}</td><td>{d.priceCents ? formatMoney(d.priceCents) : '—'}</td><td>{d.size ?? '—'}</td><td>{d.quantity}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {drafts.length > 8 && <p className="meta">…y {drafts.length - 8} más.</p>}
        </>
      )}
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
