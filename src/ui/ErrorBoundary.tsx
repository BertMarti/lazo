import { ArrowClockwise, CaretLeft } from '@phosphor-icons/react';
import { Component, type ReactNode } from 'react';
import { Bow } from './Bow';
import { Button, ButtonGroup } from './Button';
import { go, lastGroup } from './ctx';

/** Un fallo en una pantalla nunca deja la app en blanco (o en negro, en modo oscuro): se dice y se ofrece salir. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error('Lazo: fallo en la pantalla', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) {
      return (
        <>
          {import.meta.env.VITE_DEMO && <FalloDeDemo />}
          {this.props.children}
        </>
      );
    }
    const back = () => {
      if (history.length > 1) history.back();
      else go(lastGroup.get() ? `/g/${lastGroup.get()}` : '/');
    };
    return (
      <div className="empty" role="alert">
        <Bow size={88} />
        <h2>Algo ha fallado en esta pantalla</h2>
        <p>Tus datos están a salvo. Vuelve atrás o recarga.</p>
        <ButtonGroup>
          <Button variant="primary" icon={CaretLeft} onClick={back}>
            Volver
          </Button>
          <Button variant="secondary" icon={ArrowClockwise} onClick={() => location.reload()}>
            Recargar
          </Button>
        </ButtonGroup>
      </div>
    );
  }
}

/** Solo en la demo (VITE_DEMO): «?fallo» rompe la pantalla para que las E2E vean este aviso. */
function FalloDeDemo() {
  if (new URLSearchParams(location.search).has('fallo')) throw new Error('Fallo forzado de la demo');
  return null;
}
