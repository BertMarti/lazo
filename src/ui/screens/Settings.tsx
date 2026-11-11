import { ArrowSquareOut } from '@phosphor-icons/react';
import { useState } from 'react';
import { loadAi, PRESETS, saveAi, type AiSettings } from '../../ai/provider';
import { suggestIdeas } from '../../ai/tasks';
import { Button, ButtonGroup, ButtonLink } from '../Button';
import { errorText, useToast } from '../kit';

/** Ajustes de la IA. Opcional: sin IA, Lazo funciona igual (sinónimos para Excel e ideas de un catálogo local). */
export function Settings() {
  const toast = useToast();
  const [s, setS] = useState<AiSettings>(loadAi);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const preset = PRESETS.find((p) => p.id === s.provider);

  const save = () => {
    saveAi(s);
    toast('Ajustes guardados en este dispositivo.');
  };
  const probe = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await suggestIdeas(s, { band: '36-64', likes: 'cocina' });
      setMsg({ ok: true, text: 'Funciona. La IA ha respondido.' });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg" style={{ maxWidth: 640 }}>
      <section className="panel stack" aria-labelledby="ia">
        <h2 id="ia" className="h-section">Inteligencia artificial</h2>
        <p className="lead">Opcional. Ayuda a entender Excel raros y a pensar ideas de regalo. La clave se guarda solo en este dispositivo; el servidor de Lazo nunca la ve.</p>
        <label className="field">
          <span>Proveedor</span>
          <select className="select" value={s.provider} onChange={(e) => setS({ ...s, provider: e.target.value as AiSettings['provider'], model: undefined })}>
            <option value="none">Sin IA (gratis, sin clave)</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.free ? ' · gratis' : ''}
              </option>
            ))}
          </select>
          {preset && <small>{preset.note}</small>}
        </label>
        {preset && preset.id !== 'ollama' && (
          <label className="field">
            <span>Tu clave</span>
            <input className="input" type="password" autoComplete="off" value={s.apiKey} onChange={(e) => setS({ ...s, apiKey: e.target.value.trim() })} placeholder="Pega aquí tu clave" />
            {preset.keyUrl && <small>Se crea gratis en la web del proveedor, con tu cuenta.</small>}
          </label>
        )}
        {preset && (
          <label className="field">
            <span>Modelo</span>
            <input className="input" value={s.model ?? preset.model} onChange={(e) => setS({ ...s, model: e.target.value.trim() || undefined })} />
          </label>
        )}
        {msg && <p className={msg.ok ? 'notice' : 'notice notice-error'} role="status">{msg.text}</p>}
        <ButtonGroup>
          <Button variant="primary" onClick={save}>Guardar</Button>
          {preset && <Button variant="secondary" loading={busy} onClick={probe}>Probar</Button>}
          {preset?.keyUrl && (
            <ButtonLink variant="ghost" iconEnd={ArrowSquareOut} href={preset.keyUrl} target="_blank" rel="noopener noreferrer">
              Conseguir clave
            </ButtonLink>
          )}
        </ButtonGroup>
      </section>
    </div>
  );
}
