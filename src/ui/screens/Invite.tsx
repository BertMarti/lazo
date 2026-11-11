import { Baby, Copy, Plus, WhatsappLogo } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../Button';
import { useApi } from '../ctx';
import { errorText, Sheet, useLoad, useToast } from '../kit';

/**
 * Invitar (solo admin): un enlace personal por plaza libre (entra con un toque y nadie puede ocupar su sitio)
 * y, debajo, el enlace para todos (quien lo abra elige su nombre y espera a que le aceptes).
 */
export function InviteSheet({ groupId, focusList, onClose, onChanged }: { groupId: string; focusList?: string; onClose: () => void; onChanged: () => void }) {
  const api = useApi();
  const toast = useToast();
  const { data, reload } = useLoad(() => api.groupDetail(groupId), [api, groupId]);
  const [err, setErr] = useState('');
  const [newName, setNewName] = useState('');
  const [child, setChild] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const send = async (listId?: string, name?: string) => {
    setErr('');
    setBusy(listId ?? 'general');
    try {
      const { url } = await api.createInvite(groupId, listId);
      const g = data!.group.name;
      const text = name ? `${name}, este es tu enlace para «${g}» en Lazo. Es solo para ti: ${url}` : `Entrad en «${g}» en Lazo y elegid vuestro nombre: ${url}`;
      if (navigator.share) await navigator.share({ title: 'Lazo', text }).catch(() => {});
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      toast(name ? `Enlace de ${name} listo para enviar.` : 'Enlace para todos listo para enviar.');
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const copy = async () => {
    try {
      const { url } = await api.createInvite(groupId);
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado.');
    } catch {
      setErr('No se ha podido copiar el enlace.');
    }
  };
  const add = async () => {
    if (!newName.trim()) return;
    try {
      await api.addPlaza(groupId, newName);
      setNewName('');
      reload();
      onChanged();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const addChild = async () => {
    if (!child.trim()) return setErr('Escribe el nombre de pila.');
    const y = year ? Number(year) : undefined;
    if (y !== undefined && (!Number.isInteger(y) || y < 2000 || y > new Date().getFullYear())) return setErr('El año de nacimiento no parece correcto.');
    try {
      await api.addChildList(groupId, child.trim(), y);
      toast(`Lista de ${child.trim()} creada. La llevas tú.`);
      setChild('');
      setYear('');
      reload();
      onChanged();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  const free = (data?.lists ?? []).filter((l) => l.kind !== 'child' && !l.user).sort((a, b) => Number(b.id === focusList) - Number(a.id === focusList));
  return (
    <Sheet title="Invitar" onClose={onClose}>
      <p data-autofocus tabIndex={-1} style={{ outline: 'none' }}>Envía a cada uno su enlace. Entra con un toque y nadie puede ocupar su sitio.</p>
      {free.length > 0 ? (
        <ul className="rows">
          {free.map((l) => (
            <li key={l.id}>
              <span className="avatar avatar-free" aria-hidden>{l.name.trim()[0]?.toUpperCase()}</span>
              <span className="grow">
                <b>{l.name}</b>
                <br />
                <span className="meta">Aún no ha entrado</span>
              </span>
              <Button variant="primary" size="sm" icon={WhatsappLogo} loading={busy === l.id} onClick={() => send(l.id, l.name)} data-autofocus={l.id === focusList || undefined}>
                Enviar enlace
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="meta">Todas las plazas están ocupadas.</p>
      )}
      <label className="field">
        <span>Añadir a alguien</span>
        <div className="input-row">
        <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder="Nombre" />
        <Button variant="secondary" icon={Plus} onClick={add} disabled={!newName.trim()}>Añadir</Button>
        </div>
      </label>

      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s-4)' }}>
        <h3 className="h-section">Enlace para todos</h3>
        <p className="meta">Quien lo abra elige su nombre y espera a que le aceptes.</p>
        <Button variant="secondary" wide icon={WhatsappLogo} loading={busy === 'general'} onClick={() => send()}>Enviar el enlace para todos</Button>
        <Button variant="link" icon={Copy} onClick={copy}>Copiar el enlace</Button>
        {api.demo && <p className="meta">En la demo, el enlace abre la pantalla de entrada de verdad. Pruébalo.</p>}
      </div>

      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s-4)' }}>
        <h3 className="h-section">Lista de un niño</h3>
        <p className="meta">Los niños no necesitan cuenta: su lista la llevas tú. Solo su nombre de pila y, si quieres, el año en que nació.</p>
        <div className="grid-2">
          <label className="field"><span>Nombre</span><input className="input" value={child} onChange={(e) => setChild(e.target.value)} maxLength={40} /></label>
          <label className="field"><span>Año</span><input className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" maxLength={4} /></label>
        </div>
        <Button variant="secondary" icon={Baby} onClick={addChild}>Crear su lista</Button>
      </div>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
