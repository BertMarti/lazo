import { ArrowSquareOut, DeviceMobile } from '@phosphor-icons/react';
import { useState } from 'react';
import { loadAi, PRESETS, saveAi, type AiSettings } from '../../ai/provider';
import { suggestIdeas } from '../../ai/tasks';
import { Button, ButtonGroup, ButtonLink } from '../Button';
import { useApi } from '../ctx';
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
      <OtherDevice />
      <section className="panel stack" aria-labelledby="ia">
        <h2 id="ia" className="h-section">Inteligencia artificial</h2>
        <p className="lead">Opcional: Lazo funciona igual sin IA. Ayuda a entender Excel raros y a pensar ideas de regalo. La clave se guarda solo en este dispositivo; el servidor de Lazo nunca la ve.</p>
        <label className="field">
          <span>Proveedor</span>
          <select className="select" value={s.provider} onChange={(e) => setS({ ...s, provider: e.target.value as AiSettings['provider'], model: undefined })}>
            <option value="none">Sin IA (recomendado si no tienes Ollama)</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
      <section className="panel stack" aria-labelledby="legal">
        <h2 id="legal" className="h-section">Privacidad y legal</h2>
        <p className="lead">Tus datos se quedan en el servidor de tu casa, o en el de quien organiza tu familia. Lazo no es una empresa y nadie más los ve.</p>
        <ButtonGroup>
          {[
            ['PRIVACIDAD', 'Privacidad'],
            ['MENORES', 'Datos de los niños'],
            ['TERMINOS', 'Términos de uso'],
          ].map(([doc, label]) => (
            <ButtonLink key={doc} variant="ghost" iconEnd={ArrowSquareOut} href={`${LEGAL}/${doc}.md`} target="_blank" rel="noopener noreferrer">
              {label}
            </ButtonLink>
          ))}
        </ButtonGroup>
      </section>
    </div>
  );
}

const LEGAL = 'https://github.com/BertMarti/lazo/blob/main/docs/legal';

/** «Entrar en otro móvil»: un código de un solo uso para «Tengo un código» en el otro móvil. */
function OtherDevice() {
  const api = useApi();
  const [code, setCode] = useState<{ code: string; minutes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ask = async () => {
    setBusy(true);
    setErr('');
    try {
      setCode(await api.deviceCode());
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel stack" aria-labelledby="movil">
      <h2 id="movil" className="h-section">Entrar en otro móvil</h2>
      <p className="lead">En el otro móvil, abre Lazo, toca «Tengo un código» y escribe el código que verás aquí.</p>
      {code && (
        <p role="status">
          <span className="code" style={{ fontSize: 'var(--t-display)' }}>{code.code}</span>
          <br />
          <span className="meta">Caduca en {code.minutes} minutos</span>
        </p>
      )}
      {err && <p className="notice notice-error" role="alert">{err}</p>}
      <ButtonGroup>
        <Button variant={code ? 'secondary' : 'primary'} icon={DeviceMobile} loading={busy} onClick={ask}>
          {code ? 'Otro código' : 'Entrar en otro móvil'}
        </Button>
      </ButtonGroup>
    </section>
  );
}
