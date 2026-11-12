import PocketBase, { ClientResponseError, type RecordModel } from 'pocketbase';
import type { ItemDraft } from '../core/columns';
import type { PageMeta } from '../core/meta';
import type { Budget, Cents, Claim, Contribution, Draw, GiftList, Group, Id, Item, JoinRequest, Payment, Received, User } from '../core/types';
import { canEditList, canSeeStatus } from '../core/visibility';
import { ApiError, type Api, type DrawInfo, type GiftAction, type GroupDetail, type HuchaData, type InviteInfo, type ItemInput, type JoinResult, type ListDetail, type NewGroup, type Purchase } from './types';

/**
 * Backend real (PocketBase). La regla de la sorpresa la impone el SERVIDOR (server/pb/pb_migrations):
 * aquí solo se calcula `canSee` para la interfaz; si se olvidara, el servidor seguiría sin enviar nada.
 */
export class PocketBaseApi implements Api {
  readonly demo = false;
  readonly pb: PocketBase;

  constructor(baseUrl: string) {
    this.pb = new PocketBase(baseUrl);
    this.pb.autoCancellation(false);
  }

  /** Renueva la sesión al abrir la app (token de 180 días: quien abre Lazo de vez en cuando no caduca). */
  async resume() {
    if (this.pb.authStore.isValid) await this.pb.collection('users').authRefresh().catch(() => this.pb.authStore.clear());
  }

  me(): User | null {
    const r = this.pb.authStore.record;
    return r ? { id: r.id, name: String(r.name ?? ''), color: String(r.color ?? '') } : null;
  }
  private uid() {
    const id = this.pb.authStore.record?.id;
    if (!id) throw new ApiError('Entra con tu enlace de invitación.');
    return id;
  }

  groups = () => this.run(async () => (await this.pb.collection('groups').getFullList({ sort: 'date' })).map(group));

  groupDetail = (groupId: Id) =>
    this.run(async (): Promise<GroupDetail> => {
      const g = await this.pb.collection('groups').getOne(groupId, { expand: 'members' });
      const admins: string[] = g.admins ?? [];
      const members = ((g.expand?.members as RecordModel[]) ?? []).map((u) => ({ ...user(u), role: admins.includes(u.id) ? ('admin' as const) : ('member' as const) }));
      const lists = await this.pb.collection('lists').getFullList({ filter: this.pb.filter('group = {:g}', { g: groupId }), sort: 'name' });
      return { group: group(g), members, lists: lists.map(list) };
    });

  listDetail = (listId: Id) =>
    this.run(async (): Promise<ListDetail> => {
      const me = this.uid();
      const l = list(await this.pb.collection('lists').getOne(listId, { expand: 'group' }));
      const g = group((await this.pb.collection('groups').getOne(l.group)));
      const byList = this.pb.filter('list = {:l}', { l: listId });
      const byItemList = this.pb.filter('item.list = {:l}', { l: listId });
      const items = (await this.pb.collection('items').getFullList({ filter: byList, sort: 'priority,title' })).map(item);
      const canSee = canSeeStatus(me, l);
      // Si no puede verlo ni lo pedimos (el servidor devolvería vacío de todos modos).
      const [claims, contributions, budget] = canSee
        ? await Promise.all([
            this.pb.collection('claims').getFullList({ filter: byItemList }).then((r) => r.map(claim)),
            this.pb.collection('contributions').getFullList({ filter: byItemList }).then((r) => r.map(contribution)),
            this.pb.collection('budgets').getFirstListItem(byList).then(budgetOf, () => undefined),
          ])
        : [[], [], undefined];
      return { list: l, group: g, items, claims, contributions, budget, canSee, canEdit: canEditList(me, l) };
    });

  createGroup = (input: NewGroup) => this.run(async () => group(await this.pb.collection('groups').create(input)));

  addChildList = (groupId: Id, name: string, birthYear?: number) =>
    this.run(async () => list(await this.pb.collection('lists').create({ group: groupId, name, birthYear, kind: 'child', managers: [this.uid()] })));

