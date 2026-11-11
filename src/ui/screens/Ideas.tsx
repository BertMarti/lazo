import { ArrowSquareOut, Plus, Sparkle } from '@phosphor-icons/react';
import { useState } from 'react';
import { IDEAS } from '../../ai/catalog';
import { loadAi } from '../../ai/provider';
import { AGE_BANDS, ageBand, suggestIdeas, type AgeBand, type AiIdea } from '../../ai/tasks';
import { formatMoney, parseAmount } from '../../core/money';
import type { GiftList } from '../../core/types';
import { Button, ButtonLink } from '../Button';
import { useApi } from '../ctx';
import { errorText, Sheet, useToast } from '../kit';

const BAND_LABEL: Record<AgeBand, string> = { '0-2': 'Bebé (0–2)', '3-5': '3 a 5 años', '6-8': '6 a 8 años', '9-12': '9 a 12 años', '13-17': 'Adolescente', '18-35': '18 a 35', '36-64': '36 a 64', '65+': 'Más de 65' };

/**
 * Ideas de regalo por edad, gustos y presupuesto. Con IA si está activada; si no, del catálogo local.
 * En tu lista (o la de un niño que llevas) se añaden directamente; en las ajenas, enlace para buscarlas.
 */
export function IdeasSheet({ list, canAdd, onClose, onAdded }: { list: GiftList; canAdd: boolean; onClose: () => void; onAdded: () => void }) {
  const api = useApi();
  const toast = useToast();
  const ai = loadAi();
  const [band, setBand] = useState<AgeBand>(list.birthYear ? ageBand(list.birthYear) : '36-64');
  const [likes, setLikes] = useState('');
  const [budget, setBudget] = useState('');
  const [ideas, setIdeas] = useState<AiIdea[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setErr('');
    const max = budget.trim() ? parseAmount(budget) : undefined;
    if (budget.trim() && !max) return setErr('El presupuesto no se entiende. Escribe, por ejemplo, 30.');
    if (ai.provider === 'none') {
      const words = likes.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
      const local = IDEAS[band]
        .filter((i) => !max || i.minCents <= max)
        .map((i) => ({ i, score: words.filter((w) => i.tags.some((t) => t.startsWith(w) || w.startsWith(t)) || i.title.toLowerCase().includes(w)).length }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ i }) => ({ title: i.title, why: i.why, priceCents: Math.round((i.minCents + i.maxCents) / 2), search: i.title }));
      return setIdeas(local);
    }
    setBusy(true);
    try {
      setIdeas(await suggestIdeas(ai, { band, likes, budgetCents: max ?? undefined }));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const add = async (i: AiIdea) => {
    try {
      await api.saveItem(list.id, { title: i.title, priceCents: i.priceCents, notes: i.why, priority: 2, quantity: 1 });
      toast('Añadido a la lista.');
      onAdded();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  return (
    <Sheet title={`Ideas para ${list.name}`} onClose={onClose}>
      <div className="grid-2">
        <label className="field">
          <span>Edad</span>
          <select className="select" value={band} onChange={(e) => setBand(e.target.value as AgeBand)}>
            {AGE_BANDS.map((b) => <option key={b} value={b}>{BAND_LABEL[b]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Hasta</span>
          <input className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="30 €" />
        </label>
      </div>
      <label className="field">
        <span>Gustos</span>
        <input className="input" value={likes} onChange={(e) => setLikes(e.target.value)} maxLength={200} placeholder="cocina, montaña, novela negra…" />
        <small>{ai.provider === 'none' ? 'Ideas de nuestro catálogo. Activa una IA gratuita en Ajustes para ideas a medida.' : 'Solo se envían la franja de edad, los gustos y el presupuesto. Nunca el nombre.'}</small>
      </label>
      <Button variant="primary" icon={Sparkle} loading={busy} onClick={run}>Ver ideas</Button>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
      {ideas && (
        <ul className="list-plain">
          {ideas.map((i) => (
            <li key={i.title}>
              <div className="grow">
                <p style={{ fontWeight: 700 }}>{i.title}</p>
                <p className="meta">
                  {i.priceCents !== undefined && <span className="money">~{formatMoney(i.priceCents)}</span>}
                  {i.priceCents !== undefined && ' · '}
                  {i.why}
                </p>
              </div>
              {canAdd ? (
                <Button variant="secondary" size="sm" icon={Plus} onClick={() => add(i)}>Añadir</Button>
              ) : (
                <ButtonLink variant="ghost" size="sm" iconEnd={ArrowSquareOut} href={`https://www.amazon.es/s?k=${encodeURIComponent(i.search)}`} target="_blank" rel="noopener noreferrer nofollow">
                  Buscar
                </ButtonLink>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
