import type { ReactNode } from 'react';
import type { User } from '../core/types';

/** Lo que cada pantalla pide a la cabecera azul. */
export interface Title {
  name: string;
  sub?: string;
  date?: string;
  back?: string;
  avatar?: Pick<User, 'name' | 'color'>;
  actions?: ReactNode;
}