  saveItem = (listId: Id, input: ItemInput, id?: Id) =>
    this.run(async () => {
      const data = { ...input, url: input.url ?? '', image: input.image ?? '' };
      return item(id ? await this.pb.collection('items').update(id, data) : await this.pb.collection('items').create({ ...data, list: listId, createdBy: this.uid(), currency: 'EUR' }));
    });

  deleteItem = (id: Id) => this.run(async () => void (await this.pb.collection('items').delete(id)));

  setBudget = (listId: Id, amountCents: Cents | null) =>
    this.run(async () => {
      const existing = await this.pb.collection('budgets').getFirstListItem(this.pb.filter('list = {:l}', { l: listId })).catch(() => null);
      if (amountCents === null) {
        if (existing) await this.pb.collection('budgets').delete(existing.id);
      } else if (existing) await this.pb.collection('budgets').update(existing.id, { amountCents });
      else await this.pb.collection('budgets').create({ list: listId, amountCents });
    });

  importItems = (listId: Id, drafts: ItemDraft[]) =>
    this.run(async () => {
      for (let i = 0; i < drafts.length; i += 50) {
        const batch = this.pb.createBatch();
        for (const d of drafts.slice(i, i + 50)) batch.collection('items').create({ ...d, list: listId, createdBy: this.uid(), currency: 'EUR' });
        await batch.send();
      }
      return drafts.length;
    });

  gift = (a: GiftAction) => this.run(async () => void (await this.pb.send('/api/lazo/gift', { method: 'POST', body: a })));

  contribute = (itemId: Id, amountCents: Cents) =>
    this.run(async () => {
      const mine = await this.pb.collection('contributions').getFirstListItem(this.pb.filter('item = {:i} && user = {:u}', { i: itemId, u: this.uid() })).catch(() => null);
      if (mine) await this.pb.collection('contributions').update(mine.id, { amountCents });
      else await this.pb.collection('contributions').create({ item: itemId, user: this.uid(), amountCents, paid: false });
    });
  setContributionPaid = (id: Id, paid: boolean) => this.run(async () => void (await this.pb.collection('contributions').update(id, { paid })));
  removeContribution = (id: Id) => this.run(async () => void (await this.pb.collection('contributions').delete(id)));

  createInvite = (groupId: Id, listId?: Id) =>
    this.run(async () => {
      const r = await this.pb.send<{ token: string; expires: string }>('/api/lazo/invite', { method: 'POST', body: { group: groupId, list: listId } });
      return { url: `${this.pb.baseURL.replace(/\/$/, '')}/#/unirse/${r.token}`, expires: r.expires };
    });

  inviteInfo = (token: string) => this.run(() => this.pb.send<InviteInfo>('/api/lazo/invite-info', { method: 'POST', body: { token } }));

  join = (token: string, choice: { list?: Id; name?: string }) =>
    this.run(async (): Promise<JoinResult> => {
      const r = await this.pb.send<{ token: string; record: RecordModel; meta?: { group: Id; pending?: boolean; request?: Id; code?: string } }>('/api/lazo/join', { method: 'POST', body: { token, ...choice } });
      this.pb.authStore.save(r.token, r.record);
      const m = r.meta ?? { group: '' };
      return m.pending ? { pending: true, request: m.request!, code: m.code!, group: m.group } : { group: m.group };
    });

  claimDevice = (code: string) =>
    this.run(async () => {
      const r = await this.pb.send<{ token: string; record: RecordModel }>('/api/lazo/device-claim', { method: 'POST', body: { code } });
      this.pb.authStore.save(r.token, r.record);
    });

  deviceCode = () => this.run(() => this.pb.send<{ code: string; minutes: number }>('/api/lazo/device-code', { method: 'POST' }));

  // Al rechazar, el servidor borra la solicitud (V-13 c): un 404 es «rechazada».
  requestStatus = (requestId: Id) =>
    this.run(async () => {
      try {
        return (await this.pb.collection('joinRequests').getOne(requestId)).status as JoinRequest['status'];
      } catch (e) {
        if ((e as { status?: number }).status === 404) return 'rejected' as const;
        throw e;
      }
    });

