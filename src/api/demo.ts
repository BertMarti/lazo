import { amazonInfo } from '../core/amazon';
import type { ItemDraft } from '../core/columns';
import { cryptoRand, drawPairs } from '../core/draw';
import type { PageMeta } from '../core/meta';
import { initial, joinCode, normName, parsePlazas } from '../core/plazas';
import type { Cents, Claim, GiftList, Group, Id, Item, JoinRequest, Received, User } from '../core/types';
import { LIMITS } from '../core/types';
import { canEditList, canSeeStatus } from '../core/visibility';
import { DEMO_GENERAL_TOKEN, DEMO_UNFURL, seed, type DemoData } from './seed';
import {
  ApiError,
  BAD_INVITE,
  type Api,
  type DrawInfo,
  type GiftAction,
  type GroupDetail,
  type HuchaData,
  type InviteInfo,
  type ItemInput,
  type JoinResult,
  type ListDetail,
  type NewGroup,
  type Purchase,
} from './types';

const KEY = 'lazo-demo-v4';
const COLORS = ['limon', 'canela', 'menta', 'fresa', 'violeta', 'almendra', 'cielo'];

/**
 * Backend simulado de la demo pública: todo en memoria y en localStorage del navegador.
 * Aplica las MISMAS reglas que el servidor (spec plazas-hucha): sorpresa, plazas, modos, hucha y entrega.
 */
export class DemoApi implements Api {
  readonly demo = true;
  private db: DemoData;
  private viewer: Id;

  constructor(private storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.db = this.load() ?? seed();
    this.viewer = this.read('viewer') ?? 'alberto';
    if (!this.db.users.some((u) => u.id === this.viewer)) this.viewer = 'alberto';
  }

  /** «Ver como…»: solo existe en la demo. */
  setViewer(id: Id) {
    this.viewer = id;
    this.write('viewer', id);
  }
  people(): User[] {
    return this.db.users;
  }
  reset() {
    this.db = seed();
    this.save();
  }
  generalInviteToken() {
    return DEMO_GENERAL_TOKEN;
  }

  me(): User {
    return this.user(this.viewer);
  }

  async groups() {
    const mine = new Set(this.db.memberships.filter((m) => m.user === this.viewer).map((m) => m.group));
    return this.db.groups.filter((g) => mine.has(g.id));
  }

  async groupDetail(groupId: Id): Promise<GroupDetail> {
    const group = this.member(groupId);
    const members = this.db.memberships.filter((m) => m.group === groupId).map((m) => ({ ...this.user(m.user), role: m.role }));
    return { group, members, lists: this.db.lists.filter((l) => l.group === groupId) };
  }

  async listDetail(listId: Id): Promise<ListDetail> {
    const list = this.list(listId);
    const group = this.member(list.group);
    const canSee = canSeeStatus(this.viewer, list);
    // En tu propia plaza no existen las sorpresas ni lo que quitaste: ni siquiera cuentan.
    const items = this.db.items.filter((i) => i.list === listId && (canSee || (!i.secret && !i.removed)));
    const ids = new Set(items.map((i) => i.id));
    return {
      list,
      group,
      items,
      claims: canSee ? this.db.claims.filter((c) => ids.has(c.item)) : [],
      contributions: canSee ? this.db.contributions.filter((c) => ids.has(c.item)) : [],
      budget: canSee ? this.db.budgets.find((b) => b.list === listId) : undefined,
      canSee,
      canEdit: canEditList(this.viewer, list),
    };
  }

  async createGroup(input: NewGroup) {
    const { plazas, ...rest } = input;
    const group: Group = { ...rest, id: uid(), owner: this.viewer, revealedAt: 0 };
    this.db.groups.push(group);
    this.db.memberships.push({ id: uid(), group: group.id, user: this.viewer, role: 'admin' });
    this.db.lists.push({ id: uid(), group: group.id, name: this.me().name, kind: 'person', user: this.viewer, managers: [], via: 'creator', claimedAt: Date.now() });
    for (const name of parsePlazas(plazas ?? [], this.me().name)) this.db.lists.push({ id: uid(), group: group.id, name, kind: 'person', managers: [] });
    this.save();
    return group;
  }

