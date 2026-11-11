import { ArrowLeft, Gear, Gift, ShoppingBag, Shuffle, SquaresFour } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { DemoApi } from './api/demo';
import type { Api } from './api/types';
import { IconButton } from './ui/Button';
import { ApiCtx, go, lastGroup, useRoute } from './ui/ctx';
import { Avatar, daysUntil, ToastProvider } from './ui/kit';
import { DrawScreen } from './ui/screens/Draw';
import { GroupScreen } from './ui/screens/Group';
import { Home } from './ui/screens/Home';
import { Join } from './ui/screens/Join';
import { ListScreen } from './ui/screens/List';
import { Purchases } from './ui/screens/Purchases';
import { Settings } from './ui/screens/Settings';
import type { Title } from './ui/title';

export function App({ api }: { api: Api }) {
  const route = useRoute();
  const [, force] = useState(0);
  const [title, setTitle] = useState<Title>({ name: 'Lazo' });
  const onTitle = useCallback((t: Title) => setTitle(t), []);
  const [section, id, extra] = route;
  const group = section === 'g' || section === 'sorteo' ? id : lastGroup.get();

  let screen;
  let t: Title = title;
  if (section === 'g' && id) screen = <GroupScreen id={id} onTitle={onTitle} />;
  else if (section === 'l' && id) screen = <ListScreen id={id} adding={extra === 'nuevo'} onTitle={onTitle} />;
  else if (section === 'compras') {
    screen = <Purchases />;
    t = { name: 'Mis compras', sub: 'Solo lo ves tú' };
  } else if (section === 'sorteo' && id) {
    screen = <DrawScreen groupId={id} />;
    t = { name: 'Amigo invisible', back: `/g/${id}` };
  } else if (section === 'ajustes') {
    screen = <Settings />;
    t = { name: 'Ajustes', back: '/' };
  } else if (section === 'unirse' && id) {
    screen = <Join token={id} />;
    t = { name: 'Bienvenida' };
  } else {
    screen = <Home />;
    t = { name: 'Tus grupos', sub: 'Lazo · listas de regalos en familia', actions: <IconButton icon={Gear} label="Ajustes" onBox onClick={() => go('/ajustes')} /> };
  }
  const d = daysUntil(t.date);

  return (
    <ApiCtx.Provider value={api}>
      <ToastProvider>
        <div className="app">
          {api instanceof DemoApi && <DemoBar api={api} onChange={() => force((n) => n + 1)} />}
          <header className="topbar">
            <div className="topbar-inner">
              <div className="topbar-title">
                {t.back && <IconButton icon={ArrowLeft} label="Atrás" onBox onClick={() => go(t.back!)} />}
                {t.avatar && <Avatar user={t.avatar} size="md" />}
                <div style={{ minWidth: 0 }}>
                  {t.sub && <p className="sub">{t.sub}</p>}
                  <h1>{t.name}</h1>
                </div>
              </div>
              <div className="topbar-actions">
                {t.actions}
                {d !== null && d >= 0 && (
                  <p className="countdown" aria-label={`Faltan ${d} días`}>
                    <b>{d}</b>
                    <span>{d === 1 ? 'día' : 'días'}</span>
                  </p>
                )}
              </div>
            </div>
          </header>
          <main id="contenido">{screen}</main>
          <nav className="tabbar" aria-label="Principal">
            <a className="brand" href="#/">
              <Gift size={26} weight="duotone" aria-hidden /> Lazo
            </a>
            <Tab href={group ? `#/g/${group}` : '#/'} current={section === 'g' || section === 'l'} icon={SquaresFour} label="Grupo" />
            <Tab href="#/compras" current={section === 'compras'} icon={ShoppingBag} label="Mis compras" />
            <Tab href={group ? `#/sorteo/${group}` : '#/'} current={section === 'sorteo'} icon={Shuffle} label="Amigo invisible" />
          </nav>
        </div>
      </ToastProvider>
    </ApiCtx.Provider>
  );
}

function Tab({ href, current, icon: I, label }: { href: string; current: boolean; icon: typeof Gift; label: string }) {
  return (
    <a className="tab" href={href} aria-current={current ? 'page' : undefined}>
      <I size={24} weight={current ? 'fill' : 'regular'} aria-hidden />
      {label}
    </a>
  );
}

function DemoBar({ api, onChange }: { api: DemoApi; onChange: () => void }) {
  return (
    <div className="demo-bar" role="region" aria-label="Demo">
      <span>
        <b>Demo</b> · datos ficticios
      </span>
      <label className="row" style={{ gap: 'var(--s-2)' }}>
        <span>Ver como</span>
        <select
          value={api.me().id}
          onChange={(e) => {
            api.setViewer(e.target.value);
            onChange();
          }}
        >
          {api.people().map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