  joinRequests = (groupId: Id) =>
    this.run(async () =>
      (await this.pb.collection('joinRequests').getFullList({ filter: this.pb.filter('group = {:g} && status = "pending"', { g: groupId }) })).map(
        (r): JoinRequest => ({ id: r.id, group: r.group, user: r.user, list: opt(r.list), name: r.name, code: r.code, status: r.status }),
      ),
    );

  decideJoin = (requestId: Id, accept: boolean) => this.run(async () => void (await this.pb.send('/api/lazo/join-decide', { method: 'POST', body: { request: requestId, accept } })));

  updateGroup = (groupId: Id, patch: Partial<Pick<Group, 'name' | 'date' | 'buyMode' | 'allowNewNames'>>) =>
    this.run(async () => void (await this.pb.collection('groups').update(groupId, patch)));

  addPlaza = (groupId: Id, name: string) => this.run(async () => list(await this.pb.collection('lists').create({ group: groupId, name, kind: 'person' })));

  releasePlaza = (listId: Id) => this.run(async () => void (await this.pb.send('/api/lazo/plaza-release', { method: 'POST', body: { list: listId } })));

  addSurprise = (listId: Id, input: ItemInput) =>
    this.run(async () => item(await this.pb.collection('items').create({ ...input, url: input.url ?? '', image: input.image ?? '', list: listId, createdBy: this.uid(), currency: 'EUR', secret: true })));

  hucha = (groupId: Id) =>
    this.run(async (): Promise<HuchaData> => {
      const d = await this.groupDetail(groupId);
      const byGroup = this.pb.filter('list.group = {:g}', { g: groupId });
      const [items, claims, payments] = await Promise.all([
        this.pb.collection('items').getFullList({ filter: byGroup }).then((r) => r.map(item)),
        this.pb.collection('claims').getFullList({ filter: this.pb.filter('item.list.group = {:g} && kind = "pot"', { g: groupId }) }).then((r) => r.map(claim)),
        this.pb.collection('payments').getFullList({ filter: this.pb.filter('group = {:g}', { g: groupId }) }).then((r) =>
          r.map((p): Payment => ({ id: p.id, group: p.group, from: p.from, to: p.to, amountCents: p.amountCents, sub: !!p.sub, at: p.at || undefined })),
        ),
      ]);
      return { group: d.group, members: d.members, lists: d.lists, items, claims, payments };
    });

  setHuchaRoles = (groupId: Id, treasurerList: Id, deputyList: Id) =>
    this.run(async () => void (await this.pb.send('/api/lazo/hucha-roles', { method: 'POST', body: { group: groupId, treasurer: treasurerList, deputy: deputyList } })));

  addPayment = (groupId: Id, p: { from: Id; to: Id; amountCents: Cents; sub: boolean }) =>
    this.run(async () => void (await this.pb.collection('payments').create({ group: groupId, ...p, at: Date.now() })));

  removePayment = (id: Id) => this.run(async () => void (await this.pb.collection('payments').delete(id)));

  reveal = (groupId: Id, action: 'ask' | 'confirm' | 'cancel' | 'close') =>
    this.run(async () => void (await this.pb.send('/api/lazo/reveal', { method: 'POST', body: { group: groupId, action } })));

  received = (groupId: Id) => this.run(() => this.pb.send<Received[]>(`/api/lazo/received/${encodeURIComponent(groupId)}`, { method: 'GET' }));

  runDraw = (groupId: Id, participants: Id[], exclusions: [Id, Id][], budgetCents?: Cents) =>
    this.run(async () => void (await this.pb.send('/api/lazo/draw', { method: 'POST', body: { group: groupId, participants, exclusions, budgetCents } })));

  drawInfo = (groupId: Id) =>
    this.run(async (): Promise<DrawInfo> => {
      const d = await this.pb.collection('draws').getFirstListItem(this.pb.filter('group = {:g}', { g: groupId })).catch(() => null);
      if (!d) return {};
      const a = await this.pb.collection('assignments').getFirstListItem(this.pb.filter('draw = {:d} && giver = {:me}', { d: d.id, me: this.uid() }), { expand: 'receiver' }).catch(() => null);
      const draw: Draw = { id: d.id, group: d.group, budgetCents: d.budgetCents || undefined, exclusions: d.exclusions ?? [], participants: d.participants ?? [], createdBy: d.createdBy, round: d.round || undefined };
      return { draw, receiver: a?.expand?.receiver ? user(a.expand.receiver as RecordModel) : undefined };
    });