  async updateGroup(groupId: Id, patch: Partial<Pick<Group, 'name' | 'date' | 'buyMode' | 'allowNewNames'>>) {
    const g = this.admin(groupId);
    // Cambiar de modo nunca falla ni mira las listas (una validación así delataría lo de quien la pide).
    Object.assign(g, patch);
    this.save();
  }

  async addChildList(groupId: Id, name: string, birthYear?: number) {
    this.admin(groupId);
    const list: GiftList = { id: uid(), group: groupId, name: name.trim(), kind: 'child', managers: [this.viewer], birthYear };
    this.db.lists.push(list);
    this.save();
    return list;
  }

  async addPlaza(groupId: Id, name: string) {
    this.admin(groupId);
    const clean = parsePlazas([name])[0];
    if (!clean) throw new ApiError('Escribe un nombre.');
    if (this.db.lists.some((l) => l.group === groupId && normName(l.name) === normName(clean))) throw new ApiError('Ya hay una plaza con ese nombre.');
    const list: GiftList = { id: uid(), group: groupId, name: clean, kind: 'person', managers: [] };
    this.db.lists.push(list);
    this.save();
    return list;
  }

  async releasePlaza(listId: Id) {
    const l = this.list(listId);
    const g = this.admin(l.group);
    if (l.kind !== 'person' || !l.user || l.user === this.viewer || l.user === g.owner) throw new ApiError('No puedes liberar esa plaza.');
    this.db.memberships = this.db.memberships.filter((m) => !(m.group === g.id && m.user === l.user));
    l.prevUser = l.user;
    l.user = undefined;
    l.claimedAt = 0;
    l.via = undefined;
    l.approvedBy = undefined;
    this.db.requests = this.db.requests.filter((r) => !(r.group === g.id && r.user === l.prevUser));
    this.db.invites = this.db.invites.filter((i) => i.list !== l.id);
    this.save();
  }

  async saveItem(listId: Id, input: ItemInput, id?: Id) {
    if (id) {
      const item = this.db.items.find((i) => i.id === id && i.list === listId);
      if (!item) throw new ApiError('Ese regalo ya no existe.');
      const list = this.list(listId);
      // Igual que el servidor: una sorpresa o un retirado de tu plaza es como si no existiera.
      if ((item.secret || item.removed) && list.user === this.viewer) throw new ApiError('Ese regalo ya no existe.');
      const mayEdit = item.secret ? item.createdBy === this.viewer && list.user !== this.viewer : !item.removed && canEditList(this.viewer, list);
      if (!mayEdit) throw new ApiError('Solo quien lleva esta lista puede cambiarla.');
      Object.assign(item, input);
      this.save();
      return item;
    }
    const list = this.editable(listId);
    const item: Item = { ...clip(input), id: uid(), list: list.id, currency: this.member(list.group).currency, createdBy: this.viewer };
    this.db.items.push(item);
    this.save();
    return item;
  }

  async addSurprise(listId: Id, input: ItemInput) {
    const list = this.list(listId);
    this.member(list.group);
    if (list.kind === 'child' || list.user === this.viewer) throw new ApiError('Las sorpresas se apuntan en la lista de otra persona.');
    const item: Item = { ...clip(input), id: uid(), list: list.id, currency: this.member(list.group).currency, createdBy: this.viewer, secret: true };
    this.db.items.push(item);
    this.save();
    return item;
  }

