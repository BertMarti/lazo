import { CaretLeft, Gear, PiggyBank, ShoppingBag, Shuffle, UsersThree, type Icon } from '@phosphor-icons/react';
import { useCallback, useRef, useState } from 'react';
import { DemoApi } from './api/demo';
import type { Api } from './api/types';
import { Avisos } from './ui/Avisos';
import { IconButton } from './ui/Button';
import { ApiCtx, go, lastGroup, useRoute } from './ui/ctx';
import { Brand } from './ui/Bow';
import { Avatar, daysUntil, ToastProvider } from './ui/kit';
import { DrawScreen } from './ui/screens/Draw';
import { GroupScreen } from './ui/screens/Group';
import { Home } from './ui/screens/Home';
import { Join } from './ui/screens/Join';
import { ListScreen } from './ui/screens/List';
import { PrintScreen, SharedScreen } from './ui/screens/Printable';
import { Purchases } from './ui/screens/Purchases';
import { Settings } from './ui/screens/Settings';
import { HuchaScreen } from './ui/screens/Hucha';
import { ReceivedScreen } from './ui/screens/Received';
import type { Title } from './ui/title';

export function App({ api }: { api: Api }) {
  const route = useRoute();
  const [, force] = useState(0);
  // El título lo pone cada pantalla al cargar; se guarda con su ruta para no enseñar el de la anterior.
  const routeKey = route.join('/');
  const keyRef = useRef(routeKey);
  keyRef.current = routeKey;
  const [title, setTitle] = useState<Title & { key?: string }>({ name: '' });
  const onTitle = useCallback((t: Title) => setTitle({ ...t, key: keyRef.current }), []);
  const [section, id, extra] = route;
  const group = section === 'g' || section === 'sorteo' || section === 'hucha' ? id : lastGroup.get();

  let screen;
  let t: Title = title.key === routeKey ? title : { name: '' };
  if (section === 'g' && id) screen = <GroupScreen id={id} onTitle={onTitle} />;
  else if (section === 'l' && id) screen = <ListScreen id={id} adding={extra === 'nuevo'} onTitle={onTitle} />;
  else if (section === 'compras') {
    screen = <Purchases />;
    t = { name: 'Mis compras', sub: 'Solo lo ves tú' };
  } else if (section === 'sorteo' && id) {
    screen = <DrawScreen groupId={id} />;
    t = { name: 'Amigo invisible', back: `/g/${id}`, backLabel: 'Al grupo' };
  } else if (section === 'hucha' && id) {
    screen = <HuchaScreen groupId={id} />;
    t = { name: 'Hucha', back: `/g/${id}`, backLabel: 'Al grupo' };
  } else if (section === 'recibido' && id) {
    screen = <ReceivedScreen groupId={id} />;
    t = { name: 'Lo que te regalaron', back: `/g/${id}`, backLabel: 'Al grupo' };
  } else if (section === 'ajustes') {
    screen = <Settings />;
    t = { name: 'Ajustes', back: '/', backLabel: 'Tus grupos' };
  } else if (section === 'unirse' && id) {
    screen = <Join token={id} onJoined={() => force((n) => n + 1)} />;
    t = { name: '' };
  } else if (section === 'imprimir' && id) {
    screen = <PrintScreen id={id} />;
  } else if (section === 'ver' && id) {
    screen = <SharedScreen token={id} />;
  } else {
    screen = <Home />;
    t = { name: 'Tus grupos', sub: 'Listas de regalos en familia' };
  }
  const d = daysUntil(t.date);
  // Fuera del grupo (entrar o ver una lista compartida): sin navegación ni avisos.
  const bare = section === 'unirse' || (section === 'ver' && !!id);

  return (
    <ApiCtx.Provider value={api}>
      <ToastProvider>
        <div className="app">
          {api instanceof DemoApi && section !== 'ver' && <DemoBar api={api} onChange={() => force((n) => n + 1)} />}
          <header className="masthead">
            <div className="masthead-in">
              <Brand />
              {!bare && (
                <nav className="tabs-top" aria-label="Principal">
                  <Tabs section={section} group={group} />
                </nav>
              )}
              <div className="masthead-end">
                {!bare && <Avisos key={api.me()?.id} refresh={routeKey} />}
                {section !== 'ajustes' && !bare && <IconButton icon={Gear} label="Ajustes" onClick={() => go('/ajustes')} />}
              </div>
            </div>
          </header>
          <main id="contenido">
            {t.name && (
              <div className="page-head">
                {t.back && (
                  <a className="back" href={`#${t.back}`}>
                    <CaretLeft size={18} weight="bold" aria-hidden /> {t.backLabel ?? 'Volver'}
                  </a>
                )}
                <div className="page-head-row">
                  {t.avatar && <Avatar user={t.avatar} size="xl" />}
                  <div className="grow">
                    <h1>{t.name}</h1>
                    {t.sub && <p className="sub">{t.sub}</p>}
                    {d !== null && d >= 0 && (
                      <p className="when">
                        {fecha(t.date!)} · <span className="nw">{d > 1 ? (<>faltan <b>{d}</b> días</>) : d === 1 ? 'es mañana' : 'es hoy'}</span>
                      </p>
                    )}
                  </div>
                  {t.actions && <div className="page-head-actions">{t.actions}</div>}
                </div>
              </div>
            )}
            {screen}
          </main>
          <nav className="tabbar" aria-label="Principal" hidden={bare}>
            <Tabs section={section} group={group} />
          </nav>
        </div>
      </ToastProvider>
    </ApiCtx.Provider>
  );
}

const fecha = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

function Tabs({ section, group }: { section?: string; group?: string | null }) {
  return (
    <>
      <Tab href={group ? `#/g/${group}` : '#/'} current={section === 'g' || section === 'l' || !section} icon={UsersThree} label="Grupo" />
      <Tab href={group ? `#/hucha/${group}` : '#/'} current={section === 'hucha'} icon={PiggyBank} label="Hucha" />
      <Tab href="#/compras" current={section === 'compras'} icon={ShoppingBag} label="Mis compras" />
      <Tab href={group ? `#/sorteo/${group}` : '#/'} current={section === 'sorteo'} icon={Shuffle} label="Sorteo" />
    </>
  );
}

function Tab({ href, current, icon: I, label }: { href: string; current: boolean; icon: Icon; label: string }) {
  return (
    <a className="tab" href={href} aria-current={current ? 'page' : undefined}>
      <I size={24} weight={current ? 'fill' : 'regular'} aria-hidden />
      <span>{label}</span>
    </a>
  );
}

function DemoBar({ api, onChange }: { api: DemoApi; onChange: () => void }) {
  return (
    <div className="demo-bar" role="region" aria-label="Demo">
      <span>
        <b>Demo</b>
        <span className="hide-sm"> · datos ficticios</span>
      </span>
      <a href={`#/unirse/${api.generalInviteToken()}`}>Probar a entrar</a>
      <a className="hide-sm" href="https://github.com/BertMarti/lazo/blob/main/public/demo/fotos/CREDITOS.md" target="_blank" rel="noopener noreferrer">
        Créditos de las fotos
      </a>
      <label className="row" style={{ gap: 'var(--s-2)' }}>
        <span className="hide-sm">Ver como</span>
        <select
          aria-label="Ver como"
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
