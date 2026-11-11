import { EyeSlash, X } from '@phosphor-icons/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ItemStatus } from '../core/status';
import type { User } from '../core/types';
import { Button, IconButton } from './Button';

export const FLAVORS = ['limon', 'canela', 'menta', 'fresa', 'violeta', 'almendra', 'cielo'] as const;
export type Flavor = (typeof FLAVORS)[number];
export const flavorOf = (color?: string): Flavor => (FLAVORS as readonly string[]).includes(color ?? '') ? (color as Flavor) : 'almendra';

export function Avatar({ user, size }: { user: Pick<User, 'name' | 'color'>; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={['avatar', size && `avatar-${size}`].filter(Boolean).join(' ')} data-flavor={flavorOf(user.color)} aria-hidden>
      {initial(user.name)}
    </span>
  );
}

export const initial = (name: string) => [...name.replace(/^(abuela|abuelo|tía|tío)\s+/i, '').trim()][0]?.toUpperCase() ?? '·';

const SEAL_LABEL: Record<ItemStatus['kind'], string> = {
  free: 'Libre',
  reserved: 'Reservado',
  pot: 'Para la hucha',
  bought: 'Comprado',
  partial: 'A medias',
  covered: 'Cubierto',
};

/**
 * El sello de Lazo: un único trazo para todos los estados.
 * Libre = trazo; reservado = trazo dorado; comprado/cubierto = lleno; a medias = se llena por porcentaje.
 */
export function Seal({ status, animate, size = 44 }: { status: ItemStatus; animate?: boolean; size?: 24 | 44 }) {
  const k = status.kind;
  const filled = k === 'bought' || k === 'covered';
  const pct = k === 'partial' ? (status.percent ?? 50) : filled ? 100 : 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  // Borde festoneado: 16 lóbulos, geometría exacta.
  const scallop = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(22 + Math.cos(a) * 19).toFixed(2)},${(22 + Math.sin(a) * 19).toFixed(2)}`;
  });
  const ink = k === 'free' ? 'var(--ink-3)' : 'var(--foil-ink)';
  return (
    <span className="seal" style={{ '--seal': `${size}px` } as CSSProperties} data-enter={animate || undefined} role="img" aria-label={SEAL_LABEL[k] + (k === 'partial' && status.percent !== undefined ? ` ${status.percent} %` : '')}>
      <svg viewBox="0 0 44 44" aria-hidden>
        {scallop.map((p, i) => {
          const [x, y] = p.split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r={3.6} fill={filled ? 'var(--foil-fill)' : 'var(--surface)'} stroke={ink} strokeWidth={1.2} />;
        })}
        <circle cx={22} cy={22} r={18} fill={filled ? 'var(--foil-fill)' : 'var(--surface)'} />
        <circle cx={22} cy={22} r={r} fill="none" stroke={ink} strokeWidth={1.4} strokeDasharray={k === 'free' ? '2 3' : undefined} />
        {k === 'partial' && (
          <circle cx={22} cy={22} r={r} fill="none" stroke="var(--foil-fill)" strokeWidth={5} strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 22 22)" />
        )}
        {filled && <path d="M15.5 22.5l4.5 4.5 8.5-9" fill="none" stroke="#241c05" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
        {k === 'pot' && <circle cx={22} cy={22} r={4} fill="var(--foil-ink)" />}
        {k === 'reserved' && <path d="M14 22h16" stroke="var(--foil-ink)" strokeWidth={2.4} strokeLinecap="round" />}
      </svg>
    </span>
  );
}

export const statusLabel = (s: ItemStatus) =>
  s.kind === 'partial' && s.percent !== undefined ? `A medias · ${s.percent} %` : SEAL_LABEL[s.kind];

/** El chip de la regla: «Mamá no ve esto». Único chip dorado de la app. */
export function VisibilityNote({ children }: { children: ReactNode }) {
  return (
    <p className="vis">
      <EyeSlash size={18} weight="bold" aria-hidden /> {children}
    </p>
  );
}

/** Hoja: <dialog> nativo (foco atrapado, Escape y fondo gratis). Abajo en móvil, centrada en escritorio. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      // Foco en el primer control útil del cuerpo, nunca en la ✕ (Fable, REFERENCIAS P0).
      d.querySelector<HTMLElement>('.sheet-body [data-autofocus], .sheet-body input, .sheet-body select, .sheet-body textarea, .sheet-body button, .sheet-foot button')?.focus();
    }
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header className="sheet-head">
        <h2 id="sheet-title">{title}</h2>
        <IconButton icon={X} label="Cerrar" onClick={onClose} />
      </header>
      <div className="sheet-body">{children}</div>
      {footer && <footer className="sheet-foot">{footer}</footer>}
    </dialog>
  );
}

// — Avisos breves —
export interface ToastAction {
  label: string;
  run: () => void;
}
type ToastFn = (msg: string, opts?: { action?: ToastAction }) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);
/** Avisos breves: 3 s, o 6 s si llevan acción («Deshacer»). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; n: number; action?: ToastAction } | null>(null);
  const show = useCallback<ToastFn>((text, opts) => setMsg((m) => ({ text, n: (m?.n ?? 0) + 1, action: opts?.action })), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.action ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div role="status" className="toast-host">
        {msg && (
          <div key={msg.n} className="toast">
            <span>{msg.text}</span>
            {msg.action && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  msg.action!.run();
                  setMsg(null);
                }}
              >
                {msg.action.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

/** Carga asíncrona con recarga manual. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): { data?: T; error?: string; reload: () => void } {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setState({ data }),
      (e: unknown) => alive && setState({ error: e instanceof Error ? e.message : 'Algo ha fallado.' }),
    );
    return () => {
      alive = false;
    };
  }, [...deps, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

export const daysUntil = (date?: string): number | null => {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
};

export const OCCASION: Record<string, string> = {
  navidad: 'Navidad',
  cumpleanos: 'Cumpleaños',
  boda: 'Boda',
  bebe: 'Bebé',
  otro: 'Ocasión especial',
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Algo ha fallado. Inténtalo otra vez.');
