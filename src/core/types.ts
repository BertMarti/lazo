/** Modelo de dominio de Lazo. El dinero va siempre en céntimos enteros. */
export type Id = string;
export type Cents = number;

export type Occasion = 'navidad' | 'cumpleanos' | 'boda' | 'bebe' | 'otro';

export interface User {
  id: Id;
  name: string;
  color: string;
}

export type BuyMode = 'hucha' | 'individual' | 'mixto';

export interface Group {
  id: Id;
  name: string;
  occasion: Occasion;
  date?: string; // AAAA-MM-DD
  currency: string;
  owner: Id;
  /** Cómo compra el grupo: con un bote común, cada uno lo suyo o regalo a regalo. */
  buyMode: BuyMode;
  /** Dejar entrar con un nombre que no está en la lista (lo acepta un admin). */
  allowNewNames?: boolean;
  /** Plaza (lista) de quien lleva la hucha y de quien lleva las cuentas de sus regalos. */
  treasurer?: Id;
  deputy?: Id;
  /** Día de la entrega: dos llaves (lo propone un admin, lo confirma otra persona). */
  revealAskedBy?: Id;
  revealedAt?: number;
}

export interface Membership {
  id: Id;
  group: Id;
  user: Id;
  role: 'admin' | 'member';
}

/**
 * Una plaza (`kind: 'person'`, libre si no tiene `user`) o la lista de un niño (`kind: 'child'`, la llevan `managers`).
 * La identidad es la plaza; la cuenta que la ocupa es solo la llave.
 */
export interface GiftList {
  id: Id;
  group: Id;
  name: string;
  kind?: 'person' | 'child';
  user?: Id;
  managers: Id[];
  birthYear?: number;
  notes?: string;
  claimedAt?: number;
  via?: 'creator' | 'personal' | 'approved';
  approvedBy?: Id;
  prevUser?: Id;
}

export type Priority = 1 | 2 | 3;

/** Un regalo. A propósito NO tiene estado: el estado se deriva de reservas y aportaciones. */
export interface Item {
  id: Id;
  list: Id;
  title: string;
  url?: string;
  image?: string;
  priceCents?: Cents;
  currency: string;
  store?: string;
  size?: string;
  color?: string;
  priority: Priority;
  notes?: string;
  quantity: number;
  createdBy: Id;
  /** Regalo sorpresa: lo apuntó otra persona; el dueño de la lista no lo ve. */
  secret?: boolean;
  /** El dueño lo quitó, pero tenía reservas o compras: los demás lo siguen viendo. */
  removed?: boolean;
}

/** Una unidad cogida de un regalo: «me lo reservo» (`self`) o «para la hucha» (`pot`). */
export interface Claim {
  id: Id;
  item: Id;
  user: Id;
  kind?: 'self' | 'pot';
  status: 'reserved' | 'bought';
  units: number;
  /** Ya comprado: quién lo pagó o adelantó y cuánto costó de verdad. */
  paidBy?: Id;
  paidCents?: Cents;
  boughtAt?: number;
}

/** Dinero que pasa entre una persona y quien lleva la hucha (`sub`: la cuenta de los regalos del tesorero). */
export interface Payment {
  id: Id;
  group: Id;
  from: Id;
  to: Id;
  amountCents: Cents;
  sub: boolean;
  at?: number;
}

export interface JoinRequest {
  id: Id;
  group: Id;
  user: Id;
  list?: Id;
  name: string;
  code: string;
  status: 'pending' | 'approved' | 'rejected';
}

/** Lo que te regalaron (solo tras abrir la entrega). Nunca precios. */
export interface Received {
  title: string;
  image?: string;
  url?: string;
  from: { id: Id; name: string }[];
  fromAll: boolean;
}

export interface Contribution {
  id: Id;
  item: Id;
  user: Id;
  amountCents: Cents;
  paid: boolean;
}

/** Presupuesto que el grupo destina a una persona (a su lista). Su destinatario NUNCA lo ve. */
export interface Budget {
  id: Id;
  list: Id;
  amountCents: Cents;
}

export interface Draw {
  id: Id;
  group: Id;
  budgetCents?: Cents;
  exclusions: [Id, Id][];
  participants: Id[];
  createdBy: Id;
}

export interface Assignment {
  draw: Id;
  giver: Id;
  receiver: Id;
}

export const LIMITS = {
  amount: 100_000_000, // 1 millón de euros en céntimos
  quantity: 20,
  importRows: 300,
  title: 200,
  notes: 1000,
} as const;
