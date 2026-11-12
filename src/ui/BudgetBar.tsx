import { Warning } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import type { BudgetProgress } from '../core/budget';
import { formatMoney } from '../core/money';

/** «Quedan 25,10 €», «Presupuesto completo» u «Os pasáis 10 €». */
export function leftText(p: BudgetProgress, currency = 'EUR', leftWord = 'Quedan', fullText = 'Presupuesto completo', overWord = 'Os pasáis') {
  const m = (c: number) => formatMoney(c, currency);
  return p.over ? `${overWord} ${m(-p.left)}` : p.left === 0 && p.target > 0 ? fullText : `${leftWord} ${m(p.left)}`;
}

/** Barra de presupuesto (o de «a medias»). Excedido = color + icono + texto, nunca solo color. */
export function BudgetBar({ p, currency = 'EUR', size = 'md', label, leftWord = 'Quedan', fullText = 'Presupuesto completo', overWord = 'Os pasáis' }: {
  p: BudgetProgress;
  currency?: string;
  size?: 'md' | 'sm';
  label: string;
  leftWord?: string;
  fullText?: string;
  overWord?: string;
}) {
  const m = (c: number) => formatMoney(c, currency);
  const right = leftText(p, currency, leftWord, fullText, overWord);
  return (
    <div
      className={`budget${size === 'sm' ? ' budget-sm' : ''}`}
      data-over={p.over || undefined}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={p.target}
      aria-valuenow={Math.min(p.committed, p.target)}
      aria-valuetext={`${m(p.committed)} de ${m(p.target)}. ${right}`}
    >
      <div className="budget-figs" aria-hidden>
        <span>
          <b>{m(p.committed)}</b> de {m(p.target)}
        </span>
        <span className="budget-left">
          {p.over && <Warning size={16} weight="fill" />}
          {right}
        </span>
      </div>
      <div className="budget-track" aria-hidden>
        <div className="budget-fill" style={{ '--p': p.percent / 100 } as CSSProperties} />
      </div>
    </div>
  );
}
