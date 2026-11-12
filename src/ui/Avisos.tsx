import { Bell } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { collectFacts, notices, seenFacts, withBaseline, type Facts, type Notice } from '../core/avisos';
import { IconButton } from './Button';
import { useApi } from './ctx';
import { Sheet } from './kit';

/** Campana de la cabecera: lo nuevo del grupo desde la última vez que la abriste (core/avisos.ts). */
export function Avisos({ refresh }: { refresh: string }) {
  const api = useApi();
  const me = api.me()?.id;
  const [state, setState] = useState<{ now: Facts[]; list: Notice[] } | null>(null);
  const [shown, setShown] = useState<Notice[] | null>(null);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    collectFacts(api).then(
      (now) => {
        if (!alive) return;
        const prev = withBaseline(seenFacts.get(me), now);
        seenFacts.set(me, prev);
        setState({ now, list: notices(prev, now) });
      },
      () => {}, // sin conexión: la campana sigue como estaba
    );
    return () => {
      alive = false;
    };
  }, [api, me, refresh]);

  if (!me) return null;
  const n = state?.list.length ?? 0;
  const close = () => {
    if (state) {
      seenFacts.set(me, state.now);
      setState({ ...state, list: [] });
    }
    setShown(null);
  };

  return (
    <>
      <span className="bell">
        <IconButton icon={Bell} label={n ? `Avisos: ${n} sin leer` : 'Avisos'} onClick={() => setShown(state?.list ?? [])} />
        {n > 0 && (
          <span className="bell-count" aria-hidden>
            {n > 9 ? '9+' : n}
          </span>
        )}
      </span>
      {shown && (
        <Sheet title="Avisos" onClose={close}>
          {shown.length ? (
            <ul className="avisos" aria-label="Avisos nuevos">
              {shown.map((a, i) => (
                <li key={a.key}>
                  <a href={`#${a.href}`} onClick={close} data-autofocus={i === 0 || undefined}>
                    <span className="aviso-text">{a.text}</span>
                    <span className="aviso-group">{a.group}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lead">Estás al día. Aquí verás lo nuevo del grupo: regalos, quién entra, la hucha y el sorteo.</p>
          )}
        </Sheet>
      )}
    </>
  );
}
