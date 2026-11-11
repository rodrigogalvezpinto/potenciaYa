import React from 'react';
import { ShieldCheck, Zap, RotateCcw, Headphones, DollarSign, Award } from 'lucide-react';

export const BenefitsSection: React.FC = () => {
  const benefits = [
    {
      title: 'Seguridad 100% Garantizada',
      desc: 'No solicitamos contraseñas, accesos ni tokens personales. Solo requerimos el enlace público de tu perfil o publicación.',
      icon: ShieldCheck,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Precios Mayoristas Directos',
      desc: 'Eliminamos intermediarios costosos para ofrecer tarifas mayoristas directas calculadas transparentemente en pesos chilenos.',
      icon: DollarSign,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Garantía de Reposición (Refill)',
      desc: 'Si una red social realiza una actualización y se reduce el conteo en servicios elegibles, lo reponemos sin costo por 30 días.',
      icon: RotateCcw,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
    {
      title: 'Despacho Inmediato 24/7',
      desc: 'Infraestructura en la nube conectada por API de alta velocidad que procesa y encola tu orden segundos después del pago.',
      icon: Zap,
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    },
    {
      title: 'Entrega Gradual y Natural',
      desc: 'Diseñado respetando los ritmos de cada algoritmo social para proteger la integridad y reputación de tu cuenta.',
      icon: Award,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Soporte y Trazabilidad',
      desc: 'Historial completo con identificador de transacción bancaria y estado en vivo de cada uno de tus pedidos.',
      icon: Headphones,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    },
  ];

  return (
    <section id="garantias" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
          Garantías del Servicio
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">
          Por Qué Elegir PotenciaRedes
        </h2>
        <p className="text-sm sm:text-base text-slate-400 mt-2">
          La plataforma preferida por agencias de marketing, influencers y emprendedores en Chile.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {benefits.map(b => {
          const Icon = b.icon;
          return (
            <div
              key={b.title}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-4 ${b.color}`}>
                <Icon className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">{b.title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{b.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
