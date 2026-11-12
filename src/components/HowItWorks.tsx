import React from 'react';
import { MousePointerClick, CreditCard, Rocket, ShieldCheck } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Elige tu Servicio y Cantidad',
      desc: 'Selecciona la plataforma (Instagram, TikTok, YouTube, etc.) y la cantidad de seguidores, likes o reproducciones que necesitas.',
      icon: MousePointerClick,
      color: 'from-orange-500 to-amber-500',
    },
    {
      num: '02',
      title: 'Ingresa tu Enlace Público',
      desc: 'Coloca tu @usuario o el enlace a tu publicación. Jamás te solicitaremos contraseñas ni permisos sobre tus cuentas.',
      icon: ShieldCheck,
      color: 'from-rose-500 to-orange-500',
    },
    {
      num: '03',
      title: 'Paga Seguro en Pesos Chilenos',
      desc: 'Realiza el pago a través de Flow Chile (tarjetas de débito/crédito, Redcompra, Servipag, MACH u Onepay) con monto bloqueado y confirmación automática.',
      icon: CreditCard,
      color: 'from-rose-600 to-rose-700',
    },
    {
      num: '04',
      title: 'Entrega Automática 24/7',
      desc: 'Nuestro sistema despacha la orden automáticamente hacia la red en minutos. Sigue el progreso en tiempo real desde tu panel.',
      icon: Rocket,
      color: 'from-amber-400 to-orange-500',
    },
  ];

  return (
    <section id="como-funciona" className="py-16 sm:py-20 border-b border-slate-800/80 bg-slate-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
            Flujo Simple y Transparente
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">
            ¿Cómo Funciona PotenciaRedes?
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mt-2">
            Sin suscripciones ocultas, sin registros complejos y con entrega automatizada de principio a fin.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="relative bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${step.color} flex items-center justify-center text-white shadow-lg`}>
                      <Icon className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <span className="text-3xl font-black text-slate-800 select-none">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
