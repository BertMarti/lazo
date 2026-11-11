import { Baby, Copy, ShareNetwork, WhatsappLogo } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button, ButtonGroup, ButtonLink } from '../Button';
import { useApi } from '../ctx';
import { errorText, Sheet, useToast } from '../kit';

export function InviteSheet({ groupId, onClose, onChanged }: { groupId: string; onClose: () => void; onChanged: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [invite, setInvite] = useState<{ url: string; expires: string } | null>(null);
  const [err, setErr] = useState('');
  const [child, setChild] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.createInvite(groupId).then(setInvite, (e) => setErr(errorText(e)));
  }, [api, groupId]);

  const text = invite ? `Te invito a nuestra lista de regalos en Lazo. Entra aquí, sin contraseñas: ${invite.url}` : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite!.url);
      toast('Enlace copiado.');
    } catch {
      setErr('No se ha podido copiar. Mantén pulsado el enlace para copiarlo.');
    }
  };
  const share = () => navigator.share?.({ title: 'Lazo', text }).catch(() => {});

  const addChild = async () => {
    if (!child.trim()) return setErr('Escribe el nombre de pila.');
    const y = year ? Number(year) : undefined;
    if (y !== undefined && (!Number.isInteger(y) || y < 2000 || y > new Date().getFullYear())) return setErr('El año de nacimiento no parece correcto.');
    setBusy(true);
    try {
      await api.addChildList(groupId, child.trim(), y);
      toast(`Lista de ${child.trim()} creada. La llevas tú.`);
      setChild('');
      setYear('');
      onChanged();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Invitar a la familia" onClose={onClose}>
      <div className="stack">
        <p>Quien abra el enlace entra en el grupo escribiendo solo su nombre. Caduca en 14 días.</p>
        <input className="input" readOnly value={invite?.url ?? 'Preparando el enlace…'} aria-label="Enlace de invitación" onFocus={(e) => e.currentTarget.select()} />
        <ButtonGroup>
          <ButtonLink variant="primary" icon={WhatsappLogo} href={invite ? `https://wa.me/?text=${encodeURIComponent(text)}` : undefined} target="_blank" rel="noopener noreferrer">WhatsApp</ButtonLink>
          <Button variant="secondary" icon={Copy} onClick={copy} disabled={!invite}>Copiar</Button>
          {'share' in navigator && <Button variant="secondary" icon={ShareNetwork} onClick={share} disabled={!invite}>Compartir</Button>}
        </ButtonGroup>
        {api.demo && <p className="meta">En la demo el enlace no lleva a ningún sitio.</p>}
      </div>
      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 0 }} />
      <div className="stack">
        <h3 className="h-section" style={{ fontSize: 'var(--t-lg)' }}>Lista de un niño</h3>
        <p className="meta">Los niños no necesitan cuenta: su lista la llevas tú. Solo su nombre de pila y, si quieres, el año en que nació (para las ideas por edad).</p>
        <div className="grid-2">
          <label className="field"><span>Nombre</span><input className="input" value={child} onChange={(e) => setChild(e.target.value)} maxLength={40} /></label>
          <label className="field"><span>Año</span><input className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" maxLength={4} /></label>
        </div>
        <Button variant="secondary" icon={Baby} loading={busy} onClick={addChild}>Crear su lista</Button>
      </div>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
