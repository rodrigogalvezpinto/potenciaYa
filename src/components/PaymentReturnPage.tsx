import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { formatCLP } from '../utils/currency.ts';
import { CommercialOrder } from '../types/index.ts';
import { CheckCircle2, AlertTriangle, ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';

interface PaymentReturnPageProps {
  onGoToOrders: () => void;
  onGoToStore: () => void;
}

export const PaymentReturnPage: React.FC<PaymentReturnPageProps> = ({ onGoToOrders, onGoToStore }) => {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [order, setOrder] = useState<CommercialOrder | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const processReturn = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;

      const isWebpay = pathname.includes('webpay-return') || urlParams.has('token_ws');
      const token = urlParams.get('token_ws') || urlParams.get('token');
      const orderId = urlParams.get('orderId') || urlParams.get('mock_order') || urlParams.get('external_reference');
      const prefId = urlParams.get('preference_id');

      try {
        if (isWebpay) {
          const res = await fetch('/api/payments/webpay/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token || 'TBK-MOCK-SANDBOX', orderId }),
          });
          const data = await res.json();
          if (data.success && data.status === 'APPROVED') {
            setApproved(true);
            setOrder(data.order);
            // Disparar celebración
            try {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            } catch {}
          } else {
            setApproved(false);
            setErrorMessage(data.message || 'La transacción no fue aprobada por el emisor bancario.');
          }
        } else {
          // Mercado Pago
          const res = await fetch('/api/payments/mercadopago/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, preferenceId: prefId }),
          });
          const data = await res.json();
          if (data.success && data.status === 'APPROVED') {
            setApproved(true);
            setOrder(data.order);
            try {
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            } catch {}
          } else {
            setApproved(false);
            setErrorMessage(data.message || 'El pago no ha sido confirmado.');
          }
        }
      } catch (err: any) {
        setApproved(false);
        setErrorMessage(err.message || 'Error al validar el pago con la pasarela.');
      } finally {
        setLoading(false);
      }
    };

    processReturn();
  }, []);

  return (
    <div className="py-16 sm:py-24 max-w-lg mx-auto px-4 text-center">
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Confirmando tu Pago...</h2>
          <p className="text-xs text-slate-400">
            Estamos validando la transacción con la pasarela bancaria y despachando tu orden a la red social.
          </p>
        </div>
      ) : approved ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl animate-fade-in text-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            ¡Pago Aprobado y Orden Despachada!
          </span>

          <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">
            ¡Gracias por tu compra!
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 mt-2">
            Tu orden ya está siendo procesada automáticamente por nuestros servidores.
          </p>

          {order && (
            <div className="mt-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Número de Orden:</span>
                <span className="font-mono font-bold text-orange-400">{order.id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Servicio:</span>
                <span className="font-bold text-white truncate max-w-[200px]">{order.serviceName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Cantidad:</span>
                <span className="font-bold text-white">{order.quantity.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Total pagado:</span>
                <span className="font-black text-emerald-400 text-sm">{formatCLP(order.totalPriceCLP)}</span>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onGoToOrders}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Ver en Mis Pedidos</span>
            </button>

            <button
              onClick={onGoToStore}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
            >
              Seguir Comprando
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Comprobante emitido con validez tributaria nacional</span>
          </div>

        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl text-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-9 h-9 stroke-[2.2]" />
          </div>

          <h2 className="text-2xl font-black text-white">Transacción No Completada</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2">
            {errorMessage || 'El banco no autorizó la operación o cancelaste el proceso.'}
          </p>

          <div className="mt-8 flex gap-3 justify-center">
            <button
              onClick={onGoToStore}
              className="py-3 px-6 bg-gradient-to-r from-orange-500 to-rose-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg cursor-pointer"
            >
              Volver a Intentar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