  async deleteItem(id: Id) {
    const item = this.db.items.find((i) => i.id === id);
    if (!item) throw new ApiError('Ese regalo ya no existe.');
    const list = this.list(item.list);
    if (item.removed && list.user === this.viewer) throw new ApiError('Ese regalo ya no existe.');
    const touched = this.db.claims.some((c) => c.item === id) || this.db.contributions.some((c) => c.item === id);
    if (item.secret) {
      if (item.createdBy !== this.viewer || list.user === this.viewer) throw new ApiError('Ese regalo ya no existe.');
      if (this.db.claims.some((c) => c.item === id && c.status === 'bought')) throw new ApiError('Ya está comprado: deshaz la compra antes.');
    } else if (!canEditList(this.viewer, list)) throw new ApiError('Solo quien lleva esta lista puede cambiarla.');
    // Quitar un regalo propio responde SIEMPRE igual: si tenía reservas se oculta, no se borra (D6).
    if (!item.secret && touched) item.removed = true;
    else {
      this.db.items = this.db.items.filter((i) => i.id !== id);
      this.db.claims = this.db.claims.filter((c) => c.item !== id);
      this.db.contributions = this.db.contributions.filter((c) => c.item !== id);
    }
    this.save();
  }

  async setBudget(listId: Id, amountCents: Cents | null) {
    const list = this.list(listId);
    if (!canSeeStatus(this.viewer, list)) throw new ApiError('Tu propio presupuesto no lo puedes ver ni cambiar.');
    this.db.budgets = this.db.budgets.filter((b) => b.list !== listId);
    if (amountCents !== null) this.db.budgets.push({ id: uid(), list: listId, amountCents });
    this.save();
  }

  async importItems(listId: Id, drafts: ItemDraft[]) {
    for (const d of drafts) await this.saveItem(listId, d);
    return drafts.length;
  }

  /** Todas las transiciones de un regalo, con las validaciones de la spec §3.2. */
  async gift(a: GiftAction) {
    const claimById = (id: Id) => {
      const c = this.db.claims.find((x) => x.id === id);
      if (!c) throw new ApiError('Esa reserva ya no existe.');
      return c;
    };
    const itemId = 'item' in a && a.item ? a.item : claimById((a as { claim: Id }).claim).item;
    const { item, list, group } = this.giftTarget(itemId);
    const taken = () => this.db.claims.filter((c) => c.item === item.id).reduce((s, c) => s + c.units, 0);
    const hasPot = () => this.db.contributions.some((c) => c.item === item.id && c.amountCents > 0);
    const allowed = (kind: 'self' | 'pot') => (kind === 'self' ? group.buyMode !== 'hucha' : group.buyMode !== 'individual');
    const payers = this.db.memberships.filter((m) => m.group === group.id && m.user !== list.user).map((m) => m.user);
    const checkPay = (paidCents: number, paidBy: Id) => {
      if (!Number.isInteger(paidCents) || paidCents < 0 || paidCents > LIMITS.amount) throw new ApiError('El precio no es válido.');
      if (!payers.includes(paidBy)) throw new ApiError('Esa persona no puede pagar este regalo.');
    };
    const now = Date.now();

    switch (a.action) {
      case 'reserve': {
        if (!allowed(a.kind)) throw new ApiError(a.kind === 'self' ? 'En este grupo todo va a la hucha.' : 'En este grupo cada uno compra lo suyo.');
        if (item.removed) throw new ApiError(`${list.name} lo ha quitado de su lista.`);
        if (hasPot()) throw new ApiError('Este regalo va a medias: pon tu parte.');
        if (taken() >= item.quantity) throw new ApiError('Alguien se te ha adelantado: ya está cogido.');
        this.db.claims.push({ id: uid(), item: item.id, user: this.viewer, kind: a.kind, status: 'reserved', units: 1 });
        break;
      }
      case 'release': {
        const c = claimById(a.claim);
        if (c.status !== 'reserved' || ((c.kind ?? 'self') === 'self' && c.user !== this.viewer)) throw new ApiError('Esa reserva no es tuya.');
        this.db.claims = this.db.claims.filter((x) => x.id !== c.id);
        break;
      }
      case 'move': {
        const c = claimById(a.claim);
        if (c.status !== 'reserved' || !allowed(a.kind)) throw new ApiError('No se puede cambiar ahora.');
        if ((c.kind ?? 'self') === 'self' && c.user !== this.viewer) throw new ApiError('Esa reserva no es tuya.');
        c.kind = a.kind;
        if (a.kind === 'self') c.user = this.viewer;
        break;
      }
      case 'buy': {
        checkPay(a.paidCents, a.paidBy);
        if (a.claim) {
          const c = claimById(a.claim);
          if (c.status !== 'reserved' || ((c.kind ?? 'self') === 'self' && c.user !== this.viewer)) throw new ApiError('Esa reserva no es tuya.');
          Object.assign(c, { status: 'bought', paidCents: a.paidCents, paidBy: a.paidBy, boughtAt: now });
        } else {
          const kind = group.buyMode === 'hucha' ? 'pot' : group.buyMode === 'individual' ? 'self' : (a.kind ?? 'self');
          if (taken() >= item.quantity) throw new ApiError('Alguien se te ha adelantado: ya está cogido.');
          if (hasPot()) {
            if (kind !== 'self' || !this.db.contributions.some((c) => c.item === item.id && c.user === this.viewer)) throw new ApiError('Lo compra alguien que pone dinero.');
          }
          this.db.claims.push({ id: uid(), item: item.id, user: this.viewer, kind, status: 'bought', units: 1, paidCents: a.paidCents, paidBy: a.paidBy, boughtAt: now });
        }
        break;
      }
      case 'unbuy': {
        const c = claimById(a.claim);
        const keeper = this.keeperOf(group, list);
        const isAdmin = this.isAdmin(group.id);
        if (c.status !== 'bought' || ![c.user, c.paidBy, keeper].includes(this.viewer) && !isAdmin) throw new ApiError('No puedes deshacer esta compra.');
        Object.assign(c, { status: 'reserved', paidCents: undefined, paidBy: undefined, boughtAt: undefined });
        break;
      }
    }
    this.save();
  }

