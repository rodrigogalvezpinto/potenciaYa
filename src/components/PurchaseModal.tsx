import React, { useState, useEffect } from 'react';
import { CommercialService } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { formatCLP } from '../utils/currency.ts';
import { 
  X, 
  ShieldCheck, 
  Zap, 
  RotateCcw, 
  AlertCircle, 
  Check, 
  ArrowRight, 
  CreditCard,
  Lock,
  ExternalLink
} from 'lucide-react';

interface PurchaseModalProps {
  service: CommercialService | null;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({ service, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState<number>(1000);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [gateway, setGateway] = useState<'WEBPAY_PLUS' | 'MERCADO_PAGO'>('WEBPAY_PLUS');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    totalPriceCLP: number;
    unitPricePer1000CLP: number;
  } | null>(null);

  useEffect(() => {
    if (service) {
      // Valor por defecto razonable dentro de los límites
      const initialQty = Math.max(service.minQuantity, Math.min(1000, service.maxQuantity));
      setQuantity(initialQty);
      setTargetUrl('');
      setError(null);
    }
  }, [service]);

  // Recalcular cotización en tiempo real desde el backend
  useEffect(() => {
    if (!service || !quantity) return;

    const fetchQuote = async () => {
      try {
        const res = await fetch('/api/pricing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: service.id,
            quantity,
            gateway,
          }),
        });
        const data = await res.json();
        if (data.success && data.quote) {
          setQuote({
            totalPriceCLP: data.quote.totalPriceCLP,
            unitPricePer1000CLP: data.quote.unitPricePer1000CLP,
          });
        }
      } catch {
        // Fallback local client-side calculation
        const base = (service.commercialRateCLP / 1000) * quantity;
        setQuote({
          totalPriceCLP: Math.ceil(base / 10) * 10,
          unitPricePer1000CLP: service.commercialRateCLP,
        });
      }
    };

