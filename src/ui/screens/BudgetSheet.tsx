import { useState } from 'react';
import { formatMoney, parseAmount } from '../../core/money';
import type { Budget, GiftList } from '../../core/types';
import { Button, ButtonGroup } from '../Button';
import { useApi } from '../ctx';
import { errorText, Sheet, useToast } from '../kit';

/** «Presupuesto para Mamá»: lo fija cualquiera del grupo menos Mamá. */
export function BudgetSheet({ list, budget, onClose, onSaved }: { list: GiftList; budget?: Budget; onClose: () => void; onSaved: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [value, setValue] = useState(budget ? (budget.amountCents / 100).toFixed(2).replace('.', ',') : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (cents: number | null) => {
    setErr('');
    setBusy(true);
    try {
      await api.setBudget(list.id, cents);
      toast(cents === null ? 'Presupuesto quitado.' : `Presupuesto guardado: ${formatMoney(cents)}.`);
      onSaved();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={`Presupuesto para ${list.name}`}
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button
            variant="primary"
            loading={busy}
            onClick={() => {
              const c = parseAmount(value);
              if (!c) return setErr('Escribe una cantidad, por ejemplo 200.');
              save(c);
            }}
          >
            Guardar
          </Button>
          {budget && (
            <Button variant="ghost" onClick={() => save(null)} disabled={busy}>
              Quitar presupuesto
            </Button>
          )}
        </ButtonGroup>
      }
    >
      <label className="field">
        <span>¿Cuánto os gastáis entre todos?</span>
        <input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="200" autoFocus />
        <small>Lo ve todo el grupo menos {list.name}.</small>
      </label>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
