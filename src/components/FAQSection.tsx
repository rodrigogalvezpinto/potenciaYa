import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: '¿Es seguro para mi cuenta? ¿Existe riesgo de baneo?',
      a: 'Nuestros servicios operan mediante métodos no intrusivos y de alta retención que respetan los límites de entrega de las plataformas. Además, jamás solicitamos tu contraseña ni acceso a tu cuenta, por lo que tu perfil se mantiene 100% seguro.',
    },
    {
      q: '¿Qué diferencia hay entre el Plan Free y el Plan Premium?',
      a: 'El Plan Free utiliza la ruta más económica disponible para impulsar tu cuenta con entrega rápida, mientras que el Plan Premium selecciona rutas de mayor calidad, estabilidad y retención estimada.',
    },
    {
      q: '¿Cuánto demora en iniciar y completarse un pedido?',
      a: 'La gran mayoría de los servicios inician entre 5 y 15 minutos después de que Flow confirma el pago. El tiempo de finalización depende de la cantidad solicitada para mantener una entrega natural y progresiva.',
    },
    {
      q: '¿Qué medios de pago aceptan en Chile?',
      a: 'Procesamos todos nuestros cobros con monto exacto en Pesos Chilenos (CLP) exclusivamente a través de Flow Chile, lo que te permite pagar con tarjetas de débito y crédito (Redcompra/Webpay), Servipag, MACH, Onepay y transferencias bancarias sin comisiones ocultas.',
    },
    {
      q: '¿Mi cuenta debe ser pública al momento de la entrega?',
      a: 'Sí. Es indispensable que tu cuenta de Instagram, TikTok o la red social correspondiente se mantenga en modo PÚBLICO durante todo el proceso de entrega. Una vez completado el pedido puedes volver a configurarla según prefieras.',
    },
  ];

  return (
    <section className="py-16 sm:py-20 border-t border-slate-800/80 bg-slate-950/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-orange-400 mb-2">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Respuestas Rápidas</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Preguntas Frecuentes
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Todo lo que necesitas saber antes de contratar tus servicios de crecimiento.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.q}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-white hover:text-orange-300 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 ml-4 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-orange-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