  unfurl = (url: string) => this.run(() => this.pb.send<PageMeta>('/api/lazo/unfurl', { method: 'POST', body: { url } }));

  purchases = () =>
    this.run(async (): Promise<Purchase[]> => {
      const mine = this.pb.filter('user = {:me}', { me: this.uid() });
      const opts = { filter: this.pb.filter('user = {:me} || paidBy = {:me}', { me: this.uid() }), expand: 'item.list.group' };
      const ctx = (r: RecordModel) => {
        const i = r.expand?.item as RecordModel;
        const l = i.expand?.list as RecordModel;
        return { item: item(i), list: list(l), group: group(l.expand?.group as RecordModel) };
      };
      const claims = (await this.pb.collection('claims').getFullList(opts)).map((r) => ({ ...ctx(r), claim: claim(r) }));
      const pots = (await this.pb.collection('contributions').getFullList({ filter: mine, expand: 'item.list.group' })).map((r) => ({ ...ctx(r), contribution: contribution(r) }));
      return [...claims, ...pots];
    });

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e instanceof ClientResponseError) {
        if (e.status === 0) throw new ApiError('Sin conexión con tu Lazo. Revisa la red e inténtalo otra vez.');
        if (e.status === 401) throw new ApiError('Tu sesión ha caducado. Entra otra vez con un enlace de invitación.');
        if (e.status === 403 || e.status === 404) throw new ApiError((e.response?.message as string) || 'No tienes acceso a esto.');
        if (e.status === 429) throw new ApiError('Demasiados intentos seguidos. Espera un minuto.');
        throw new ApiError((e.response?.message as string) || 'Algo ha fallado. Inténtalo otra vez.');
      }
      throw new ApiError('Algo ha fallado. Inténtalo otra vez.');
    }
  }
}

// — Conversión de registros —
const opt = <T>(v: T | '' | 0 | null | undefined): T | undefined => (v === '' || v === null || v === undefined ? undefined : (v as T));
const user = (r: RecordModel): User => ({ id: r.id, name: String(r.name ?? ''), color: String(r.color ?? '') });
const group = (r: RecordModel): Group => ({
  id: r.id, name: r.name, occasion: r.occasion, date: opt(r.date), currency: r.currency || 'EUR', owner: r.owner,
  buyMode: r.buyMode || 'individual', allowNewNames: !!r.allowNewNames, treasurer: opt(r.treasurer), deputy: opt(r.deputy), revealAskedBy: opt(r.revealAskedBy), revealedAt: r.revealedAt || 0,
});
const list = (r: RecordModel): GiftList => ({
  id: r.id, group: r.group, name: r.name, kind: r.kind || (r.user ? 'person' : 'child'), user: opt(r.user), managers: r.managers ?? [], birthYear: opt(r.birthYear), notes: opt(r.notes),
  claimedAt: r.claimedAt || undefined, via: opt(r.via), approvedBy: opt(r.approvedBy),
});
const item = (r: RecordModel): Item => ({
  id: r.id, list: r.list, title: r.title, url: opt(r.url), image: opt(r.image), priceCents: r.priceCents || r.priceCents === 0 ? r.priceCents || undefined : undefined,
  currency: r.currency || 'EUR', store: opt(r.store), size: opt(r.size), color: opt(r.color), priority: r.priority || 2, notes: opt(r.notes), quantity: r.quantity || 1, createdBy: r.createdBy,
  secret: !!r.secret, removed: !!r.removed,
});
const claim = (r: RecordModel): Claim => ({
  id: r.id, item: r.item, user: r.user, kind: r.kind || 'self', status: r.status, units: r.units || 1, paidBy: opt(r.paidBy), paidCents: r.status === 'bought' ? r.paidCents : undefined, boughtAt: r.boughtAt || undefined,
});
const contribution = (r: RecordModel): Contribution => ({ id: r.id, item: r.item, user: r.user, amountCents: r.amountCents, paid: !!r.paid });
const budgetOf = (r: RecordModel): Budget => ({ id: r.id, list: r.list, amountCents: r.amountCents });
