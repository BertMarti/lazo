import { amazonInfo } from '../core/amazon';
import type { ItemDraft } from '../core/columns';
import { cryptoRand, drawPairs } from '../core/draw';
import type { PageMeta } from '../core/meta';
import type { Cents, Claim, GiftList, Id, Item, User } from '../core/types';
import { canEditList, canSeeStatus } from '../core/visibility';
import { DEMO_UNFURL, seed, type DemoData } from './seed';
import { ApiError, type Api, type DrawInfo, type GroupDetail, type ItemInput, type ListDetail, type NewGroup, type Purchase } from './types';

const KEY = 'lazo-demo-v1';

/**
 * Backend simulado de la demo pública: todo en memoria y en localStorage del navegador.
 * Aplica las MISMAS reglas que el servidor (sorpresa, permisos de edición), para que la demo sea fiel.
 */
export class DemoApi implements Api {
  readonly demo = true;
  private db: DemoData;
  private viewer: Id;

  constructor(private storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.db = this.load() ?? seed();
    this.viewer = this.read('viewer') ?? 'marta';
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

  me(): User {
    return this.user(this.viewer);
  }

  async groups() {
    const mine = new Set(this.db.memberships.filter((m) => m.user === this.viewer).map((m) => m.group));
    return this.db.groups.filter((g) => mine.has(g.id));
  }

  async groupDetail(groupId: Id): Promise<GroupDetail> {
    const group = this.member(groupId);
    const members = this.db.memberships
      .filter((m) => m.group === groupId)
      .map((m) => ({ ...this.user(m.user), role: m.role }));
    return { group, members, lists: this.db.lists.filter((l) => l.group === groupId) };
  }

  async listDetail(listId: Id): Promise<ListDetail> {
    const list = this.list(listId);
    const group = this.member(list.group);
    const items = this.db.items.filter((i) => i.list === listId);
    const ids = new Set(items.map((i) => i.id));
    const canSee = canSeeStatus(this.viewer, list);
    return {
      list,
      group,
      items,
      claims: canSee ? this.db.claims.filter((c) => ids.has(c.item)) : [],
      contributions: canSee ? this.db.contributions.filter((c) => ids.has(c.item)) : [],
      canSee,
      canEdit: canEditList(this.viewer, list),
    };
  }

  async createGroup(input: NewGroup) {
    const group = { ...input, id: uid(), owner: this.viewer };
    this.db.groups.push(group);
    this.db.memberships.push({ id: uid(), group: group.id, user: this.viewer, role: 'admin' });
    this.db.lists.push({ id: uid(), group: group.id, name: this.me().name, user: this.viewer, managers: [] });
    this.save();
    return group;
  }

  async addChildList(groupId: Id, name: string, birthYear?: number) {
    this.admin(groupId);
    const list: GiftList = { id: uid(), group: groupId, name: name.trim(), managers: [this.viewer], birthYear };
    this.db.lists.push(list);
    this.save();
    return list;
  }

  async saveItem(listId: Id, input: ItemInput, id?: Id) {
    const list = this.editable(listId);
    if (id) {
      const idx = this.db.items.findIndex((i) => i.id === id && i.list === list.id);
      if (idx < 0) throw new ApiError('Ese regalo ya no existe.');
      this.db.items[idx] = { ...this.db.items[idx]!, ...input };
      this.save();
      return this.db.items[idx]!;
    }
    const item: Item = { ...input, id: uid(), list: list.id, currency: this.member(list.group).currency, createdBy: this.viewer };
    this.db.items.push(item);
    this.save();
    return item;
  }

  async deleteItem(id: Id) {
    const item = this.item(id);
    this.editable(item.list);
    this.db.items = this.db.items.filter((i) => i.id !== id);
    this.db.claims = this.db.claims.filter((c) => c.item !== id);
    this.db.contributions = this.db.contributions.filter((c) => c.item !== id);
    this.save();
  }

  async importItems(listId: Id, drafts: ItemDraft[]) {
    for (const d of drafts) await this.saveItem(listId, d);
    return drafts.length;
  }

  async claim(itemId: Id, status: Claim['status']) {
    const item = this.visibleItem(itemId);
    const taken = this.db.claims.filter((c) => c.item === itemId).reduce((s, c) => s + c.units, 0);
    if (taken >= item.quantity) throw new ApiError('Alguien se te ha adelantado: ya está reservado.');
    this.db.claims.push({ id: uid(), item: itemId, user: this.viewer, status, units: 1 });
    this.save();
  }

  async setClaimStatus(claimId: Id, status: Claim['status']) {
    this.ownClaim(claimId).status = status;
    this.save();
  }

  async releaseClaim(claimId: Id) {
    this.ownClaim(claimId);
    this.db.claims = this.db.claims.filter((c) => c.id !== claimId);
    this.save();
  }

  async contribute(itemId: Id, amountCents: Cents) {
    this.visibleItem(itemId);
    const existing = this.db.contributions.find((c) => c.item === itemId && c.user === this.viewer);
    if (existing) existing.amountCents = amountCents;
    else this.db.contributions.push({ id: uid(), item: itemId, user: this.viewer, amountCents, paid: false });
    this.save();
  }

  async setContributionPaid(id: Id, paid: boolean) {
    const c = this.db.contributions.find((x) => x.id === id);
    if (!c) throw new ApiError('Esa aportación ya no existe.');
    this.visibleItem(c.item);
    c.paid = paid;
    this.save();
  }

  async removeContribution(id: Id) {
    const c = this.db.contributions.find((x) => x.id === id && x.user === this.viewer);
    if (!c) throw new ApiError('Solo puedes quitar tu propia aportación.');
    this.db.contributions = this.db.contributions.filter((x) => x.id !== id);
    this.save();
  }

  async createInvite(groupId: Id) {
    this.admin(groupId);
    const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();
    return { url: `${location.origin}${location.pathname}#/unirse/demo-${groupId}`, expires };
  }

  async join(): Promise<User> {
    throw new ApiError('En la demo no se puede unir nadie nuevo: usa «Ver como…» para cambiar de persona.');
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
      const item = this.item(itemId);
      const list = this.list(item.list);
      return { item, list, group: this.db.groups.find((g) => g.id === list.group)! };
    };
    for (const claim of this.db.claims.filter((c) => c.user === this.viewer)) out.push({ ...ctx(claim.item), claim });
    for (const contribution of this.db.contributions.filter((c) => c.user === this.viewer))
      out.push({ ...ctx(contribution.item), contribution });
    return out;
  }