  async contribute(itemId: Id, amountCents: Cents) {
    const { group } = this.giftTarget(itemId);
    if (group.buyMode === 'hucha') throw new ApiError('En este grupo todo va a la hucha.');
    if (this.db.claims.some((c) => c.item === itemId)) throw new ApiError('Este regalo ya está cogido.');
    const existing = this.db.contributions.find((c) => c.item === itemId && c.user === this.viewer);
    if (existing) existing.amountCents = amountCents;
    else this.db.contributions.push({ id: uid(), item: itemId, user: this.viewer, amountCents, paid: false });
    this.save();
  }

  async setContributionPaid(id: Id, paid: boolean) {
    const c = this.db.contributions.find((x) => x.id === id);
    if (!c) throw new ApiError('Esa aportación ya no existe.');
    this.giftTarget(c.item);
    c.paid = paid;
    this.save();
  }

  async removeContribution(id: Id) {
    const c = this.db.contributions.find((x) => x.id === id && x.user === this.viewer);
    if (!c) throw new ApiError('Solo puedes quitar tu propia aportación.');
    this.db.contributions = this.db.contributions.filter((x) => x.id !== id);
    this.save();
  }

  async createInvite(groupId: Id, listId?: Id) {
    this.admin(groupId);
    let token = DEMO_GENERAL_TOKEN;
    if (listId) {
      const l = this.list(listId);
      if (l.kind !== 'person' || l.user || l.group !== groupId) throw new ApiError('Esa plaza ya está ocupada.');
      this.db.invites = this.db.invites.filter((i) => i.list !== listId);
      token = `demo${uid()}${uid()}`.replace(/[^A-Za-z0-9]/g, '');
      this.db.invites.push({ token, group: groupId, list: listId, uses: 0, maxUses: 1, createdBy: this.viewer });
      this.save();
    }
    const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();
    return { url: `${location.origin}${location.pathname}#/unirse/${token}`, expires };
  }

