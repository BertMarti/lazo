import { ArrowSquareOut, CaretLeft, Copy, LinkBreak, LinkSimple, Printer } from '@phosphor-icons/react';
import qrcode from 'qrcode-generator';
import { useState } from 'react';
import { formatMoney } from '../../core/money';
import { toShared, type SharedList } from '../../core/shared';
import { Bow, Loading } from '../Bow';
import { Button, ButtonLink } from '../Button';
import { useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { errorText, OCCASION, Sheet, useLoad, useToast } from '../kit';

/** Solo enlaces web: ni `javascript:` ni otros esquemas llegan a un QR o a un <a>. */
const webUrl = (url?: string) => {
  try {
    const u = new URL(url ?? '');
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
};

/** QR en SVG como data URI (la CSP admite `img-src data:`). `URL.href` ya es ASCII: modo byte sin sorpresas. */
export function qrSrc(url?: string): string | null {
  const href = webUrl(url);
  if (!href) return null;
  const q = qrcode(0, 'M');
  q.addData(href);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** La lista tal como sale del grupo: catálogo de dos columnas, sin ningún estado. Sirve para el papel y para #/ver. */
export function Catalog({ data }: { data: SharedList }) {
  return (
    <article className="catalog">
      <header className="catalog-head">
        <span className="catalog-brand">
          <Bow size={28} /> Lazo
        </span>
        <h1>{data.name}</h1>
        <p className="catalog-occasion">Lista de regalos · {OCCASION[data.occasion] ?? OCCASION.otro}</p>
      </header>
      {data.items.length ? (
        <ul className="catalog-items">
          {data.items.map((i, n) => {
            const qr = qrSrc(i.url);
            const href = webUrl(i.url);
            const details = [i.size && `Talla ${i.size}`, i.color].filter(Boolean).join(' · ');
            return (
              <li key={n} className="catalog-item">
                <span className="catalog-photo" aria-hidden>
                  {i.image ? <img src={i.image} alt="" referrerPolicy="no-referrer" /> : <Bow size={40} />}
                </span>
                <div className="catalog-text">
                  <h2>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {i.title}
                      </a>
                    ) : (
                      i.title
                    )}
                  </h2>
                  {i.store && <p>{i.store}</p>}
                  {details && <p>{details}</p>}
                  <p className="catalog-prio">{PRIORITY[i.priority] ?? PRIORITY[2]}</p>
                  <p className="catalog-price">{i.priceCents !== undefined ? formatMoney(i.priceCents, i.currency) : 'Sin precio'}</p>
                </div>
                {qr && <img className="catalog-qr" src={qr} alt={`Código QR de ${i.title} en la tienda`} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="lead">Aún no hay regalos en esta lista.</p>
      )}
      <footer className="catalog-foot">Precios orientativos. Para ver un regalo en su tienda, apunta al cuadrado con la cámara del móvil.</footer>
    </article>
  );
}

/** #/imprimir/<lista>: CSS de impresión y window.print() (PDF nativo, sin dependencias). */
export function PrintScreen({ id }: { id: string }) {
  const api = useApi();
  const { data, error } = useLoad(async () => {
    const d = await api.listDetail(id);
    return toShared(d.list.name, d.group.occasion, d.items);
  }, [api, id]);
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <Loading />;
  return (
    <>
      <div className="print-bar">
        <a className="back" href={`#/l/${id}`}>
          <CaretLeft size={18} weight="bold" aria-hidden /> Volver a la lista
        </a>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>
          Imprimir o guardar en PDF
        </Button>
      </div>
      <Catalog data={data} />
    </>
  );
}

/** #/ver/<token>: público, sin sesión ni navegación del grupo. */
export function SharedScreen({ token }: { token: string }) {
  const api = useApi();
  const { data, error } = useLoad(() => api.sharedList(token), [api, token]);
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <Loading />;
  return <Catalog data={data} />;
}

/** Crear (o rotar) y revocar el enlace de solo lectura de una lista propia. */
export function ShareSheet({ listId, who, mine, onClose }: { listId: string; who: string; mine: boolean; onClose: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<void>) => {
    setErr('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const create = () => run(async () => setUrl((await api.shareList(listId)).url));
  const revoke = () =>
    run(async () => {
      await api.unshareList(listId);
      setUrl('');
      toast('El enlace ya no funciona.');
    });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado.');
    } catch {
      setErr('No se ha podido copiar. Selecciónalo y cópialo a mano.');
    }
  };
  return (
    <Sheet title="Compartir en solo lectura" onClose={onClose}>
      <p data-autofocus tabIndex={-1} style={{ outline: 'none' }}>
        Para quien no está en el grupo: verá {mine ? 'tus regalos' : `los regalos de ${who}`} con foto, precio y enlace a la tienda. Nunca qué está cogido ni las sorpresas.
      </p>
      {url ? (
        <>
          <label className="field">
            <span>Enlace</span>
            <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="btn-group">
            <Button variant="primary" icon={Copy} onClick={copy}>
              Copiar el enlace
            </Button>
            <ButtonLink variant="secondary" icon={ArrowSquareOut} href={url} target="_blank" rel="noopener noreferrer">
              Abrirlo
            </ButtonLink>
          </div>
        </>
      ) : (
        <>
          <p>Si ya enviaste un enlace, al crear otro el anterior deja de funcionar.</p>
          <Button variant="primary" wide icon={LinkSimple} loading={busy} onClick={create}>
            Crear el enlace
          </Button>
        </>
      )}
      <Button variant="link" icon={LinkBreak} disabled={busy} onClick={revoke}>
        Dejar de compartir
      </Button>
      {err && (
        <p className="notice notice-error" role="alert">
          {err}
        </p>
      )}
    </Sheet>
  );
}
