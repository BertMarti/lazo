import { ArrowSquareOut, DeviceMobile, DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { loadAi, PRESETS, saveAi, type AiSettings } from '../../ai/provider';
import { suggestIdeas } from '../../ai/tasks';
import { COPIA_MAX, CopiaError, downloadCopia, exportGroup, parseCopia, restoreCopia } from '../../core/copia';
import { Button, ButtonGroup, ButtonLink, FileButton } from '../Button';
import { go, useApi } from '../ctx';
import { errorText, useLoad, useToast } from '../kit';

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
      <GroupCopy />
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
    </div>
  );
}

/** «Copia del grupo»: descargar lo que ves de un grupo que organizas y crear un grupo nuevo desde una copia. */
function GroupCopy() {
  const api = useApi();
  const toast = useToast();
  const me = api.me();
  const { data } = useLoad(async () => {
    const out = [];
    for (const g of await api.groups()) {
      const d = await api.groupDetail(g.id);
      if (d.members.some((m) => m.id === me?.id && m.role === 'admin')) out.push(g);
    }
    return out;
  }, [api, me?.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const download = async (id: string) => {
    setBusy(id);
    setErr('');
    try {
      downloadCopia(await exportGroup(api, id));
      toast('Copia descargada.');
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const restore = async (file?: File) => {
    if (!file) return;
    setBusy('restore');
    setErr('');
    try {
      if (file.size > COPIA_MAX.bytes) throw new CopiaError('El archivo es demasiado grande para ser una copia de Lazo.');
      const id = await restoreCopia(api, parseCopia(await file.text()));
      toast('Grupo creado. Envía a cada persona su enlace.');
      go(`/g/${id}`);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const groups = data ?? [];
  return (
    <section className="panel stack copia" aria-labelledby="copia">
      <h2 id="copia" className="h-section">Copia del grupo</h2>
      <p className="lead">Para empezar otra Navidad con las mismas personas y sus listas, o para llevaros el grupo a otro servidor. No es la copia de seguridad del servidor: esa la hace quien lo instala.</p>
      {groups.length > 0 && (
        <>
          <p className="meta">La copia lleva lo que tú ves. De tu propia lista, solo los regalos que pediste: nada de lo que te preparan.</p>
          <ButtonGroup>
            {groups.map((g) => (
              <Button key={g.id} variant="secondary" icon={DownloadSimple} loading={busy === g.id} onClick={() => download(g.id)}>
                {groups.length === 1 ? 'Descargar copia' : `Descargar copia de ${g.name}`}
              </Button>
            ))}
          </ButtonGroup>
        </>
      )}
      <p className="meta">Al crear un grupo desde una copia salen las mismas personas, con sitios libres para reenviarles el enlace, y los regalos que pidió cada una. Las reservas, compras y aportaciones no se copian: empezáis de cero.</p>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
      <ButtonGroup>
        <FileButton
          variant="secondary"
          icon={UploadSimple}
          loading={busy === 'restore'}
          input={<input type="file" className="sr-only" accept=".json,application/json" onChange={(e) => {
            void restore(e.target.files?.[0]);
            e.target.value = '';
          }} />}
        >
          Crear un grupo desde una copia
        </FileButton>
      </ButtonGroup>
    </section>
  );
}

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
