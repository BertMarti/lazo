import { DownloadSimple, SignOut, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { downloadCopia, exportGroup } from '../../core/copia';
import type { Group } from '../../core/types';
import { Button, ButtonGroup } from '../Button';
import { go, lastGroup, useApi } from '../ctx';
import { errorText, useToast } from '../kit';

/**
 * Al pie del grupo. Quien lo creó puede eliminarlo (escribiendo su nombre); los demás, salir.
 * Ningún texto depende de lo que haya reservado nadie: la confirmación es la misma para todos.
 */
export function GroupExit({ group, myPlaza }: { group: Group; myPlaza?: string }) {
  const api = useApi();
  const toast = useToast();
  const owner = api.me()?.id === group.owner;
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const keepsHucha = !!myPlaza && (myPlaza === group.treasurer || myPlaza === group.deputy);

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setErr('');
    try {
      await fn();
      if (ok) {
        lastGroup.clear();
        toast(ok);
        go('/');
      }
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const cancel = () => {
    setAsking(false);
    setTyped('');
    setErr('');
  };

  if (owner) {
    return (
      <section className="panel stack group-exit" aria-labelledby="grupo-fin">
        <h2 id="grupo-fin" className="h-section">Eliminar el grupo</h2>
        <p className="meta">Solo puedes hacerlo tú, porque lo creaste. Para irte sin eliminarlo tendrías que pasar el grupo a otra persona, y eso aún no se puede.</p>
        {asking ? (
          <div role="alertdialog" aria-labelledby="grupo-fin-q" aria-describedby="grupo-fin-d" className="stack">
            <p id="grupo-fin-q" className="group-exit-q">¿Eliminar «{group.name}» para todos?</p>
            <p id="grupo-fin-d">Se borran para siempre todas las listas y sus regalos, las reservas y las compras, la hucha y sus pagos, el sorteo del amigo invisible y todos los enlaces. Nadie podrá volver a entrar. No se puede deshacer.</p>
            <ButtonGroup>
              <Button variant="secondary" icon={DownloadSimple} loading={busy === 'copia'} onClick={() => act('copia', async () => {
                downloadCopia(await exportGroup(api, group.id));
                toast('Copia descargada.');
              })}>Descargar una copia antes</Button>
            </ButtonGroup>
            <label className="field">
              <span>Para confirmarlo, escribe el nombre del grupo: «{group.name}»</span>
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} maxLength={80} />
            </label>
            {err && <p className="notice notice-error" role="alert">{err}</p>}
            <ButtonGroup>
              <Button variant="danger" icon={Trash} disabled={typed.trim() !== group.name} loading={busy === 'borrar'} onClick={() => act('borrar', () => api.deleteGroup(group.id), `«${group.name}» se ha eliminado.`)}>
                Eliminar el grupo
              </Button>
              <Button variant="secondary" disabled={busy === 'borrar'} onClick={cancel}>No, dejarlo</Button>
            </ButtonGroup>
          </div>
        ) : (
          <ButtonGroup>
            <Button variant="secondary" icon={Trash} onClick={() => setAsking(true)}>Eliminar el grupo</Button>
          </ButtonGroup>
        )}
      </section>
    );
  }

  return (
    <section className="panel stack group-exit" aria-labelledby="grupo-fin">
      <h2 id="grupo-fin" className="h-section">Salir del grupo</h2>
      {keepsHucha ? (
        <p className="meta">Llevas las cuentas de la hucha, así que no puedes salir del grupo.</p>
      ) : asking ? (
        <div role="alertdialog" aria-labelledby="grupo-fin-q" aria-describedby="grupo-fin-d" className="stack">
          <p id="grupo-fin-q" className="group-exit-q">¿Salir de «{group.name}»?</p>
          <ul id="grupo-fin-d" className="group-exit-list">
            <li>Tu lista y tus regalos se quedan en el grupo como un sitio libre. Quien organiza puede volver a enviarte tu enlace.</li>
            <li>Lo que tenías reservado para otros y lo que ibas a poner a medias se suelta, para que otra persona pueda regalarlo. Lo que ya compraste o pagaste se queda apuntado.</li>
            <li>Si llevas la lista de un niño y nadie más la lleva, pasa a quien creó el grupo. Si ya os sorteasteis el amigo invisible, habrá que repetirlo.</li>
          </ul>
          {err && <p className="notice notice-error" role="alert">{err}</p>}
          <ButtonGroup>
            <Button variant="danger" icon={SignOut} loading={busy === 'salir'} onClick={() => act('salir', () => api.leaveGroup(group.id), `Has salido de «${group.name}».`)}>Sí, salir del grupo</Button>
            <Button variant="secondary" disabled={busy === 'salir'} onClick={cancel}>No</Button>
          </ButtonGroup>
        </div>
      ) : (
        <>
          <p className="meta">Dejarás de ver el grupo. Tu lista se queda como un sitio libre.</p>
          <ButtonGroup>
            <Button variant="secondary" icon={SignOut} onClick={() => setAsking(true)}>Salir del grupo</Button>
          </ButtonGroup>
        </>
      )}
    </section>
  );
}