  async inviteInfo(token: string): Promise<InviteInfo> {
    const inv = this.invite(token);
    const g = this.db.groups.find((x) => x.id === inv.group)!;
    const personal = inv.list ? this.db.lists.find((l) => l.id === inv.list) : undefined;
    if (inv.list && (!personal || personal.user)) throw new ApiError(BAD_INVITE);
    const colorOf = (id?: Id) => this.db.users.find((u) => u.id === id)?.color ?? '';
    return {
      group: { id: g.id, name: g.name, occasion: g.occasion, date: g.date },
      organizer: this.user(inv.createdBy).name,
      personal: personal ? { list: personal.id, name: personal.name, color: colorOf(personal.prevUser) } : null,
      free: inv.list ? [] : this.db.lists.filter((l) => l.group === g.id && l.kind === 'person' && !l.user).map((l) => ({ list: l.id, name: l.name, color: colorOf(l.prevUser) })),
      faces: this.db.lists
        .filter((l) => l.group === g.id && l.kind === 'person' && l.user)
        .sort((a, b) => (a.claimedAt ?? 0) - (b.claimedAt ?? 0))
        .slice(0, 12)
        .map((l) => ({ initial: initial(l.name), color: colorOf(l.user) })),
      allowNewNames: !!g.allowNewNames && !inv.list,
    };
  }

  async claimDevice(): Promise<void> {
    throw new ApiError('En la demo no hace falta: elige a quién ver arriba.');
  }

  async deviceCode() {
    return { code: 'DEMO2345', minutes: 10 };
  }

  /** En la demo, entrar crea siempre una cuenta nueva (como abrir el enlace en otro móvil) y pasa a verla. */
  async join(token: string, choice: { list?: Id; name?: string }): Promise<JoinResult> {
    const inv = this.invite(token);
    const g = this.db.groups.find((x) => x.id === inv.group)!;
    const newUser = (name: string): User => {
      const user = { id: uid(), name: name.slice(0, 40), color: COLORS[this.db.users.length % COLORS.length]! };
      this.db.users.push(user);
      return user;
    };
    if (inv.list) {
      const plaza = this.db.lists.find((l) => l.id === inv.list);
      if (!plaza || plaza.user) throw new ApiError(BAD_INVITE);
      const user = newUser(plaza.name);
      this.claimPlaza(plaza, user.id, 'personal', inv.createdBy);
      inv.uses++;
      this.db.invites = this.db.invites.filter((i) => i.uses < i.maxUses);
      this.setViewer(user.id);
      this.save();
      return { group: g.id };
    }
    let name: string;
    if (choice.list) {
      const plaza = this.db.lists.find((l) => l.id === choice.list && l.group === g.id && l.kind === 'person');
      if (!plaza || plaza.user) throw new ApiError('Esa plaza ya está ocupada.');
      name = plaza.name;
    } else {
      if (!g.allowNewNames) throw new ApiError('Elige tu nombre en la lista.');
      name = parsePlazas([choice.name ?? ''])[0] ?? '';
      if (!name) throw new ApiError('Escribe tu nombre.');
      if (this.db.lists.some((l) => l.group === g.id && normName(l.name) === normName(name))) throw new ApiError('Ya hay una plaza con ese nombre: elígela en la lista.');
    }
    if (this.db.requests.filter((r) => r.group === g.id && r.status === 'pending').length >= 20) throw new ApiError('Hay demasiadas entradas pendientes. Avisa a quien organiza.');
    const user = newUser(name);
    const req: JoinRequest = { id: uid(), group: g.id, user: user.id, list: choice.list, name, code: joinCode(), status: 'pending' };
    this.db.requests.push(req);
    inv.uses++;
    this.setViewer(user.id);
    this.save();
    return { pending: true, request: req.id, code: req.code, group: g.id };
  }

  async requestStatus(requestId: Id) {
    const r = this.db.requests.find((x) => x.id === requestId && x.user === this.viewer);
    return r ? r.status : 'rejected'; // el servidor borra las rechazadas
  }

  async joinRequests(groupId: Id) {
    this.admin(groupId);
    return this.db.requests.filter((r) => r.group === groupId && r.status === 'pending');
  }

