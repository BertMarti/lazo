/** Botón o gesto de atrás de Android: con una hoja abierta o historial, atrás (la hoja se cierra sola); si no, salir. */
export const androidBack = (sheetOpen: boolean, canGoBack: boolean): 'back' | 'exit' => (sheetOpen || canGoBack ? 'back' : 'exit');
