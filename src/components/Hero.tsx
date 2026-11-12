import React from 'react';
import { Flame, ShieldCheck, Zap, Award, CheckCircle2, ArrowRight } from 'lucide-react';

interface HeroProps {
  onSelectPlatform: (platform: string) => void;
  selectedPlatform: string;
}

export const Hero: React.FC<HeroProps> = ({ onSelectPlatform, selectedPlatform }) => {
  const platforms = [
    { id: 'TODOS', name: 'Todos los Servicios', icon: '⚡' },
    { id: 'Instagram', name: 'Instagram', icon: '📸' },
    { id: 'TikTok', name: 'TikTok', icon: '🎵' },
    { id: 'YouTube', name: 'YouTube', icon: '▶️' },
    { id: 'Facebook', name: 'Facebook', icon: '👥' },
    { id: 'X', name: 'X (Twitter)', icon: '🐦' },
    { id: 'Spotify', name: 'Spotify', icon: '🎧' },
    { id: 'Telegram', name: 'Telegram', icon: '✈️' },
  ];

  return (
    <section className="relative overflow-hidden pt-8 pb-12 sm:pt-16 sm:pb-20 border-b border-slate-800/80 bg-radial-[at_top_center] from-slate-900 via-slate-950 to-slate-950">
      {/* Luces y efectos de fondo sutiles */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl h-64 bg-rose-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Badge superior */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/60 shadow-lg">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs font-semibold text-slate-200">
              Servicios activos con entrega inmediata en Chile 🇨🇱
            </span>
          </div>
        </div>

        {/* Titular Principal */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.15]">
            Potencia tu presencia en redes con{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-500 to-amber-300">
              crecimiento rápido e impacto inmediato
            </span>
          </h1>
          <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal">
            Seguidores, likes, visualizaciones y reproducciones de alta retención. Compra directa en{' '}
            <strong className="text-white font-semibold">Pesos Chilenos (CLP)</strong> con{' '}
            <span className="text-emerald-400 font-medium">Flow Chile</span> (Webpay, Servipag, MACH y tarjetas). Sin pedir contraseñas.
          </p>

          {/* Botones de acción */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a
              href="#catalogo"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm sm:text-base font-bold text-white bg-gradient-to-r from-orange-500 via-rose-600 to-rose-700 hover:from-orange-400 hover:to-rose-600 shadow-xl shadow-rose-600/30 active:scale-98 transition-all cursor-pointer"
            >
              <span>Explorar Catálogo de Servicios</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </a>
            <a
              href="#como-funciona"
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm sm:text-base font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer"
            >
              <span>Ver Cómo Funciona</span>
            </a>
          </div>

          {/* Métricas de la Plataforma */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto text-left">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-orange-400 mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Seguridad</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-white">100% Sin Contraseñas</p>
              <p className="text-[11px] text-slate-400">Solo necesitamos tu enlace público</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Velocidad</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-white">Inicio Inmediato</p>
              <p className="text-[11px] text-slate-400">Despacho automatizado 24/7</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-rose-400 mb-1">
                <Award className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Seguimiento</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-white">Avance en Vivo</p>
              <p className="text-[11px] text-slate-400">Monitoreo de entrega en línea</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sky-400 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Chile</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-white">Pago Local en CLP</p>
              <p className="text-[11px] text-slate-400">Flow Chile (Tarjetas, Servipag, MACH)</p>
            </div>
          </div>

        </div>

        {/* Selector Rápido de Plataformas */}
        <div className="mt-12 pt-6 border-t border-slate-800/80">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Selecciona tu red social para filtrar servicios
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {platforms.map(p => {
              const active = selectedPlatform === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPlatform(p.id)}
                  className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-lg shadow-rose-600/30 scale-105'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-850 border border-slate-800'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};
