import type { ItemDraft } from '../core/columns';
import type { PageMeta } from '../core/meta';
import type { SharedList } from '../core/shared';
import type { Budget, BuyMode, Cents, Claim, Contribution, Draw, GiftList, Group, Id, Item, JoinRequest, Occasion, Payment, Received, User } from '../core/types';

export interface Member extends User {
  role: 'admin' | 'member';
}

export interface GroupDetail {
  group: Group;
  members: Member[];
  /** Todas las plazas (también las libres) y las listas de niños. */
  lists: GiftList[];
}

export interface ListDetail {
  list: GiftList;
  group: Group;
  /** En la propia lista NO vienen los regalos sorpresa ni los retirados. */
  items: Item[];
  /** Vacíos SIEMPRE si `canSee` es falso: el servidor ni siquiera los envía. */
  claims: Claim[];
  contributions: Contribution[];
  /** Presupuesto del grupo para esta plaza. Siempre undefined si `canSee` es falso. */
  budget?: Budget;
  canSee: boolean;
  canEdit: boolean;
}

export type ItemInput = Omit<ItemDraft, 'priceCents'> & {
  priceCents?: Cents;
  image?: string;
  store?: string;
};

export interface Purchase {
  item: Item;
  list: GiftList;
  group: Group;
  claim?: Claim;
  contribution?: Contribution;
}

export interface DrawInfo {
  draw?: Draw;
  receiver?: User;
}

export interface NewGroup {
  name: string;
  occasion: Occasion;
  date?: string;
  currency: string;
  buyMode: BuyMode;
  /** Nombres previstos: cada uno es una plaza libre. */
  plazas?: string[];
  allowNewNames?: boolean;
}

export interface InviteInfo {
  group: { id: Id; name: string; occasion: Occasion; date?: string };
  organizer: string;
  /** Enlace personal: la plaza a la que da entrada. `color`: el de quien la tuvo antes (plaza liberada), si lo hay. */
  personal: { list: Id; name: string; color?: string } | null;
  /** Enlace general: plazas libres para elegir. */
  free: { list: Id; name: string; color?: string }[];
  /** Quien ya está dentro: solo inicial y color, como mucho 12. */
  faces: { initial: string; color: string }[];
  allowNewNames: boolean;
}

export type JoinResult = { group: Id } | { pending: true; request: Id; code: string; group: Id };

/** Todas las transiciones de un regalo (spec plazas-hucha §3.2). */
export type GiftAction =
  | { action: 'reserve'; item: Id; kind: 'self' | 'pot' }
  | { action: 'release'; claim: Id }
  | { action: 'move'; claim: Id; kind: 'self' | 'pot' }
  | { action: 'buy'; item?: Id; claim?: Id; kind?: 'self' | 'pot'; paidCents: Cents; paidBy: Id }
  | { action: 'unbuy'; claim: Id };

/** Lo que la pantalla «Hucha» necesita: solo filas que quien mira PUEDE ver. */
export interface HuchaData {
  group: Group;
  members: Member[];
  lists: GiftList[];
  items: Item[];
  claims: Claim[];
  payments: Payment[];
}

export type { SharedItem, SharedList } from '../core/shared';

/** Mismo texto para todo enlace malo: falso, rotado o revocado. */
export const BAD_SHARE = 'Este enlace no existe o ya no se comparte.';

/** Lo que la interfaz necesita del backend. Implementaciones: PocketBaseApi (servidor) y DemoApi (memoria). */
export interface Api {
  readonly demo: boolean;
  me(): User | null;
  groups(): Promise<Group[]>;
  groupDetail(groupId: Id): Promise<GroupDetail>;
  listDetail(listId: Id): Promise<ListDetail>;
  createGroup(input: NewGroup): Promise<Group>;
  updateGroup(groupId: Id, patch: Partial<Pick<Group, 'name' | 'date' | 'buyMode' | 'allowNewNames'>>): Promise<void>;
  addChildList(groupId: Id, name: string, birthYear?: number): Promise<GiftList>;
  addPlaza(groupId: Id, name: string): Promise<GiftList>;
  releasePlaza(listId: Id): Promise<void>;
  saveItem(listId: Id, input: ItemInput, id?: Id): Promise<Item>;
  /** Regalo sorpresa en la plaza de otra persona: ella no lo verá. */
  addSurprise(listId: Id, input: ItemInput): Promise<Item>;
  deleteItem(id: Id): Promise<void>;
  setBudget(listId: Id, amountCents: Cents | null): Promise<void>;
  importItems(listId: Id, drafts: ItemDraft[]): Promise<number>;
  /** Copia del grupo: regalos pedidos en las plazas de un grupo recién creado en el que aún no ha entrado nadie más. */
  restoreItems(groupId: Id, lists: { list: Id; items: ItemInput[] }[]): Promise<number>;
  gift(a: GiftAction): Promise<void>;
  contribute(itemId: Id, amountCents: Cents): Promise<void>;
  setContributionPaid(id: Id, paid: boolean): Promise<void>;
  removeContribution(id: Id): Promise<void>;
  createInvite(groupId: Id, listId?: Id): Promise<{ url: string; expires: string }>;
  inviteInfo(token: string): Promise<InviteInfo>;
  join(token: string, choice: { list?: Id; name?: string }): Promise<JoinResult>;
  requestStatus(requestId: Id): Promise<JoinRequest['status']>;
  /** Entrar con un código de 8 caracteres (de otro móvil o de `pocketbase lazo-alta`). */
  claimDevice(code: string): Promise<void>;
  /** Código de un solo uso para entrar con esta cuenta en otro móvil. */
  deviceCode(): Promise<{ code: string; minutes: number }>;
  joinRequests(groupId: Id): Promise<JoinRequest[]>;
  decideJoin(requestId: Id, accept: boolean): Promise<void>;
  hucha(groupId: Id): Promise<HuchaData>;
  setHuchaRoles(groupId: Id, treasurerList: Id, deputyList: Id): Promise<void>;
  addPayment(groupId: Id, p: { from: Id; to: Id; amountCents: Cents; sub: boolean }): Promise<void>;
  removePayment(id: Id): Promise<void>;
  reveal(groupId: Id, action: 'ask' | 'confirm' | 'cancel' | 'close'): Promise<void>;
  received(groupId: Id): Promise<Received[]>;
  runDraw(groupId: Id, participants: Id[], exclusions: [Id, Id][], budgetCents?: Cents): Promise<void>;
  drawInfo(groupId: Id): Promise<DrawInfo>;
  unfurl(url: string): Promise<PageMeta>;
  purchases(): Promise<Purchase[]>;
  /**
   * Tiempo real: llama a `onChange` (agrupado) cuando cambia algo que quien mira PUEDE ver; el servidor no le manda
   * nada de su propia plaza. `groupId` vacío = todos sus grupos. Devuelve cómo dejar de escuchar.
   */
  watch(groupId: Id, onChange: () => void): () => void;
  /** Enlace de solo lectura de una lista propia (o de un niño que llevas). Crear de nuevo rota el anterior. */
  shareList(listId: Id): Promise<{ url: string }>;
  unshareList(listId: Id): Promise<void>;
  /** Público: no necesita sesión. */
  sharedList(token: string): Promise<SharedList>;
}

export class ApiError extends Error {}

/** Mismo texto para todo token malo: no se distingue «no existe» de «caducado» ni de «revocado». */
export const BAD_INVITE = 'Esta invitación no existe o ha caducado. Pide un enlace nuevo.';
