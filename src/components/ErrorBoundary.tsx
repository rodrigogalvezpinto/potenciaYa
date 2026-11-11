import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Flame, RefreshCw, AlertTriangle, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PotenciaRedes Uncaught Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.href = '/';
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-rose-500 selection:text-white font-sans antialiased">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            
            {/* Logo */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-orange-500 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-rose-500/20">
              <Flame className="w-7 h-7 stroke-[2.5]" />
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
              PotenciaRedes Chile 🇨🇱
            </span>

            <h1 className="text-xl sm:text-2xl font-black text-white mt-4 tracking-tight">
              Ocurrió un inconveniente al cargar
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              La plataforma encontró un error temporal de renderizado. Puedes recargar la aplicación o volver al catálogo principal.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl text-left text-xs font-mono text-rose-300 overflow-x-auto max-h-36">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Detalle técnico:</span>
                </div>
                <p className="break-words">{this.state.error.message || String(this.state.error)}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recargar Plataforma</span>
              </button>

              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Intentar Recuperar</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mt-6">
              Tus pagos y órdenes están resguardados en nuestros servidores de forma segura.
            </p>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
