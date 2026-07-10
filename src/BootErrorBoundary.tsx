import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Database, RefreshCcw, ShieldAlert } from 'lucide-react';
import { recordAppError } from './services/errorLog';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class BootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordAppError('boot.react', `${error.message}\n${info.componentStack ?? ''}`);
  }

  private continueLocally = () => {
    window.sessionStorage.setItem('isivolt:skip-native-hydration', '1');
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="boot-failure" role="alert">
        <section>
          <span className="boot-failure-icon"><ShieldAlert size={38} /></span>
          <small>ISIVOLT no ha podido completar el arranque</small>
          <h1>Modo de recuperación</h1>
          <p>La aplicación ha detectado un error antes de mostrar el inventario. Tus datos no se borrarán desde esta pantalla.</p>
          <div className="boot-failure-detail">
            <AlertTriangle size={18} />
            <code>{this.state.error.message || 'Error de inicio no identificado'}</code>
          </div>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCcw size={18} /> Reintentar
          </button>
          <button type="button" className="boot-secondary" onClick={this.continueLocally}>
            <Database size={18} /> Continuar con almacenamiento local
          </button>
        </section>
      </main>
    );
  }
}
