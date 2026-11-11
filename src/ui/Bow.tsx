import { useEffect, useRef } from 'react';

/**
 * El lazo de Lazo: dos lazadas, el nudo y dos cabos. Es la marca y también el sello de «cogido».
 * Con `tie`, se anuda al aparecer (las lazadas se dibujan y el nudo se aprieta). Con reduced-motion,
 * aparece sin más.
 */
export function Bow({ size = 28, tie, className, title }: { size?: number; tie?: boolean; className?: string; title?: string }) {
  return (
    <svg
      className={['bow', tie && 'bow-tie', className].filter(Boolean).join(' ')}
      width={size}
      height={size * (40 / 48)}
      viewBox="0 0 48 40"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path className="bow-loop bow-l" pathLength={1} d="M24 20C17 9 6 6 4 12s6 12 20 8z" />
      <path className="bow-loop bow-r" pathLength={1} d="M24 20c7-11 18-14 20-8s-6 12-20 8z" />
      <path className="bow-tail" pathLength={1} d="M22 21l-8 16M26 21l8 16" />
      <circle className="bow-knot" cx="24" cy="20" r="4.2" />
    </svg>
  );
}

/** Marca: el lazo y la palabra. */
export function Brand() {
  return (
    <a className="brand" href="#/" aria-label="Lazo, inicio">
      <Bow size={30} />
      <span aria-hidden>Lazo</span>
    </a>
  );
}

const COLORS = ['var(--accent)', 'var(--gold)', 'var(--fir)', 'var(--rose)'];

/**
 * Confeti discreto: 18 papelitos que caen desde el elemento y se desvanecen en menos de un segundo.
 * No se monta con prefers-reduced-motion.
 */
export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!fire || !host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bits: HTMLElement[] = [];
    for (let i = 0; i < 18; i++) {
      const b = document.createElement('i');
      const a = (Math.PI * (i / 17)) - Math.PI; // abanico hacia arriba
      const d = 46 + Math.random() * 46;
      b.style.setProperty('--x', `${Math.cos(a) * d}px`);
      b.style.setProperty('--y', `${Math.sin(a) * d}px`);
      b.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
      b.style.background = COLORS[i % COLORS.length]!;
      b.style.animationDelay = `${Math.random() * 60}ms`;
      host.appendChild(b);
      bits.push(b);
    }
    const t = setTimeout(() => bits.forEach((b) => b.remove()), 1100);
    return () => {
      clearTimeout(t);
      bits.forEach((b) => b.remove());
    };
  }, [fire]);
  return <span ref={ref} className="confetti" aria-hidden />;
}

/** Mientras carga: el lazo respira. */
export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <p className="loading" role="status">
      <Bow size={44} />
      {text}
    </p>
  );
}
