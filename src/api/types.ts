import type { ItemDraft } from '../core/columns';
import type { PageMeta } from '../core/meta';
import type { Cents, Claim, Contribution, Draw, GiftList, Group, Id, Item, Occasion, User } from '../core/types';

export interface Member extends User {
  role: 'admin' | 'member';
}

export interface GroupDetail {
  group: Group;
  members: Member[];
  lists: GiftList[];
}

export interface ListDetail {
  list: GiftList;
  group: Group;
  items: Item[];
  /** Vacíos SIEMPRE si `canSee` es falso: el servidor ni siquiera los envía. */
  claims: Claim[];
  contributions: Contribution[];
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
  /** A quién le regalo yo. Solo se conoce la propia asignación. */
  receiver?: User;
}

export interface NewGroup {
  name: string;
  occasion: Occasion;
  date?: string;
  currency: string;
}

/** Lo que la interfaz necesita del backend. Implementaciones: PocketBaseApi (servidor) y DemoApi (memoria). */
export interface Api {
  readonly demo: boolean;
  me(): User | null;
  groups(): Promise<Group[]>;
  groupDetail(groupId: Id): Promise<GroupDetail>;
  listDetail(listId: Id): Promise<ListDetail>;
  createGroup(input: NewGroup): Promise<Group>;
  addChildList(groupId: Id, name: string, birthYear?: number): Promise<GiftList>;
  saveItem(listId: Id, input: ItemInput, id?: Id): Promise<Item>;
  deleteItem(id: Id): Promise<void>;
  importItems(listId: Id, drafts: ItemDraft[]): Promise<number>;
  claim(itemId: Id, status: Claim['status']): Promise<void>;
  setClaimStatus(claimId: Id, status: Claim['status']): Promise<void>;
  releaseClaim(claimId: Id): Promise<void>;
  contribute(itemId: Id, amountCents: Cents): Promise<void>;
  setContributionPaid(id: Id, paid: boolean): Promise<void>;
  removeContribution(id: Id): Promise<void>;
  createInvite(groupId: Id): Promise<{ url: string; expires: string }>;
  join(token: string, name: string): Promise<User>;
  runDraw(groupId: Id, participants: Id[], exclusions: [Id, Id][], budgetCents?: Cents): Promise<void>;
  drawInfo(groupId: Id): Promise<DrawInfo>;
  unfurl(url: string): Promise<PageMeta>;
  purchases(): Promise<Purchase[]>;
}

export class ApiError extends Error {}