  async decideJoin(requestId: Id, accept: boolean) {
    const r = this.db.requests.find((x) => x.id === requestId && x.status === 'pending');
    if (!r) throw new ApiError('Esa solicitud ya no existe.');
    this.admin(r.group);
    if (accept) {
      let plaza = r.list ? this.db.lists.find((l) => l.id === r.list) : undefined;
      if (r.list && (!plaza || plaza.user)) throw new ApiError('Esa plaza ya está ocupada.');
      if (!plaza) {
        if (this.db.lists.some((l) => l.group === r.group && normName(l.name) === normName(r.name))) throw new ApiError('Ya hay alguien con ese nombre: elige su plaza o cámbiale el nombre.');
        plaza = { id: uid(), group: r.group, name: r.name, kind: 'person', managers: [] };
        this.db.lists.push(plaza);
      }
      this.claimPlaza(plaza, r.user, 'approved', this.viewer);
      r.status = 'approved';
    } else this.db.requests = this.db.requests.filter((x) => x !== r);
    this.save();
  }

  async hucha(groupId: Id): Promise<HuchaData> {
    const d = await this.groupDetail(groupId);
    const mine = new Set(d.lists.filter((l) => l.user === this.viewer).map((l) => l.id));
    const items = this.db.items.filter((i) => d.lists.some((l) => l.id === i.list) && (!mine.has(i.list) || (!i.secret && !i.removed)));
    const visible = new Set(items.filter((i) => !mine.has(i.list)).map((i) => i.id));
    return {
      group: d.group,
      members: d.members,
      lists: d.lists,
      items,
      claims: this.db.claims.filter((c) => visible.has(c.item)),
      payments: this.db.payments.filter((p) => p.group === groupId && (p.from === this.viewer || p.to === this.viewer)),
    };
  }

  async setHuchaRoles(groupId: Id, treasurerList: Id, deputyList: Id) {
    const g = this.admin(groupId);
    if (g.treasurer || g.deputy) throw new ApiError('Ya están elegidos y no se pueden cambiar.');
    const t = this.list(treasurerList);
    const d = this.list(deputyList);
    if (t.id === d.id || t.group !== g.id || d.group !== g.id || !t.user || !d.user || t.kind !== 'person' || d.kind !== 'person') throw new ApiError('Elige dos personas distintas que ya estén dentro.');
    g.treasurer = t.id;
    g.deputy = d.id;
    this.save();
  }

  async addPayment(groupId: Id, p: { from: Id; to: Id; amountCents: Cents; sub: boolean }) {
    const g = this.member(groupId);
    const T = this.db.lists.find((l) => l.id === g.treasurer)?.user;
    const T2 = this.db.lists.find((l) => l.id === g.deputy)?.user;
    const members = new Set(this.db.memberships.filter((m) => m.group === groupId).map((m) => m.user));
    const ok =
      (p.from === this.viewer || p.to === this.viewer) &&
      p.from !== p.to &&
      members.has(p.from) &&
      members.has(p.to) &&
      Number.isInteger(p.amountCents) &&
      p.amountCents > 0 &&
      p.amountCents <= LIMITS.amount &&
      (p.sub ? (p.from === T2 || p.to === T2) && p.from !== T && p.to !== T : p.from === T || p.to === T);
    if (!ok) throw new ApiError('Ese pago no se puede apuntar.');
    this.db.payments.push({ id: uid(), group: groupId, ...p, at: Date.now() });
    this.save();
  }

  async removePayment(id: Id) {
    const p = this.db.payments.find((x) => x.id === id && (x.from === this.viewer || x.to === this.viewer));
    if (!p) throw new ApiError('Ese pago ya no existe.');
    this.db.payments = this.db.payments.filter((x) => x.id !== id);
    this.save();
  }

  async reveal(groupId: Id, action: 'ask' | 'confirm' | 'cancel' | 'close') {
    const g = this.member(groupId);
    const admin = this.isAdmin(groupId);
    if (action === 'ask' && admin) g.revealAskedBy = this.viewer;
    else if (action === 'confirm' && g.revealAskedBy && g.revealAskedBy !== this.viewer) {
      g.revealedAt = Date.now();
      g.revealAskedBy = undefined;
    } else if (action === 'cancel' && admin) g.revealAskedBy = undefined;
    else if (action === 'close' && admin) g.revealedAt = 0;
    else throw new ApiError('No puedes hacer esto.');
    this.save();
  }

