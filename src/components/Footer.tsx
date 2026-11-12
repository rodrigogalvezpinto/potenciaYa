import React, { useState } from 'react';
import { Flame, ShieldCheck, Heart } from 'lucide-react';
import { TERMS_FINE_PRINT_PARAGRAPHS, TERMS_FINE_PRINT_TITLE } from '../constants/terms.ts';

export const Footer: React.FC = () => {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Logo y Misión */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-orange-500 flex items-center justify-center text-white shadow-md">
                <Flame className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-lg text-white">
                POTENCIA<span className="text-orange-400">REDES</span>
              </span>
            </div>
            <p className="text-slate-400 max-w-sm leading-relaxed text-xs">
              Plataforma comercial líder en Chile de servicios de marketing digital y crecimiento acelerado en redes sociales. Transacciones seguras en Pesos Chilenos (CLP) con entrega automatizada 24/7.
            </p>
            <div className="flex items-center gap-3 pt-2 text-slate-500 text-[11px]">
              <span>🇨🇱 Santiago de Chile</span>
              <span>•</span>
              <span>Zona Horaria: America/Santiago</span>
            </div>
          </div>

          {/* Redes y Servicios */}
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">
              Servicios Destacados
            </h4>
            <ul className="space-y-2">
              <li><span className="hover:text-white cursor-pointer">Seguidores de Instagram</span></li>
              <li><span className="hover:text-white cursor-pointer">Likes y Vistas de TikTok</span></li>
              <li><span className="hover:text-white cursor-pointer">Suscriptores de YouTube</span></li>
              <li><span className="hover:text-white cursor-pointer">Oyentes Mensuales Spotify</span></li>
              <li><span className="hover:text-white cursor-pointer">Miembros de Telegram</span></li>
            </ul>
          </div>

          {/* Medios de Pago y Seguridad */}
          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">
              Medios de Pago en Chile
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Flow Chile (Pasarela Oficial)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                <span>Débito, Crédito, Redcompra y MACH</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>Servipag, Onepay y Transferencia</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-2 leading-relaxed">
                Sin comisiones de cambio internacional. Confirmación automática en CLP.
              </p>
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>© {new Date().getFullYear()} PotenciaRedes. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-slate-500">
            <button
              type="button"
              onClick={() => setShowTerms(prev => !prev)}
              className="hover:text-slate-300 underline-offset-2 hover:underline cursor-pointer"
            >
              Términos del Servicio
            </button>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Política de Privacidad</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Contacto: soporte@potenciaredes.cl</span>
          </div>
        </div>

        {showTerms && (
          <div className="mt-4 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 text-[10px] leading-relaxed text-slate-400 space-y-1">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span>{TERMS_FINE_PRINT_TITLE}</span>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            {TERMS_FINE_PRINT_PARAGRAPHS.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>
        )}

      </div>
    </footer>
  );
};
