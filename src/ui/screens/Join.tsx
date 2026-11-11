import { useState } from 'react';
import { Button } from '../Button';
import { go, useApi } from '../ctx';
import { errorText } from '../kit';

/** Entrar desde un enlace de invitación: solo el nombre. */
export function Join({ token }: { token: string }) {
  const api = useApi();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Escribe tu nombre, como te llama la familia.');
    setBusy(true);
    try {
      await api.join(token, name.trim());
      go('/');
    } catch (x) {
      setErr(errorText(x));
      setBusy(false);
    }
  };
  return (
    <form className="panel stack" style={{ maxWidth: 480, margin: '0 auto' }} onSubmit={submit}>
      <h2 className="h-section">Te han invitado a Lazo</h2>
      <p>Escribe tu nombre y entra. Sin contraseñas ni correos.</p>
      <label className="field">
        <span>Tu nombre</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" autoFocus />
      </label>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
      <Button type="submit" variant="primary" size="lg" wide loading={busy}>Entrar</Button>
    </form>
  );
}