  async received(groupId: Id): Promise<Received[]> {
    const g = this.member(groupId);
    if (!g.revealedAt) throw new ApiError('La entrega aún no está abierta.');
    const plaza = this.db.lists.find((l) => l.group === groupId && l.kind === 'person' && l.user === this.viewer);
    if (!plaza) return [];
    const items = new Map(this.db.items.filter((i) => i.list === plaza.id).map((i) => [i.id, i]));
    return this.db.claims
      .filter((c) => c.status === 'bought' && items.has(c.item) && (c.boughtAt ?? 0) <= (g.revealedAt ?? 0))
      .map((c) => {
        const it = items.get(c.item)!;
        const pots = this.db.contributions.filter((x) => x.item === it.id && x.amountCents > 0).map((x) => x.user);
        const from = c.kind === 'pot' ? [] : (pots.length ? pots : [c.user]).map((id) => ({ id, name: this.user(id).name }));
        return { title: it.title, image: it.image, url: it.url, from, fromAll: c.kind === 'pot' };
      });
  }

  async runDraw(groupId: Id, participants: Id[], exclusions: [Id, Id][], budgetCents?: Cents) {
    this.admin(groupId);
    const pairs = drawPairs(participants, exclusions, cryptoRand);
    const old = this.db.draws.filter((d) => d.group === groupId).map((d) => d.id);
    this.db.draws = this.db.draws.filter((d) => d.group !== groupId);
    this.db.assignments = this.db.assignments.filter((a) => !old.includes(a.draw));
    const draw = { id: uid(), group: groupId, budgetCents, exclusions, participants, createdBy: this.viewer };
    this.db.draws.push(draw);
    for (const [giver, receiver] of pairs) this.db.assignments.push({ draw: draw.id, giver, receiver });
    this.save();
  }

  async drawInfo(groupId: Id): Promise<DrawInfo> {
    this.member(groupId);
    const draw = this.db.draws.find((d) => d.group === groupId);
    const mine = draw && this.db.assignments.find((a) => a.draw === draw.id && a.giver === this.viewer);
    return { draw, receiver: mine ? this.user(mine.receiver) : undefined };
  }

  async unfurl(url: string): Promise<PageMeta> {
    await new Promise((r) => setTimeout(r, 450));
    const hit = DEMO_UNFURL.find((d) => d.match.test(url))!;
    return { ...hit.meta, url: amazonInfo(url)?.canonical ?? url };
  }

  async purchases(): Promise<Purchase[]> {
    const out: Purchase[] = [];
    const ctx = (itemId: Id) => {
      const item = this.db.items.find((i) => i.id === itemId)!;
      const list = this.db.lists.find((l) => l.id === item.list)!;
      return { item, list, group: this.db.groups.find((g) => g.id === list.group)! };
    };
    const visible = (itemId: Id) => canSeeStatus(this.viewer, ctx(itemId).list);
    for (const claim of this.db.claims.filter((c) => (c.user === this.viewer || c.paidBy === this.viewer) && visible(c.item))) out.push({ ...ctx(claim.item), claim });
    for (const contribution of this.db.contributions.filter((c) => c.user === this.viewer && visible(c.item))) out.push({ ...ctx(contribution.item), contribution });
    return out;
  }

