import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { CommercialOrder, OrderStatus } from '../types/index.ts';
import { formatCLP, formatChileanDate } from '../utils/currency.ts';
import { 
  ShoppingBag, 
  RotateCcw, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Search,
  X
} from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CommercialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<CommercialOrder | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersMap = new Map<string, CommercialOrder>();

      // 1. Si el usuario está autenticado, traer por su UID y por su Email
      if (user) {
        const [resUid, resEmail] = await Promise.all([
          fetch(`/api/orders/user/${user.uid}`).then(r => r.json()).catch(() => ({})),
          user.email ? fetch(`/api/orders/user/${user.email}`).then(r => r.json()).catch(() => ({})) : Promise.resolve({})
        ]);

        if (resUid.success && Array.isArray(resUid.orders)) {
          resUid.orders.forEach((o: CommercialOrder) => ordersMap.set(o.id, o));
        }
        if (resEmail.success && Array.isArray(resEmail.orders)) {
          resEmail.orders.forEach((o: CommercialOrder) => ordersMap.set(o.id, o));
        }
      }

      // 2. Traer órdenes recientes guardadas localmente en este navegador (para compras como invitado)
      try {
        const localIds: string[] = JSON.parse(localStorage.getItem('potenciaredes_recent_orders') || '[]');
        if (localIds.length > 0) {
          const fetchPromises = localIds.slice(0, 10).map(id =>
            fetch(`/api/orders/${id}`).then(r => r.json()).catch(() => ({}))
          );
          const results = await Promise.all(fetchPromises);
          results.forEach(res => {
            if (res.success && res.order) {
              ordersMap.set(res.order.id, res.order);
            }
          });
        }
      } catch {}

      const combined = Array.from(ordersMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(combined);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const handleRefreshStatus = async (orderId: string) => {
    setActionLoading(orderId);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.order) {
        setOrders(prev => prev.map(o => (o.id === orderId ? data.order : o)));
        if (selectedOrder?.id === orderId) setSelectedOrder(data.order);
        setMessage({ type: 'success', text: 'Estado actualizado correctamente desde el proveedor.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'No se pudo actualizar el estado.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error de red.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleLookupOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;

    setLookupLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/lookup?query=${encodeURIComponent(lookupQuery.trim())}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
        setOrders(prev => {
          const map = new Map<string, CommercialOrder>();
          data.orders.forEach((o: CommercialOrder) => map.set(o.id, o));
          prev.forEach(o => map.set(o.id, o));
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        setMessage({ type: 'success', text: `Se encontraron ${data.orders.length} pedido(s) asociados.` });
        setLookupQuery('');
      } else {
        setMessage({ type: 'error', text: 'No se encontraron pedidos con ese identificador o correo.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al buscar pedido.' });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRequestRefill = async (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    const effectiveUserId = user?.uid || targetOrder?.userId || 'anonymous-guest';

    setActionLoading(orderId);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: effectiveUserId, isAdmin: false }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await fetchOrders();
      } else {
        setMessage({ type: 'error', text: data.error || 'No se pudo procesar el refill.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al solicitar refill.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayWebpayPortal = (order: CommercialOrder) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.webpay.cl/backpub/external/form-pay';
    form.target = '_blank';

    const inputId = document.createElement('input');
    inputId.type = 'hidden';
    inputId.name = 'idFormulario';
    inputId.value = '436254';
    form.appendChild(inputId);

    const inputMonto = document.createElement('input');
    inputMonto.type = 'hidden';
    inputMonto.name = 'monto';
    inputMonto.value = String(Math.round(order.totalPriceCLP));
    form.appendChild(inputMonto);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const handleConfirmWebpayPayment = async (orderId: string) => {
    const authCode = window.prompt('Ingresa el Código de Autorización de tu comprobante Transbank Webpay (o presiona Aceptar para validar):', '');
    if (authCode === null) return;

    setActionLoading(orderId);
    setMessage(null);
    try {
      const res = await fetch('/api/payments/webpay/portal-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, authorizationCode: authCode.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setOrders(prev => prev.map(o => (o.id === orderId ? data.order : o)));
        setMessage({ type: 'success', text: '¡Pago validado exitosamente! Tu pedido ha sido despachado.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'No se pudo confirmar el pago.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al confirmar pago.' });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Completado</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">En Proceso</span>;
      case 'PENDING':
      case 'QUEUED':
      case 'SUBMITTED':
      case 'PAID':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Encolado / Pendiente</span>;
      case 'PAID_WAITING_PROVIDER_BALANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30" title="Pago aprobado. Pedido en cola de aprovisionamiento prioritario.">
            Pago Confirmado • Asignando Red
          </span>
        );
      case 'REQUIRES_RECONCILIATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30">
            En Verificación Automática
          </span>
        );
      case 'PARTIAL':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Parcial</span>;
      case 'CANCELED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 text-rose-400 border border-rose-500/20">Cancelado</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q) ||
        o.targetUrl.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalSpent = orders
    .filter(o => o.status !== 'AWAITING_PAYMENT' && o.status !== 'CANCELED')
    .reduce((acc, o) => acc + o.totalPriceCLP, 0);

  const completedCount = orders.filter(o => o.status === 'COMPLETED').length;
  const inProgressCount = orders.filter(o => o.status === 'IN_PROGRESS' || o.status === 'PENDING' || o.status === 'QUEUED').length;

  return (
    <div className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Panel de Clientes & Mis Pedidos
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Consulta el estado en tiempo real, solicita reposiciones y descarga comprobantes en CLP.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Lista</span>
        </button>
      </div>

      {/* Alerta de Mensaje */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Tarjetas KPI del Cliente */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Invertido
          </span>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {formatCLP(totalSpent)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Facturado en Pesos Chilenos (CLP)</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Pedidos en Progreso
          </span>
          <p className="text-2xl sm:text-3xl font-black text-orange-400">
            {inProgressCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Despachándose en las redes</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Pedidos Completados
          </span>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">
            {completedCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Entregas 100% exitosas</p>
        </div>
      </div>

      {/* Caja de Rastreo Directo para Invitados o Clientes */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
            <span>🔍</span>
            <span>¿Compraste como invitado o buscas una orden específica?</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ingresa tu número de orden (ej: ORD-...) o tu correo electrónico para rastrear el progreso en vivo.
          </p>
        </div>

        <form onSubmit={handleLookupOrder} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            placeholder="ORD-... o tu@correo.cl"
            className="w-full md:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={lookupLoading || !lookupQuery.trim()}
            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
          >
            {lookupLoading ? 'Buscando...' : 'Rastrear'}
          </button>
        </form>
      </div>

      {/* Controles de Búsqueda y Filtro en la lista cargada */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por ID, enlace o servicio..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'IN_PROGRESS', 'COMPLETED', 'PENDING'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st === 'ALL' ? 'Todos' : st === 'IN_PROGRESS' ? 'En Proceso' : st === 'COMPLETED' ? 'Completados' : 'Pendientes'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla / Lista de Pedidos */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-400">Cargando tus pedidos...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
          <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Aún no tienes pedidos registrados en esta vista</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Si realizaste una compra reciente como invitado, rastréala arriba usando tu número de orden o correo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                {/* Info Principal */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-orange-400">
                      {order.id}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400">
                      {formatChileanDate(order.createdAt)}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    {getStatusBadge(order.status)}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {order.serviceName}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    <div>
                      <span>Destino:</span>{' '}
                      <strong className="text-slate-300 font-medium truncate inline-block max-w-[200px] align-bottom">
                        {order.targetUrl}
                      </strong>
                    </div>
                    <div>
                      <span>Cantidad:</span>{' '}
                      <strong className="text-white font-bold">{order.quantity.toLocaleString('es-CL')}</strong>
                    </div>
                    <div>
                      <span>Monto:</span>{' '}
                      <strong className="text-orange-400 font-bold">{formatCLP(order.totalPriceCLP)}</strong>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
                  
                  {/* Botón Pagar en Webpay si está pendiente */}
                  {order.status === 'AWAITING_PAYMENT' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePayWebpayPortal(order)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                        title="Abrir formulario oficial Webpay.cl Transbank"
                      >
                        <span>💳</span>
                        <span>Pagar en Webpay</span>
                      </button>
                      <button
                        onClick={() => handleConfirmWebpayPayment(order.id)}
                        disabled={actionLoading === order.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        title="Confirmar con comprobante o código de autorización"
                      >
                        <span>✓ Ya pagué</span>
                      </button>
                    </div>
                  )}

                  {/* Botón Refill */}
                  {order.refillAvailable && (order.status === 'COMPLETED' || order.status === 'IN_PROGRESS') && (
                    <button
                      onClick={() => handleRequestRefill(order.id)}
                      disabled={actionLoading === order.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                      title="Garantía de reposición de 30 días"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Refill</span>
                    </button>
                  )}

                  {/* Refrescar Estado */}
                  <button
                    onClick={() => handleRefreshStatus(order.id)}
                    disabled={actionLoading === order.id}
                    title="Actualizar estado desde el proveedor"
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === order.id ? 'animate-spin' : ''}`} />
                  </button>

                  {/* Ver Detalle */}
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span>Detalle</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalle de Orden */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4 pr-6">
              <span className="font-mono text-xs font-bold text-orange-400">{selectedOrder.id}</span>
              <h2 className="text-lg font-bold text-white mt-1">{selectedOrder.serviceName}</h2>
              <div className="mt-2">{getStatusBadge(selectedOrder.status)}</div>
            </div>

            <div className="space-y-3 border-t border-slate-800 pt-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Fecha de compra:</span>
                <span className="font-medium text-white">{formatChileanDate(selectedOrder.createdAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Enlace / Perfil:</span>
                <span className="font-medium text-orange-400 truncate max-w-[250px]">{selectedOrder.targetUrl}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Cantidad contratada:</span>
                <span className="font-bold text-white">{selectedOrder.quantity.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Monto total pagado:</span>
                <span className="font-black text-white">{formatCLP(selectedOrder.totalPriceCLP)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Medio de pago:</span>
                <span className="font-medium text-white">{selectedOrder.paymentGateway || 'Webpay Plus'}</span>
              </div>
              {selectedOrder.startCount !== undefined && (
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Conteo inicial detectado:</span>
                  <span className="font-medium text-white">{selectedOrder.startCount}</span>
                </div>
              )}
            </div>

            {/* Cronología de Estados */}
            <div className="mt-5 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Historial de Actualizaciones
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {selectedOrder.history?.map((h, i) => (
                  <div key={i} className="text-[11px] p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                    <div className="flex justify-between text-slate-400 mb-0.5">
                      <span className="font-bold text-slate-300">{h.status}</span>
                      <span>{formatChileanDate(h.timestamp)}</span>
                    </div>
                    <p className="text-slate-300">{h.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