  // — reglas —
  private user(id: Id): User {
    return this.db.users.find((x) => x.id === id) ?? { id, name: 'Alguien', color: '#888' };
  }
  private member(groupId: Id) {
    const g = this.db.groups.find((x) => x.id === groupId);
    if (!g || !this.db.memberships.some((m) => m.group === groupId && m.user === this.viewer))
      throw new ApiError('No perteneces a este grupo.');
    return g;
  }
  private admin(groupId: Id) {
    this.member(groupId);
    if (!this.db.memberships.some((m) => m.group === groupId && m.user === this.viewer && m.role === 'admin'))
      throw new ApiError('Solo quien organiza el grupo puede hacer esto.');
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
  private item(id: Id) {
    const i = this.db.items.find((x) => x.id === id);
    if (!i) throw new ApiError('Ese regalo ya no existe.');
    this.list(i.list);
    return i;
  }
  /** Reservar o aportar: nunca en la propia lista (ahí no se ve el estado). */
  private visibleItem(id: Id) {
    const i = this.item(id);
    if (!canSeeStatus(this.viewer, this.list(i.list))) throw new ApiError('No puedes reservar regalos de tu propia lista.');
    return i;
  }
  private ownClaim(id: Id) {
    const c = this.db.claims.find((x) => x.id === id && x.user === this.viewer);
    if (!c) throw new ApiError('Esa reserva no es tuya o ya no existe.');
    return c;
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

const uid = () => crypto.randomUUID().slice(0, 12);
