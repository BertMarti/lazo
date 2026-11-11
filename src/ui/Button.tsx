// Sistema único de botones (DESIGN.md §Botones). Prohibido escribir <button className="btn…"> fuera de este archivo.
import type { Icon } from '@phosphor-icons/react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'on-box' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';
const ICON: Record<ButtonSize, number> = { sm: 18, md: 20, lg: 22 };

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: Icon;
  iconEnd?: Icon;
  wide?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

const cls = ({ variant = 'secondary', size = 'md', wide }: Common, extra?: string) =>
  ['btn', `btn-${variant}`, `btn-${size}`, wide && 'btn-wide', extra].filter(Boolean).join(' ');

function Content({ icon: I, iconEnd: E, size = 'md', loading, children }: Common) {
  const px = ICON[size];
  return (
    <>
      {loading ? <span className="btn-spinner" aria-hidden /> : I && <I size={px} weight="bold" aria-hidden className="btn-icon" />}
      {children != null && children !== false && <span className="btn-label">{children}</span>}
      {E && <E size={px} weight="bold" aria-hidden className="btn-icon" />}
    </>
  );
}

export function Button({ variant, size, icon, iconEnd, wide, loading, children, className, type = 'button', onClick, ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  const c = { variant, size, icon, iconEnd, wide, loading, children };
  return (
    <button
      {...rest}
      type={loading ? 'button' : type}
      className={cls(c, className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
    >
      <Content {...c} />
    </button>
  );
}

export function ButtonLink({ variant, size, icon, iconEnd, wide, children, className, ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const c = { variant, size, icon, iconEnd, wide, children };
  return (
    <a {...rest} className={cls(c, className)}>
      <Content {...c} />
    </a>
  );
}

/** Botón que envuelve un <input type="file">. */
export function FileButton({ variant, size, icon, wide, loading, children, className, input, ...rest }: Common & LabelHTMLAttributes<HTMLLabelElement> & { input: ReactNode }) {
  const c = { variant, size, icon, wide, loading, children };
  return (
    <label {...rest} className={cls(c, className)} aria-busy={loading || undefined}>
      {input}
      <Content {...c} />
    </label>
  );
}

/** Solo icono: siempre 44 × 44 y con nombre accesible obligatorio. */
export function IconButton({ icon: I, label, onBox, className, type = 'button', ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { icon: Icon; label: string; onBox?: boolean }) {
  return (
    <button {...rest} type={type} aria-label={label} title={rest.title ?? label} className={['icon-btn', onBox && 'icon-btn-on-box', className].filter(Boolean).join(' ')}>
      <I size={22} weight="bold" aria-hidden />
    </button>
  );
}

/** Grupo de acciones: la principal siempre primero. */
export function ButtonGroup({ children, align = 'start', label }: { children: ReactNode; align?: 'start' | 'end' | 'stretch'; label?: string }) {
  return (
    <div role="group" aria-label={label} className={['btn-group', align !== 'start' && `btn-group-${align}`].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
