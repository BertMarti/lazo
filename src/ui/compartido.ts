import { MAX_PEGADO } from '../core/amazonLista';

// Texto que llega con «Compartir → Lazo» (Android). Solo en memoria (AMZ-16: nunca en localStorage); se olvida en
// cuanto la hoja de importar lo ha leído.
let pendiente: string | null = null;
export const guardaCompartido = (t: string) => {
  pendiente = t.slice(0, MAX_PEGADO);
};
export const leeCompartido = () => pendiente;
export const olvidaCompartido = () => {
  pendiente = null;
};