    fetchQuote();
  }, [service, quantity, gateway]);

  if (!service) return null;

  const getUrlPlaceholder = () => {
    switch (service.platform) {
      case 'Instagram':
        return 'Ej: @tu_usuario o https://instagram.com/p/...';
      case 'TikTok':
        return 'Ej: @tu_usuario o https://tiktok.com/@user/video/...';
      case 'YouTube':
        return 'Ej: https://youtube.com/watch?v=... o URL de tu canal';
      case 'Spotify':
        return 'Ej: https://open.spotify.com/track/... o enlace de artista';
      default:
        return 'Ej: Enlace público del perfil o publicación';
    }
  };

  const quickQuantities = [
    { label: '500', val: 500 },
    { label: '1.000', val: 1000 },
    { label: '2.500', val: 2500 },
    { label: '5.000', val: 5000 },
    { label: '10.000', val: 10000 },
  ].filter(q => q.val >= service.minQuantity && q.val <= service.maxQuantity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validar cantidad
    if (quantity < service.minQuantity) {
      setError(`La cantidad mínima permitida es ${service.minQuantity.toLocaleString('es-CL')}.`);
      return;
    }
    if (quantity > service.maxQuantity) {
      setError(`La cantidad máxima permitida es ${service.maxQuantity.toLocaleString('es-CL')}.`);
      return;
    }

    // Validar URL
    if (!targetUrl.trim() || targetUrl.trim().length < 2) {
      setError('Por favor ingresa un usuario o enlace de destino válido.');
      return;
    }

    // Correo de contacto
    const effectiveEmail = user?.email || guestEmail.trim();
    if (!effectiveEmail || !effectiveEmail.includes('@')) {
      setError('Por favor ingresa un correo electrónico válido para enviarte el comprobante.');
      return;
    }

    setLoading(true);

    try {
      // 1. Crear orden preliminar (Draft) en backend
      const draftRes = await fetch('/api/orders/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'guest-' + Date.now(),
          userEmail: effectiveEmail,
          serviceId: service.id,
          targetUrl: targetUrl.trim(),
          quantity,
          gateway,
        }),
      });

      const draftData = await draftRes.json();
      if (!draftData.success || !draftData.order) {
        throw new Error(draftData.error || 'No se pudo generar la orden preliminar.');
      }

      const orderId = draftData.order.id;

      // 2. Iniciar pasarela de pago seleccionada
      const endpoint = gateway === 'WEBPAY_PLUS'
        ? '/api/payments/webpay/create'
        : '/api/payments/mercadopago/create';

      const payRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const payData = await payRes.json();
      if (!payData.success || !payData.payment) {
        throw new Error(payData.error || 'Error al iniciar la pasarela de pago.');
      }

      // Guardar en pedidos locales para seguimiento inmediato
      try {
        const stored = JSON.parse(localStorage.getItem('potenciaredes_recent_orders') || '[]');
        const updated = Array.from(new Set([orderId, ...stored])).slice(0, 20);
        localStorage.setItem('potenciaredes_recent_orders', JSON.stringify(updated));
      } catch {}

      // Si la pasarela devuelve formulario directo Webpay.cl (Empresa 186612 / Formulario 436254)
      if (payData.payment.portalForm) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payData.payment.portalForm.action;
        form.target = '_blank';

        const inputId = document.createElement('input');
        inputId.type = 'hidden';
        inputId.name = 'idFormulario';
        inputId.value = String(payData.payment.portalForm.idFormulario);
        form.appendChild(inputId);

        const inputMonto = document.createElement('input');
        inputMonto.type = 'hidden';
        inputMonto.name = 'monto';
        inputMonto.value = String(payData.payment.portalForm.monto);
        form.appendChild(inputMonto);

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        onSuccess(orderId);
        return;
      }

      // Webpay Plus Oficial REST API: Monto 100% fijo y bloqueado por Transbank
      if (payData.payment.url && payData.payment.token) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payData.payment.url;

        const inputToken = document.createElement('input');
        inputToken.type = 'hidden';
        inputToken.name = 'token_ws';
        inputToken.value = payData.payment.token;
        form.appendChild(inputToken);

        document.body.appendChild(form);
        form.submit();
        return;
      }

      // 3. Redirigir al flujo de retorno / pago seguro estándar
      if (payData.payment.redirectUrl) {
        window.location.href = payData.payment.redirectUrl;
      } else {
        onSuccess(orderId);
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      setError(err.message || 'Ocurrió un error al procesar la compra.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 text-slate-100 my-auto">
        
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado del Servicio */}
        <div className="mb-5 pr-8">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-bold text-orange-400 uppercase tracking-wider">
              {service.platform} • {service.commercialCategory || (service as any).category}
            </span>
            {service.tier && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                service.tier === 'PREMIUM'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  : service.tier === 'ESTANDAR'
                  ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              }`}>
                Modalidad {service.tier}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white leading-tight">
            {service.commercialName || (service as any).name}
          </h2>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
            {service.description}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Campo Enlace de Destino */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">
                {service.linkType || 'Enlace o usuario de destino'}
              </label>
              <span className="text-[11px] text-slate-500">Público / Sin contraseñas</span>
            </div>
            <input
              type="text"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder={getUrlPlaceholder()}
              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2.5 px-3.5 text-xs sm:text-sm text-white placeholder-slate-600 outline-none transition-all"
            />
          </div>

          {/* Campo Cantidad */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Cantidad deseada
              </label>
              <span className="text-[11px] text-slate-400">
                Mín: {service.minQuantity.toLocaleString('es-CL')} / Máx: {service.maxQuantity.toLocaleString('es-CL')}
              </span>
            </div>
            
            <input
              type="number"
              required
              min={service.minQuantity}
              max={service.maxQuantity}
              step={10}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2.5 px-3.5 text-sm sm:text-base font-bold text-white outline-none transition-all"
            />

            {/* Botones de incremento rápido */}
            {quickQuantities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickQuantities.map(q => (
                  <button
                    key={q.val}
                    type="button"
                    onClick={() => setQuantity(q.val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      quantity === q.val
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    +{q.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Correo de Cliente (si no está autenticado) */}
          {!user && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tu correo electrónico (para el comprobante y seguimiento)
              </label>
              <input
                type="email"
                required
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="nombre@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2.5 px-3.5 text-xs sm:text-sm text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>
          )}

          {/* Medio de Pago */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Selecciona tu medio de pago en Chile
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              
              {/* Webpay Plus */}
              <button
                type="button"
                onClick={() => setGateway('WEBPAY_PLUS')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  gateway === 'WEBPAY_PLUS'
                    ? 'border-orange-500 bg-orange-500/10 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>💳</span> Webpay Plus
                  </span>
                  {gateway === 'WEBPAY_PLUS' && (
                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Redcompra, Débito y Crédito bancario en CLP
                </span>
              </button>

              {/* Mercado Pago */}
              <button
                type="button"
                onClick={() => setGateway('MERCADO_PAGO')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  gateway === 'MERCADO_PAGO'
                    ? 'border-sky-500 bg-sky-500/10 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>⚡</span> Mercado Pago
                  </span>
                  {gateway === 'MERCADO_PAGO' && (
                    <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Tarjetas y Dinero en cuenta Mercado Pago
                </span>
              </button>

            </div>
          </div>

          {/* Resumen de Compra en CLP */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Precio x 1.000 unidades:</span>
              <span className="font-semibold text-slate-300">
                {quote ? formatCLP(quote.unitPricePer1000CLP) : formatCLP(service.commercialRateCLP)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-slate-400">
              <span>Garantía de reposición:</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                {service.refill ? '30 Días Refill Incluido' : 'Garantía de Entrega'}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <div>
                <span className="text-xs font-bold text-white block">Total a pagar:</span>
                <span className="text-[10px] text-slate-500">Pesos Chilenos (CLP) • IVA incluido</span>
              </div>
              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-500 to-amber-300">
                {quote ? formatCLP(quote.totalPriceCLP) : '$0 CLP'}
              </span>
            </div>
          </div>

          {/* Botón Pagar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 via-rose-600 to-rose-700 hover:from-orange-400 hover:to-rose-600 text-white font-bold text-sm sm:text-base rounded-2xl shadow-xl shadow-rose-600/30 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Conectando con pasarela segura...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Pagar Seguro con {gateway === 'WEBPAY_PLUS' ? 'Webpay' : 'Mercado Pago'}</span>
              </>
            )}
          </button>

          {/* Garantía de Seguridad */}
          <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Transacción encriptada con estándar bancario PCI-DSS</span>
          </p>

        </form>

      </div>
    </div>
  );
};
