import { Capacitor } from '@capacitor/core';
import { ArrowClockwise, ClipboardText, Copy, ListChecks } from '@phosphor-icons/react';
import { useEffect, useState, type ClipboardEvent as ReactClipboardEvent, type ReactNode } from 'react';
import { esDuplicado, listaId, MAX_PEGADO, parseListaPegada, saneaProducto, soloEnlace, type AmazonProducto } from '../../core/amazonLista';
import { ApiError } from '../../api/types';
import { formatMoney } from '../../core/money';
import type { Item } from '../../core/types';
import { DEMO_AMAZON_HTML } from '../../api/seed';
import { Bow } from '../Bow';
import { Button, ButtonGroup } from '../Button';
import { olvidaCompartido } from '../compartido';
import { go, useApi } from '../ctx';
import { errorText, Sheet, useToast } from '../kit';

/** `#/amazon` (lo compartido desde Android): busca tu plaza y abre allí la importación. */
export function AmazonDestino() {
  const api = useApi();
  const [msg, setMsg] = useState('Buscando tu lista…');
  useEffect(() => {
    const me = api.me()?.id;
    void (async () => {
      // ponytail: la primera plaza propia; con varios grupos, elegir grupo si hiciera falta.
      for (const g of await api.groups().catch(() => [])) {
        const mine = (await api.groupDetail(g.id).catch(() => null))?.lists.find((l) => l.user === me);
        if (mine) return go(`/l/${mine.id}/amazon`);
      }
      olvidaCompartido(); // V11-4: sin plaza, lo compartido no se queda en memoria
      setMsg('Para importar una lista necesitas estar en un grupo con tu plaza.');
    })();
  }, [api]);
  return <p className="lead" role="status">{msg}</p>;
}

export type Plataforma = 'android' | 'ios' | 'escritorio';
export const plataforma = (ua = navigator.userAgent, touch = navigator.maxTouchPoints ?? 0): Plataforma =>
  /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && touch > 1) ? 'ios' : 'escritorio';

const NOMBRE: Record<Plataforma, string> = { android: 'Android', ios: 'iPhone', escritorio: 'Ordenador' };
type Dibujo = 'abrir' | 'pulsar' | 'menu' | 'teclas-a' | 'teclas-c' | 'pegar';
const PASOS: Record<Plataforma, [Dibujo, string][]> = {
  android: [
    ['abrir', 'Abre tu lista de Amazon en Chrome, no en la app de Amazon (la app solo comparte el enlace), y baja hasta el final para que carguen todos.'],
    ['pulsar', 'Mantén el dedo sobre un texto que no sea el nombre de un producto, por ejemplo una fecha, hasta que salga el menú.'],
    ['menu', 'Toca «Seleccionar todo» y después «Copiar», o toca «Compartir» y elige Lazo.'],
    ['pegar', 'Vuelve a Lazo y toca «Pegar».'],
  ],
  ios: [
    ['abrir', 'Abre tu lista de Amazon en Safari, no en la app de Amazon (la app solo comparte el enlace), y baja hasta el final para que carguen todos.'],
    ['pulsar', 'Mantén el dedo sobre un texto que no sea el nombre de un producto, por ejemplo una fecha, hasta que salga el menú.'],
    ['menu', 'Toca «Seleccionar todo» y después «Copiar».'],
    ['pegar', 'Vuelve a Lazo y toca «Pegar».'],
  ],
  escritorio: [
    ['abrir', 'Abre tu lista de Amazon en el navegador.'],
    ['teclas-a', 'Pulsa Ctrl + A (⌘ + A en un Mac) para seleccionarlo todo.'],
    ['teclas-c', 'Pulsa Ctrl + C (⌘ + C) para copiarlo.'],
    ['pegar', 'Vuelve aquí y pulsa «Pegar» (o Ctrl + V).'],
  ],
};

const NADA = 'No encuentro productos en lo que has pegado. Copia la página entera de tu lista (sigue los pasos) y vuelve a pegarla.';

/** El enlace de una lista: su identificador o el código de un `amzn.eu/d/…` (que el servidor resuelve). */
export type EnlaceLista = { id: string; corto?: undefined } | { corto: string; id?: undefined };

/**
 * Importar una lista de Amazon. Si el servidor tiene encendida la lectura (`AMAZON_IMPORT=on`), basta el enlace: lo lee
 * el servidor (camino a). Si no, o si Amazon no deja, copiar y pegar la página (camino b, docs/legal/AMAZON.md): lo
 * pegado se analiza aquí, no se guarda ni se envía. En los dos casos solo se crean los regalos que la persona marca.
 */
