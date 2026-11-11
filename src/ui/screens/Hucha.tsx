import { useState } from 'react';
import type { HuchaData } from '../../api/types';
import { collectTable, due, forecast, generalProgress, myShares, type HuchaCtx } from '../../core/hucha';
import { formatMoney, parseAmount } from '../../core/money';
import type { Id } from '../../core/types';
import { BudgetBar } from '../BudgetBar';
import { Button, ButtonGroup } from '../Button';
import { useApi } from '../ctx';
import { Avatar, errorText, Sheet, useLoad, useToast, VisibilityNote } from '../kit';

const m = (c: number) => formatMoney(c, 'EUR', true);

/**
 * La hucha común (spec plazas-hucha §10.9): «cuánto me falta y a quién se lo doy», en frases.
 * Todo se calcula aquí con las filas que el servidor deja ver: nada de lo que se gasta en ti.
 */
export function HuchaScreen({ groupId }: { groupId: string }) {
  const api = useApi();
  const me = api.me();
  const { data, error, reload } = useLoad(() => api.hucha(groupId), [api, groupId, me?.id]);
  const [paying, setPaying] = useState<{ from: Id; to: Id; sub: boolean; amount: number; title: string } | null>(null);
  const [roles, setRoles] = useState(false);
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data || !me) return <p className="meta">Cargando…</p>;

  const userOf = (listId?: Id) => data.lists.find((l) => l.id === listId)?.user;
  const T = userOf(data.group.treasurer);
  const T2 = userOf(data.group.deputy);
  const name = (id?: Id) => (id === me.id ? 'tú' : (data.members.find((x) => x.id === id)?.name ?? 'Alguien'));
  const isAdmin = data.members.some((x) => x.id === me.id && x.role === 'admin');
  const ctx: HuchaCtx = { me: me.id, members: data.members.map((x) => x.id), lists: data.lists, items: data.items, claims: data.claims, payments: data.payments, treasurer: T, deputy: T2, treasurerList: data.group.treasurer };
  const d = due(me.id, ctx);
  const shares = myShares(ctx);
  const advanced = shares.reduce((s, x) => s + x.advanced, 0);
  const handed = data.payments.filter((p) => p.from === me.id).reduce((s, p) => s + p.amountCents, 0);
  const future = forecast(ctx);
  const table = collectTable(ctx);
  const treasurerName = data.lists.find((l) => l.id === data.group.treasurer)?.name;

  if (!T || !T2)
    return (
      <div className="stack-lg" style={{ maxWidth: 744 }}>
        <div className="empty">
          <h2>Falta elegir quién lleva la hucha</h2>
          <p>{isAdmin ? 'Elige a una persona para llevar el bote y a otra para las cuentas de sus regalos.' : 'Quien organiza el grupo tiene que elegirlo.'}</p>
          {isAdmin && <Button variant="primary" onClick={() => setRoles(true)}>Elegir</Button>}
        </div>
        {roles && <RolesSheet data={data} onClose={() => setRoles(false)} onDone={() => { setRoles(false); reload(); }} />}
      </div>
    );

  return (
    <div className="stack-lg" style={{ maxWidth: 744 }}>
      <section className="stack" aria-label="Tu saldo">
        <p className="meta">{me.id === T ? 'La llevas tú' : `La lleva ${name(T)}`}</p>
        {d.general > 0 ? (
          <>
            <p style={{ fontWeight: 700 }}>Te falta poner</p>
            <p className="big-money">{m(d.general)}</p>
            {(() => {
              const g = generalProgress(ctx);
              return <BudgetBar p={{ target: g.target, committed: g.put, left: g.target - g.put, over: false, percent: g.target > 0 ? Math.round((g.put * 100) / g.target) : 0 }} label="Lo que has puesto" leftWord="Faltan" />;
            })()}
            <Button variant="primary" wide onClick={() => setPaying({ from: me.id, to: T, sub: false, amount: d.general, title: `Ya se lo di a ${name(T)}` })}>Ya se lo di a {name(T)}</Button>
          </>
        ) : d.general < 0 ? (
          <>
            <p style={{ fontWeight: 700 }}>{name(T)} te tiene que devolver</p>
            <p className="big-money">{m(-d.general)}</p>
            <Button variant="secondary" wide onClick={() => setPaying({ from: T, to: me.id, sub: false, amount: -d.general, title: 'Ya me lo dio' })}>Ya me lo dio</Button>
          </>
        ) : (
          <p className="h-section">{me.id === T ? 'Llevas la hucha' : 'Estás al día'}</p>
        )}
        {d.aparte > 0 && (
          <>
            <p>Y {m(d.aparte)} a {name(T2)}, por los regalos de {treasurerName}.</p>
            <Button variant="secondary" wide onClick={() => setPaying({ from: me.id, to: T2, sub: true, amount: d.aparte, title: `Ya se lo di a ${name(T2)}` })}>Ya se lo di a {name(T2)}</Button>
          </>
        )}
        {d.aparte < 0 && <p>{name(T2)} te tiene que devolver {m(-d.aparte)} por los regalos de {treasurerName}.</p>}
        <VisibilityNote>Aquí no sale lo que se gasta en ti</VisibilityNote>
      </section>

      <section className="stack" aria-labelledby="h-parte">
        <h2 id="h-parte" className="h-section">Tu parte, persona a persona</h2>
        {shares.length === 0 ? (
          <p className="meta">Aún no se ha comprado nada con la hucha.</p>
        ) : (
          <ul className="rows">
            {shares.map((s) => (
              <li key={s.list.id}>
                <Avatar user={{ name: s.list.name, color: data.members.find((x) => x.id === s.list.user)?.color ?? 'canela' }} size="sm" />
                <span className="grow">
                  {s.list.name}
                  <br />
                  <span className="meta">
                    {m(s.spent)} entre {s.count}
                    {s.list.id === data.group.treasurer && me.id !== T2 && ` · lo de ${s.list.name} se lo das a ${name(T2)}`}
                    {s.advanced > 0 && ` · adelantaste ${m(s.advanced)}`}
                  </span>
                </span>
                <span className="money">{m(s.mine)}</span>
              </li>
            ))}
          </ul>
        )}
        {future > 0 && <p className="meta">Si se compra todo lo apuntado, tu parte subirá {m(future)} más.</p>}
      </section>

      {(advanced > 0 || handed > 0) && (
        <section className="stack" aria-labelledby="h-puesto">
          <h2 id="h-puesto" className="h-section">Lo que has puesto</h2>
          <ul className="rows">
            {advanced > 0 && (
              <li>
                <span className="grow">Compras que adelantaste</span>
                <span className="money">{m(advanced)}</span>
              </li>
            )}
            {data.payments.map((p) => (
              <li key={p.id}>
                <span className="grow">{p.from === me.id ? `Le diste a ${name(p.to)}` : `${name(p.from)} te dio`}</span>
                <span className="money">{m(p.amountCents)}</span>
                <Button variant="link" size="sm" onClick={async () => { await api.removePayment(p.id); reload(); }}>Quitar</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {table.length > 0 && (
        <section className="stack" aria-labelledby="h-cobro">
          <h2 id="h-cobro" className="h-section">{me.id === T ? 'Quién te ha dado ya' : `Regalos de ${treasurerName} (los llevas tú)`}</h2>
          <p className="meta">{me.id === T ? `Sin contar tus regalos: esos los lleva ${name(T2)}.` : `${treasurerName} no ve nada de esto.`}</p>
          <ul className="rows">
            {table.map((r) => (
              <li key={r.who}>
                <Avatar user={{ name: name(r.who), color: data.members.find((x) => x.id === r.who)?.color ?? 'canela' }} size="sm" />
                <span className="grow">
                  {name(r.who)}
                  <br />
                  <span className="meta">{r.due > 0 ? `Le falta ${m(r.due)}` : r.due < 0 ? `Hay que devolverle ${m(-r.due)}` : 'Al día'}</span>
                </span>
                {r.due > 0 && <Button variant="secondary" size="sm" onClick={() => setPaying({ from: r.who, to: me.id, sub: me.id !== T, amount: r.due, title: `${name(r.who)} me lo dio` })}>Me lo dio</Button>}
                {r.due < 0 && <Button variant="secondary" size="sm" onClick={() => setPaying({ from: me.id, to: r.who, sub: me.id !== T, amount: -r.due, title: `Se lo di a ${name(r.who)}` })}>Se lo di</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="meta">Lazo no mueve dinero: solo lo apunta.</p>
      {paying && <PaySheet groupId={groupId} p={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); reload(); }} />}
    </div>
  );
}

function PaySheet({ groupId, p, onClose, onDone }: { groupId: Id; p: { from: Id; to: Id; sub: boolean; amount: number; title: string }; onClose: () => void; onDone: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [v, setV] = useState((p.amount / 100).toFixed(2).replace('.', ','));
  const [err, setErr] = useState('');
  return (
    <Sheet
      title={p.title}
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button
            variant="primary"
            data-autofocus
            onClick={async () => {
              const c = parseAmount(v);
              if (!c) return setErr('Escribe una cantidad, por ejemplo 20.');
              try {
                await api.addPayment(groupId, { from: p.from, to: p.to, amountCents: c, sub: p.sub });
                toast('Apuntado. Solo lo veis vosotros dos.');
                onDone();
              } catch (e) {
                setErr(errorText(e));
              }
            }}
          >
            Apuntar
          </Button>
        </ButtonGroup>
      }
    >
      <label className="field">
        <span>¿Cuánto?</span>
        <input className="input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}

function RolesSheet({ data, onClose, onDone }: { data: HuchaData; onClose: () => void; onDone: () => void }) {
  const api = useApi();
  const occupied = data.lists.filter((l) => l.kind !== 'child' && l.user);
  const [t, setT] = useState('');
  const [d, setD] = useState('');
  const [err, setErr] = useState('');
  return (
    <Sheet
      title="¿Quién lleva la hucha?"
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button
            variant="primary"
            disabled={!t || !d || t === d}
            onClick={async () => {
              try {
                await api.setHuchaRoles(data.group.id, t, d);
                onDone();
              } catch (e) {
                setErr(errorText(e));
              }
            }}
          >
            Guardar
          </Button>
        </ButtonGroup>
      }
    >
      <label className="field">
        <span>Lleva la hucha</span>
        <select className="select" value={t} onChange={(e) => setT(e.target.value)}>
          <option value="">Elige…</option>
          {occupied.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Lleva las cuentas de sus regalos</span>
        <select className="select" value={d} onChange={(e) => setD(e.target.value)}>
          <option value="">Elige…</option>
          {occupied.filter((l) => l.id !== t).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <small>Quien lleva la hucha no puede ver lo que se gasta en él. Esa parte la lleva otra persona. No se puede cambiar después.</small>
      </label>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