  // — reglas —
  private claimPlaza(plaza: GiftList, user: Id, via: 'personal' | 'approved', by: Id) {
    plaza.user = user;
    plaza.claimedAt = Date.now();
    plaza.via = via;
    plaza.approvedBy = by;
    this.db.memberships.push({ id: uid(), group: plaza.group, user, role: 'member' });
    // La identidad es la plaza: lo que hizo la cuenta anterior pasa a la nueva.
    if (plaza.prevUser && plaza.prevUser !== user) {
      const prev = plaza.prevUser;
      const inGroup = (itemId: Id) => this.db.lists.find((l) => l.id === this.db.items.find((i) => i.id === itemId)?.list)?.group === plaza.group;
      for (const c of this.db.claims) if (inGroup(c.item)) {
        if (c.user === prev) c.user = user;
        if (c.paidBy === prev) c.paidBy = user;
      }
      for (const c of this.db.contributions) if (inGroup(c.item) && c.user === prev) c.user = user;
      for (const i of this.db.items) if (inGroup(i.id) && i.createdBy === prev) i.createdBy = user;
      for (const p of this.db.payments) if (p.group === plaza.group) {
        if (p.from === prev) p.from = user;
        if (p.to === prev) p.to = user;
      }
    }
    plaza.prevUser = undefined;
  }
  private keeperOf(group: Group, list: GiftList) {
    const t = this.db.lists.find((l) => l.id === group.treasurer)?.user;
    const t2 = this.db.lists.find((l) => l.id === group.deputy)?.user;
    return list.id === group.treasurer ? t2 : t;
  }
  /** Regalo sobre el que se actúa: 404 si es una sorpresa de tu plaza; 403 si es de tu plaza; antes de mirar su estado. */
  private giftTarget(itemId: Id) {
    const item = this.db.items.find((i) => i.id === itemId);
    const list = item && this.db.lists.find((l) => l.id === item.list);
    if (!item || !list || ((item.secret || item.removed) && list.user === this.viewer)) throw new ApiError('Ese regalo ya no existe.');
    if (list.user === this.viewer) throw new ApiError('No puedes reservar regalos de tu propia lista.');
    const group = this.member(list.group);
    return { item, list, group };
  }
  private invite(token: string) {
    const inv = this.db.invites.find((i) => i.token === token && i.uses < i.maxUses);
    if (!inv) throw new ApiError(BAD_INVITE);
    return inv;
  }
  private user(id: Id): User {
    return this.db.users.find((x) => x.id === id) ?? { id, name: 'Alguien', color: 'almendra' };
  }
  private isAdmin(groupId: Id) {
    return this.db.memberships.some((m) => m.group === groupId && m.user === this.viewer && m.role === 'admin');
  }
  private member(groupId: Id): Group {
    const g = this.db.groups.find((x) => x.id === groupId);
    if (!g || !this.db.memberships.some((m) => m.group === groupId && m.user === this.viewer)) throw new ApiError('No perteneces a este grupo.');
    return g;
  }
  private admin(groupId: Id): Group {
    const g = this.member(groupId);
    if (!this.isAdmin(groupId)) throw new ApiError('Solo quien organiza el grupo puede hacer esto.');
    return g;
  }
  private list(id: Id) {
    const l = this.db.lists.find((x) => x.id === id);
    if (!l) throw new ApiError('Esa lista no existe.');
    this.member(l.group);
    return l;
  }
  private editable(listId: Id) {
    const l = this.list(listId);
    if (!canEditList(this.viewer, l)) throw new ApiError('Solo quien lleva esta lista puede cambiarla.');
    return l;
  }

  // — persistencia —
  private load(): DemoData | null {
    try {
      const raw = this.storage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as DemoData) : null;
    } catch {
      return null;
    }
  }
  private save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.db));
    } catch {
      /* modo privado: la demo sigue en memoria */
    }
  }
  private read(k: string) {
    try {
      return this.storage?.getItem(`${KEY}:${k}`) ?? null;
    } catch {
      return null;
    }
  }
  private write(k: string, v: string) {
    try {
      this.storage?.setItem(`${KEY}:${k}`, v);
    } catch {
      /* sin almacenamiento */
    }
  }
}

const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 15);
const clip = (i: ItemInput): Omit<Item, 'id' | 'list' | 'currency' | 'createdBy'> => ({
  ...i,
  title: i.title.trim().slice(0, LIMITS.title),
  quantity: Math.min(Math.max(1, i.quantity), LIMITS.quantity),
});

export type { Claim };