export function AmazonLista({ listId, enlace, compartido, deOtraApp, onNoEsLista, onClose, onSaved }: { listId: string; enlace?: EnlaceLista; compartido?: { text: string; html?: string }; deOtraApp?: boolean; onNoEsLista?: () => void; onClose: () => void; onSaved: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [plat, setPlat] = useState<Plataforma>(() => plataforma());
  const [hint, setHint] = useState<string>();
  // En el APK el WebView puede no dejar leer el portapapeles: el campo de pegar está a la vista desde el principio.
  const [aMano, setAMano] = useState(() => Capacitor.isNativePlatform());
  const [ajeno, setAjeno] = useState(false);
  const [productos, setProductos] = useState<AmazonProducto[] | null>(null);
  const [visibles, setVisibles] = useState<Item[] | null>(null);
  // Lectura automática: en curso, su fallo (con su código) y si la vista previa vino del servidor (con fotos).
  const [leyendo, setLeyendo] = useState(!!enlace);
  const [fallo, setFallo] = useState<{ code?: string; message: string; id?: string } | null>(null);
  const [delServidor, setDelServidor] = useState<{ partial?: boolean } | null>(null);
  // V-41: el identificador de una lista llegada de otra app, a la espera de que alguien pulse «Leer la lista».
  const [pendiente, setPendiente] = useState<string | null>(null);
  // El servidor no lee listas (AMAZON_IMPORT apagada o servidor antiguo): se explica cómo encenderlo.
  const [apagada, setApagada] = useState(false);

  // AMZ-11: los duplicados, solo contra lo que la dueña ve de su lista (el servidor ya no le manda sorpresas ni retirados).
  useEffect(() => {
    api.listDetail(listId).then((d) => setVisibles(d.items), () => setVisibles([]));
  }, [api, listId]);

  /** `tocado`: alguien ha pulsado. Lo que llega de otra app no sale a Amazon hasta que pulse «Leer la lista» (V-41). */
  const leer = async (ref: EnlaceLista, tocado = true) => {
    setLeyendo(true);
    setFallo(null);
    setHint(undefined);
    setPendiente(null);
    let id = ref.id;
    try {
      id ??= await api.amazonCorto(ref.corto!);
      if (!tocado) return setPendiente(id);
      const r = await api.amazonLista(id);
      setDelServidor({ partial: r.partial });
      setProductos(r.productos.flatMap((p) => saneaProducto(p) ?? []));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === 'NO_ES_LISTA' && ref.corto && onNoEsLista) return onNoEsLista(); // era un producto, no una lista
      setFallo({ code, message: errorText(e), id });
    } finally {
      setLeyendo(false);
    }
  };

  /** Con el enlace de una lista: si el servidor sabe leerla, la lee; si no, cómo encenderlo y los pasos de copiar y pegar. */
  const conEnlace = (ref: EnlaceLista, tocado = true) => {
    setLeyendo(true);
    // Si la pregunta falla (sin red, servidor antiguo sin la ruta), cuenta como apagada.
    void api.capacidades().catch(() => ({ amazon: false })).then((c) => {
      if (c.amazon) return leer(ref, tocado);
      setLeyendo(false);
      if (ref.corto && onNoEsLista) return onNoEsLista();
      setHint(undefined);
      setApagada(true);
    });
  };

  useEffect(() => {
    if (enlace) conEnlace(enlace, !deOtraApp);
  }, []);

  const analiza = (text: string, html?: string, tocado = true) => {
    const t = text.slice(0, MAX_PEGADO);
    const found = parseListaPegada(t, html?.slice(0, MAX_PEGADO));
    setAjeno(false);
    setDelServidor(null);
    const id = listaId(t);
    if (found.length) {
      setProductos(found);
      setHint(undefined);
    } else if (soloEnlace(t) && id) conEnlace({ id }, tocado);
    else setHint(NADA);
  };

  // Lo compartido desde otra app (Android) va directo a la vista previa; si es solo un enlace, se pregunta antes.
  useEffect(() => {
    if (!compartido) return;
    analiza(compartido.text, compartido.html, !deOtraApp);
    setAjeno(!!deOtraApp); // V11-2: que se vea que no lo ha pegado ella
    olvidaCompartido();
  }, [compartido]);

  // Ctrl+V en cualquier punto de la hoja (y el campo de respaldo): se lee el evento, nada se pinta en la página.
  useEffect(() => {
    if (productos || leyendo) return;
    const on = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      e.preventDefault();
      analiza(e.clipboardData.getData('text/plain'), e.clipboardData.getData('text/html') || undefined);
    };
    document.addEventListener('paste', on);
    return () => document.removeEventListener('paste', on);
  });

  const pegar = async () => {
    try {
      if (navigator.clipboard?.read) {
        const parts = await navigator.clipboard.read();
        const pick = async (type: string) => {
          const item = parts.find((p) => p.types.includes(type));
          return item ? (await item.getType(type)).text() : '';
        };
        const [html, text] = [await pick('text/html'), await pick('text/plain')];
        if (html || text) return analiza(text, html || undefined);
      }
    } catch {
      /* sin permiso o sin read(): probamos con el texto */
    }
    try {
      return analiza(await navigator.clipboard.readText());
    } catch {
      setAMano(true);
      setHint('El navegador no nos deja leer lo copiado. Mantén el dedo en el campo de abajo y elige «Pegar».');
    }
  };

  if (leyendo) return <Leyendo onClose={onClose} />;

  if (fallo) {
    return (
      <Sheet
        title="Importar lista de Amazon"
        onClose={onClose}
        footer={
          <ButtonGroup align="stretch">
            {fallo.id && fallo.code !== 'LISTA_PRIVADA' && fallo.code !== 'VACIA' && (
              <Button variant="primary" icon={ArrowClockwise} onClick={() => void leer({ id: fallo.id! })}>
                Reintentar
              </Button>
            )}
            <Button variant="secondary" icon={ClipboardText} onClick={() => setFallo(null)}>
              Copiar y pegar la página
            </Button>
          </ButtonGroup>
        }
      >
        <p className="notice" role="status">{fallo.message}</p>
        <p className="meta">También puedes abrir tu lista en el navegador, copiar la página entera y pegarla aquí: así no hace falta que Lazo entre en Amazon.</p>
      </Sheet>
    );
  }

  // V-41: un enlace llegado de otra app no hace salir al servidor hacia Amazon sin que nadie pulse.
  if (pendiente) {
    return (
      <Sheet
        title="Importar lista de Amazon"
        onClose={onClose}
        footer={
          <ButtonGroup align="stretch">
            <Button variant="primary" icon={ListChecks} onClick={() => conEnlace({ id: pendiente })} data-autofocus>
              Leer la lista
            </Button>
            <Button variant="secondary" icon={ClipboardText} onClick={() => setPendiente(null)}>
              Copiar y pegar la página
            </Button>
          </ButtonGroup>
        }
      >
        <p className="notice" role="status">Has compartido el enlace de una lista de Amazon.</p>
        <p className="meta">Si pulsas «Leer la lista», tu servidor la abrirá en Amazon y te enseñará lo que hay. No se añade nada hasta que elijas.</p>
      </Sheet>
    );
  }

  if (productos && visibles) return <Vista productos={productos} visibles={visibles ?? []} ajeno={ajeno} delServidor={delServidor} onBack={() => setProductos(null)} onClose={onClose} onAdd={async (sel) => {
    try {
      const n = await api.importItems(listId, sel.map((p) => ({ title: p.title, priceCents: p.priceCents, url: p.url, image: p.image, store: 'Amazon', priority: p.priority ?? 2, quantity: p.quantity ?? 1 })));
      toast(n === 1 ? '1 regalo añadido.' : `${n} regalos añadidos.`);
      onSaved();
      onClose();
    } catch (e) {
      toast(errorText(e));
    }
  }} />;

  return (
    <Sheet title="Importar lista de Amazon" onClose={onClose}>
      {apagada && <Apagada />}
      {hint && <p className="notice" role="status">{hint}</p>}
      <div className="stack">
        <div className="segmented" role="radiogroup" aria-label="Tu dispositivo">
          {(Object.keys(NOMBRE) as Plataforma[]).map((p) => (
            <label key={p}>
              <input type="radio" name="plataforma" checked={plat === p} onChange={() => setPlat(p)} />
              {NOMBRE[p]}
            </label>
          ))}
        </div>
        <ol className="amz-pasos">
          {PASOS[plat].map(([d, text], i) => (
            <li key={d}>
              <Paso dibujo={d} n={i + 1} />
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="stack">
        <Button variant="primary" size="lg" wide icon={ClipboardText} onClick={pegar} data-autofocus={apagada ? undefined : true /* apagada: que el aviso de arriba quede a la vista */}>
          Pegar
        </Button>
        {aMano && (
          <label className="field">
            <span>Pega aquí el texto de tu lista</span>
            <textarea
              className="textarea"
              autoFocus={!Capacitor.isNativePlatform()} // en el APK está desde el principio: sin abrir el teclado solo
              onPaste={(e: ReactClipboardEvent<HTMLTextAreaElement>) => {
                e.preventDefault();
                e.stopPropagation();
                analiza(e.clipboardData.getData('text/plain'), e.clipboardData.getData('text/html') || undefined);
              }}
            />
          </label>
        )}
        <p className="meta">Lazo no se conecta a Amazon: lee lo que pegas, aquí mismo, y solo guarda los regalos que elijas.</p>
        {api.demo && (
          <Button variant="link" onClick={() => analiza('', DEMO_AMAZON_HTML)}>
            Probar con una lista de ejemplo
          </Button>
        )}
      </div>
    </Sheet>
  );
}

const LINEA_ENV = 'AMAZON_IMPORT=on';
const COMANDO ='cd lazo/server && docker compose up -d --build';
const RIESGOS = 'https://github.com/BertMarti/lazo/blob/main/docs/legal/AMAZON.md';

/**
 * El enlace es de una lista, pero el servidor no las lee (AMAZON_IMPORT apagada, o un servidor antiguo sin la ruta).
 * Puede leerlo alguien de la familia que no aloja el servidor: se dice qué tiene que hacer quien lo aloja.
 */
function Apagada() {
  return (
    <div className="banner amz-apagada" role="status">
      <p>La importación automática está apagada en tu servidor. Quien lo aloja puede encenderla así:</p>
      <ol className="steps">
        <li>
          Añade esta línea a <code>server/.env</code>:
          <Copiable texto={LINEA_ENV} />
        </li>
        <li>
          Vuelve a arrancar el servidor:
          <Copiable texto={COMANDO} />
        </li>
      </ol>
      <p>
        Antes,{' '}
        <a href={RIESGOS} target="_blank" rel="noopener noreferrer">
          lee los riesgos
        </a>
        . Si el servidor no es tuyo, enséñale esto a quien lo aloja. Mientras tanto, copia y pega la página de tu lista: sigue estos pasos.
      </p>
    </div>
  );
}

function Copiable({ texto }: { texto: string }) {
  const toast = useToast();
  const copiar = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(texto))
      .then(
      () => toast('Copiado.'),
      () => toast('No se ha podido copiar. Mantén el dedo encima del texto y cópialo a mano.'),
    );
  return (
    <span className="amz-copiable">
      <code>{texto}</code>
      <Button size="sm" icon={Copy} onClick={() => void copiar()} aria-label={`Copiar ${texto}`}>
        Copiar
      </Button>
    </span>
  );
}

/** «Leyendo tu lista…»: el servidor va por tramos, con una pausa entre uno y otro, así que puede tardar. */
function Leyendo({ onClose }: { onClose: () => void }) {
  const [largo, setLargo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLargo(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <Sheet title="Importar lista de Amazon" onClose={onClose}>
      <div className="stack" role="status" aria-live="polite">
        <p className="lead">Leyendo tu lista…</p>
        <progress className="amz-progreso" aria-label="Leyendo tu lista" />
        <p className="meta">
          {largo
            ? 'Las listas largas tardan un poco más: Lazo lee los productos por tramos y espera un momento entre uno y otro.'
            : 'Tu servidor está leyendo la lista pública en Amazon. No se guarda nada hasta que elijas.'}
        </p>
      </div>
    </Sheet>
  );
}

function Vista({ productos, visibles, ajeno, delServidor, onBack, onClose, onAdd }: { productos: AmazonProducto[]; visibles: Item[]; ajeno?: boolean; delServidor?: { partial?: boolean } | null; onBack: () => void; onClose: () => void; onAdd: (sel: AmazonProducto[]) => Promise<void> }) {
  const dup = productos.map((p) => esDuplicado(p, visibles));
  const [on, setOn] = useState(() => dup.map((d) => !d));
  const [busy, setBusy] = useState(false);
  const n = on.filter(Boolean).length;
  const dups = dup.filter(Boolean).length;
  return (
    <Sheet
      title="Importar lista de Amazon"
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button variant="primary" loading={busy} disabled={n === 0} onClick={async () => { setBusy(true); await onAdd(productos.filter((_, i) => on[i])); setBusy(false); }}>
            {`Añadir ${n}`}
          </Button>
          <Button variant="secondary" onClick={onBack}>{delServidor ? 'Copiar y pegar la página' : 'Volver a pegar'}</Button>
        </ButtonGroup>
      }
    >
      <div className="stack" style={{ gap: 'var(--s-2)' }}>
        {ajeno && <p className="notice" role="status">Texto recibido de otra app. Revisa la lista: no se añade nada hasta que pulses «Añadir».</p>}
        <p className="lead">{productos.length === 1 ? 'He encontrado 1 producto.' : `He encontrado ${productos.length} productos.`}</p>
        {dups > 0 && <p className="meta">{dups === 1 ? '1 ya está en tu lista: lo dejamos sin marcar.' : `${dups} ya están en tu lista: los dejamos sin marcar.`}</p>}
        {delServidor?.partial && <p className="meta">Tu lista es muy larga: aquí están los primeros {productos.length}.</p>}
        {!delServidor && <p className="meta">Las fotos aparecerán al añadirlos.</p>}
      </div>
      <ul className="amz-vista">
        {productos.map((p, i) => (
          <li key={`${p.asin ?? ''}${i}`}>
            <label className="check">
              <input type="checkbox" checked={on[i]} onChange={(e) => setOn((o) => o.map((v, j) => (j === i ? e.target.checked : v)))} />
              <span className="gift-thumb paper" aria-hidden>
                {/* AMZ-16: con lo pegado, nada sale hacia Amazon antes de confirmar. Si la lista la leyó el servidor,
                    Amazon ya ha recibido esa visita: las fotos (solo de sus hosts, AMZ-10) se ven ya. */}
                {delServidor && p.image ? <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="noimg"><Bow size={28} /></span>}
              </span>
              <span className="grow">
                <span className="amz-titulo">{p.title}</span>
                <span className="meta">
                  {p.priceCents !== undefined && <span className="money">{formatMoney(p.priceCents)}</span>}
                  {(p.quantity ?? 1) > 1 && <span>{p.priceCents !== undefined && ' · '}{p.quantity} unidades</span>}
                  {dup[i] && <span className="amz-dup">{(p.priceCents !== undefined || (p.quantity ?? 1) > 1) && ' · '}Ya está en tu lista</span>}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Dibujos de los pasos: geometría propia, sin capturas de Amazon. */
function Paso({ dibujo, n }: { dibujo: Dibujo; n: number }) {
  const movil = (inner: ReactNode) => (
    <>
      <rect x="18" y="4" width="44" height="72" rx="7" fill="var(--tarjeta)" stroke="currentColor" strokeWidth="2.5" />
      <rect x="24" y="12" width="32" height="6" rx="3" fill="var(--hundido)" />
      {[26, 36, 46, 56].map((y) => <rect key={y} x="24" y={y} width={y === 46 ? 22 : 32} height="4" rx="2" fill="var(--linea-fuerte)" opacity="0.6" />)}
      {inner}
    </>
  );
  const tecla = (letra: string) => (
    <>
      <rect x="4" y="24" width="38" height="32" rx="6" fill="var(--tarjeta)" stroke="currentColor" strokeWidth="2.5" />
      <text x="23" y="45" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">Ctrl</text>
      <text x="47" y="45" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">+</text>
      <rect x="52" y="24" width="26" height="32" rx="6" fill="var(--terracota)" stroke="currentColor" strokeWidth="2.5" />
      <text x="65" y="46" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--sobre-terracota)">{letra}</text>
    </>
  );
  const body: Record<Dibujo, ReactNode> = {
    abrir: movil(<path d="M50 20 l8 8 m0 -8 v8 h-8" stroke="var(--terracota)" strokeWidth="3" fill="none" strokeLinecap="round" />),
    pulsar: movil(<><circle cx="40" cy="38" r="9" fill="var(--terracota)" opacity="0.35" /><circle cx="40" cy="38" r="4" fill="var(--terracota)" /></>),
    menu: movil(<><rect x="10" y="28" width="60" height="18" rx="9" fill="var(--tinta)" /><rect x="13" y="31" width="34" height="12" rx="6" fill="var(--terracota)" /><rect x="50" y="31" width="17" height="12" rx="6" fill="var(--tinta-2)" /></>),
    'teclas-a': tecla('A'),
    'teclas-c': tecla('C'),
    pegar: (
      <>
        <rect x="6" y="26" width="68" height="28" rx="14" fill="var(--terracota)" />
        <rect x="18" y="33" width="10" height="14" rx="2" fill="none" stroke="var(--sobre-terracota)" strokeWidth="2.5" />
        <rect x="34" y="37" width="30" height="6" rx="3" fill="var(--sobre-terracota)" />
      </>
    ),
  };
  return (
    <svg className="amz-dibujo" viewBox="0 0 80 80" width={dibujo.startsWith('teclas') ? 80 : 64} height={dibujo.startsWith('teclas') ? 80 : 64} aria-hidden data-paso={n}>
      {body[dibujo]}
    </svg>
  );
}
