/** Modelo de dominio de Lazo. El dinero va siempre en céntimos enteros. */
export type Id = string;
export type Cents = number;

export type Occasion = 'navidad' | 'cumpleanos' | 'boda' | 'bebe' | 'otro';

export interface User {
  id: Id;
  name: string;
  color: string;
}

export interface Group {
  id: Id;
  name: string;
  occasion: Occasion;
  date?: string; // AAAA-MM-DD
  currency: string;
  owner: Id;
}

export interface Membership {
  id: Id;
  group: Id;
  user: Id;
  role: 'admin' | 'member';
}

/** Lista de un miembro (`user`) o lista gestionada de un niño (`user` vacío; la llevan `managers`). */
export interface GiftList {
  id: Id;
  group: Id;
  name: string;
  user?: Id;
  managers: Id[];
  birthYear?: number;
  notes?: string;
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
}

export interface Claim {
  id: Id;
  item: Id;
  user: Id;
  status: 'reserved' | 'bought';
  units: number;
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
