import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { 
  AdminNotification, 
  CommercialCatalogService, 
  CommercialOrder, 
  ProviderTechnicalService, 
  QueueJob, 
  SyncHistoryRecord, 
  SystemSettings, 
  TestResult 
} from '../types/index.ts';
import { formatCLP, formatUSD, formatChileanDate } from '../utils/currency.ts';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Layers, 
  Settings, 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  RotateCcw, 
  Ban, 
  Search, 
  Sliders, 
  Key, 
  Bell, 
  ListOrdered, 
  GitCompare, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  PlayCircle,
  ExternalLink,
  ShieldCheck,
  Crown,
  Sparkles,
  Zap,
  Clock
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { profile, isAdmin, user } = useAuth();
  const [tab, setTab] = useState<'metrics' | 'orders' | 'queue' | 'commercial' | 'technical' | 'comparator' | 'notifications' | 'settings'>('metrics');
  
  // Datos
  const [metrics, setMetrics] = useState<any>(null);
  const [orders, setOrders] = useState<CommercialOrder[]>([]);
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [commercialServices, setCommercialServices] = useState<CommercialCatalogService[]>([]);
  const [technicalServices, setTechnicalServices] = useState<ProviderTechnicalService[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryRecord[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [balanceStatus, setBalanceStatus] = useState<any>(null);

  // Estados de carga
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [runningTests, setRunningTests] = useState(false);
  const [testReport, setTestReport] = useState<{ total: number; passed: number; failed: number; results: TestResult[] } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtros
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [queueStatusFilter, setQueueStatusFilter] = useState('ALL');
  const [notifLevelFilter, setNotifLevelFilter] = useState('ALL');
  const [commSearch, setCommSearch] = useState('');
  const [commPlatform, setCommPlatform] = useState('TODOS');
  const [techSearch, setTechSearch] = useState('');
  const [techPlatform, setTechPlatform] = useState('TODOS');

  // Comparador
  const [selectedCommForCompare, setSelectedCommForCompare] = useState<string>('');
  const [compareData, setCompareData] = useState<{ commercial?: CommercialCatalogService; equivalents: ProviderTechnicalService[] } | null>(null);

  // Ajustes de umbrales, precios base y FX
  const [newFxRate, setNewFxRate] = useState<string>('950');
  const [newMargin, setNewMargin] = useState<string>('80');
  const [newFreeBaseCLP, setNewFreeBaseCLP] = useState<string>('7990');
  const [newFreeMicroCLP, setNewFreeMicroCLP] = useState<string>('5990');
  const [newPremiumBaseCLP, setNewPremiumBaseCLP] = useState<string>('14990');
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [newFlowEnv, setNewFlowEnv] = useState<'PRODUCTION' | 'SANDBOX'>('PRODUCTION');
  const [newFlowApiKey, setNewFlowApiKey] = useState<string>('');
  const [newFlowSecretKey, setNewFlowSecretKey] = useState<string>('');
  const [lowUSD, setLowUSD] = useState<string>('30');
  const [criticalUSD, setCriticalUSD] = useState<string>('10');
  const [insufficientUSD, setInsufficientUSD] = useState<string>('2');

  // Prueba en vivo de Flow
  const [testingFlow, setTestingFlow] = useState(false);
  const [flowTestAmount, setFlowTestAmount] = useState<string>('500');
  const [flowTestEmail, setFlowTestEmail] = useState<string>('rodrigogalvez@42labs.cl');
  const [flowTestResult, setFlowTestResult] = useState<any>(null);

  // Reconciliación modal
  const [reconcileModalOrder, setReconcileModalOrder] = useState<CommercialOrder | null>(null);
  const [reconcileExternalId, setReconcileExternalId] = useState('');
  const [reconcileNote, setReconcileNote] = useState('');

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [
        metricsRes,
        ordersRes,
        queueRes,
        commRes,
        techRes,
        notifRes,
        balanceRes,
        settingsRes,
        syncRes,
      ] = await Promise.all([
        fetch('/api/admin/metrics').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/orders').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/queue').then(r => r.json()).catch(() => ({})),
        fetch('/api/catalog').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/catalog/technical').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/notifications').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/balance').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/settings').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/sync/history').then(r => r.json()).catch(() => ({})),
      ]);

      if (metricsRes.success) setMetrics(metricsRes);
      if (ordersRes.success) setOrders(ordersRes.orders || []);
      if (queueRes.success) setQueueJobs(queueRes.jobs || []);
      if (commRes.success) setCommercialServices(commRes.services || []);
      if (techRes.success) setTechnicalServices(techRes.services || []);
      if (notifRes.success) setNotifications(notifRes.notifications || []);
      if (balanceRes.success) setBalanceStatus(balanceRes.status);
      if (syncRes.success) setSyncHistory(syncRes.history || []);

      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
        setNewFxRate(String(settingsRes.settings.usdClpRate));
        setNewMargin(String(settingsRes.settings.defaultGlobalMarginPercent));
        if (settingsRes.settings.freeBasePriceCLP) setNewFreeBaseCLP(String(settingsRes.settings.freeBasePriceCLP));
        if (settingsRes.settings.freeMicroPriceCLP) setNewFreeMicroCLP(String(settingsRes.settings.freeMicroPriceCLP));
        if (settingsRes.settings.premiumBasePriceCLP) setNewPremiumBaseCLP(String(settingsRes.settings.premiumBasePriceCLP));
        if (settingsRes.settings.flowEnvironment === 'SANDBOX' || settingsRes.settings.flowEnvironment === 'PRODUCTION') {
          setNewFlowEnv(settingsRes.settings.flowEnvironment);
        }
        if (settingsRes.settings.thresholds) {
          setLowUSD(String(settingsRes.settings.thresholds.lowUSD));
          setCriticalUSD(String(settingsRes.settings.thresholds.criticalUSD));
          setInsufficientUSD(String(settingsRes.settings.thresholds.insufficientUSD));
        }
      }
    } catch (err: any) {
      console.error('Error loading admin data:', err);
      setStatusMessage({ type: 'error', text: 'Error al sincronizar datos administrativos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  // Comparador de equivalencias
  useEffect(() => {
    if (!selectedCommForCompare) {
      setCompareData(null);
      return;
    }
    fetch(`/api/admin/catalog/comparison/${selectedCommForCompare}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setCompareData({ commercial: data.commercial, equivalents: data.equivalents });
        }
      })
      .catch(console.warn);
  }, [selectedCommForCompare]);

  const handleSyncCatalog = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/services/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Sincronización completada: ${data.record.newServicesCount} nuevos, ${data.record.modifiedCount} modificados, ${data.record.totalFetched} total.`,
        });
        await loadAllAdminData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Error al sincronizar catálogo.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error de conexión.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckBalanceNow = async () => {
    setCheckingBalance(true);
    try {
      const res = await fetch('/api/admin/balance/check', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Saldo verificado: $${data.record.balance.toFixed(2)} USD (${data.record.status})`,
        });
        await loadAllAdminData();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleToggleCommercialService = async (serviceId: string, currentPublished: boolean) => {
    try {
      const res = await fetch(`/api/admin/catalog/commercial/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !currentPublished }),
      });
      const data = await res.json();
      if (data.success) {
        setCommercialServices(prev => prev.map(s => s.id === serviceId ? { ...s, published: !currentPublished } : s));
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error al actualizar: ${err.message}` });
    }
  };

  const handleAssignTechnicalService = async (commercialId: string, technicalServiceId: string) => {
    try {
      const res = await fetch(`/api/admin/catalog/commercial/${commercialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicalServiceId, manualProviderSelection: true }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Proveedor técnico reasignado correctamente.' });
        await loadAllAdminData();
        if (selectedCommForCompare === commercialId) {
          const ref = await fetch(`/api/admin/catalog/comparison/${commercialId}`).then(r => r.json());
          if (ref.success) setCompareData({ commercial: ref.commercial, equivalents: ref.equivalents });
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleRefreshOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.order) {
        setOrders(prev => prev.map(o => (o.id === orderId ? data.order : o)));
        setStatusMessage({ type: 'success', text: `Orden #${orderId} sincronizada con SystemFollows.` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/queue/${jobId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Trabajo programado para ejecución inmediata.' });
        await loadAllAdminData();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleReconcileOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileModalOrder || !reconcileExternalId.trim()) return;

    try {
      const res = await fetch(`/api/admin/orders/${reconcileModalOrder.id}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: reconcileExternalId.trim(),
          note: reconcileNote.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Orden #${reconcileModalOrder.id} reconciliada con éxito.` });
        setReconcileModalOrder(null);
        setReconcileExternalId('');
        setReconcileNote('');
        await loadAllAdminData();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleMarkNotificationResolved = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user?.email || 'admin' }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, resolved: true } : n));
      }
    } catch (err: any) {
      console.warn(err);
    }
  };

  const handleRunVerificationSuite = async () => {
    setRunningTests(true);
    setTestReport(null);
    try {
      const res = await fetch('/api/admin/tests/run', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.report) {
        setTestReport(data.report);
        setStatusMessage({
          type: 'success',
          text: `Suite ejecutada: ${data.report.passed}/${data.report.total} escenarios aprobados exitosamente.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Fallo al correr suite: ${err.message}` });
    } finally {
      setRunningTests(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usdClpRate: parseFloat(newFxRate),
          defaultGlobalMarginPercent: parseFloat(newMargin),
          freeBasePriceCLP: parseFloat(newFreeBaseCLP),
          freeMicroPriceCLP: parseFloat(newFreeMicroCLP),
          premiumBasePriceCLP: parseFloat(newPremiumBaseCLP),
          systemFollowsApiKey: newApiKey.trim() || undefined,
          flowEnvironment: newFlowEnv,
          flowApiKey: newFlowApiKey.trim() || undefined,
          flowSecretKey: newFlowSecretKey.trim() || undefined,
          thresholds: {
            lowUSD: parseFloat(lowUSD),
            criticalUSD: parseFloat(criticalUSD),
            insufficientUSD: parseFloat(insufficientUSD),
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Configuraciones, precios base y pasarela Flow actualizados.' });
        setNewApiKey('');
        setNewFlowApiKey('');
        setNewFlowSecretKey('');
        await loadAllAdminData();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleTestFlowConnection = async () => {
    setTestingFlow(true);
    setFlowTestResult(null);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/flow/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testEmail: flowTestEmail.trim(),
          amountCLP: parseInt(flowTestAmount, 10) || 500,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFlowTestResult(data);
        setStatusMessage({
          type: 'success',
          text: `Flow (${data.environment}) respondió OK. Orden de prueba #${data.flowOrder} lista para probar pago.`,
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Flow rechazó la prueba de conexión.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al probar Flow.' });
    } finally {
      setTestingFlow(false);
    }
  };

  const unreadNotifCount = notifications.filter(n => !n.read && !n.resolved).length;
  const criticalNotifCount = notifications.filter(n => n.level === 'CRITICAL' && !n.resolved).length;
  const pendingQueueCount = queueJobs.filter(j => j.status === 'PENDING' || j.status === 'RETRY' || j.status === 'REQUIRES_RECONCILIATION').length;

  return (
    <div className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Encabezado y Selector de Pestañas Superior */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>PotenciaRedes — Centro de Comando SMM</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Panel de Administración Integral
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestión inteligente de proveedores, control de saldo, dos niveles de catálogo, cola de pedidos y auditoría.
          </p>
        </div>

        {/* Botones de acción rápida */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncCatalog}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar SystemFollows'}</span>
          </button>

          <button
            onClick={handleCheckBalanceNow}
            disabled={checkingBalance}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>{checkingBalance ? 'Consultando...' : 'Revisar Saldo'}</span>
          </button>
        </div>
      </div>

      {/* Alerta de Estado */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs sm:text-sm flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Barra de Pestañas de Navegación */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl mb-8 overflow-x-auto scrollbar-none">
        
        <button
          onClick={() => setTab('metrics')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            tab === 'metrics' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard & Saldo</span>
        </button>

        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            tab === 'orders' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Pedidos ({orders.length})</span>
        </button>

        <button
          onClick={() => setTab('queue')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            tab === 'queue' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Cola de Pedidos</span>
          {pendingQueueCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
              {pendingQueueCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('commercial')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            tab === 'commercial' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Catálogo Comercial</span>
        </button>

        <button
          onClick={() => setTab('technical')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            tab === 'technical' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Catálogo Técnico SF</span>
        </button>

        <button
          onClick={() => setTab('comparator')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            tab === 'comparator' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <GitCompare className="w-4 h-4" />
          <span>Comparador Inteligente</span>
        </button>

        <button
          onClick={() => setTab('notifications')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            tab === 'notifications' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Centro de Notificaciones</span>
          {criticalNotifCount > 0 ? (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black animate-bounce">
              {criticalNotifCount}
            </span>
          ) : unreadNotifCount > 0 ? (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-orange-400 text-slate-950 font-black">
              {unreadNotifCount}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setTab('settings')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            tab === 'settings' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Ajustes & Tests</span>
        </button>

      </div>

      {/* ============================================================ */}
      {/* 1. DASHBOARD & SALDO */}
      {/* ============================================================ */}
      {tab === 'metrics' && (
        <div className="space-y-6">
          
          {/* Tarjetas Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Saldo Proveedor con Semáforo de Umbral */}
            <div className={`border rounded-2xl p-5 ${
              balanceStatus?.status === 'INSUFFICIENT' || balanceStatus?.status === 'CRITICAL'
                ? 'bg-rose-950/30 border-rose-500/40'
                : balanceStatus?.status === 'LOW'
                ? 'bg-amber-950/20 border-amber-500/30'
                : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo SystemFollows</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  balanceStatus?.status === 'NORMAL'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : balanceStatus?.status === 'LOW'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-rose-500/10 text-rose-400 animate-pulse'
                }`}>
                  {balanceStatus?.status || 'NORMAL'}
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-white">
                {balanceStatus?.currentBalance !== null ? `$${balanceStatus?.currentBalance?.toFixed(2)} USD` : '$0.00 USD'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Última consulta: {formatChileanDate(balanceStatus?.lastCheckTime || '')}
              </p>
            </div>

            {/* Ventas Hoy */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Ventas Hoy</span>
              <p className="text-2xl sm:text-3xl font-black text-white">
                {formatCLP(metrics?.financial?.salesTodayCLP || 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Pesos Chilenos (CLP)</p>
            </div>

            {/* Ganancia Neta */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Ganancia Neta Estimada</span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400">
                {formatCLP(metrics?.financial?.totalNetProfitCLP || 0)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Margen comercial consolidado</p>
            </div>

            {/* Pedidos en Cola / Espera de Saldo */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Esperando Saldo / Cola</span>
                <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                  {metrics?.financial?.waitingBalanceCount || 0}
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-orange-400">
                {metrics?.financial?.waitingBalanceCount || 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Pedidos pagados retenidos de forma segura</p>
            </div>

          </div>

          {/* Historial de Saldo y Métricas Detalladas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Control y Umbrales de Saldo */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Monitoreo de Saldo y Umbrales de Seguridad</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Si el saldo mayorista desciende bajo el umbral mínimo, los pedidos pagados ingresan a la cola <code>PAID_WAITING_PROVIDER_BALANCE</code> para proteger los fondos.
              </p>

              <div className="space-y-3 text-xs mb-6">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Umbral Alerta Normal:</span>
                  <span className="font-bold text-emerald-400">&gt; ${balanceStatus?.thresholds?.lowUSD} USD</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Umbral Alerta Baja (Warning):</span>
                  <span className="font-bold text-amber-400">${balanceStatus?.thresholds?.criticalUSD} a ${balanceStatus?.thresholds?.lowUSD} USD</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Umbral Saldo Insuficiente (Critical):</span>
                  <span className="font-bold text-rose-400">&lt; ${balanceStatus?.thresholds?.insufficientUSD} USD</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Última recarga o consulta exitosa:</span>
                  <span className="font-mono text-white">{formatChileanDate(balanceStatus?.lastSuccessfulTime || '')}</span>
                </div>
              </div>

              {/* Historial Reciente de Saldo */}
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Historial Reciente de Consultas de Saldo
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {balanceStatus?.history?.map((rec: any) => (
                  <div key={rec.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rec.success ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                      <span className="font-mono font-bold text-white">${rec.balance?.toFixed(2)} USD</span>
                      <span className="text-slate-500">• {rec.status}</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">{formatChileanDate(rec.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen de Catálogo y Modalidades */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Layers className="w-5 h-5 text-orange-400" />
                <span>Estado de los Catálogos y Modalidades</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Separación entre el catálogo técnico de proveedores y el catálogo comercial de PotenciaRedes.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 text-[11px] block">Servicios Técnicos SF:</span>
                  <span className="text-xl font-bold text-white">{technicalServices.length}</span>
                  <span className="text-[10px] text-emerald-400 block mt-0.5">
                    {technicalServices.filter(t => t.available).length} disponibles
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 text-[11px] block">Servicios Comerciales:</span>
                  <span className="text-xl font-bold text-white">{commercialServices.length}</span>
                  <span className="text-[10px] text-sky-400 block mt-0.5">
                    {commercialServices.filter(c => c.published).length} publicados
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Plan Free (Ruta Más Barata)
                  </span>
                  <span className="font-bold text-white">{commercialServices.filter(c => c.tier === 'FREE').length} servicios</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" /> Plan Premium (Con Reposición 30d)
                  </span>
                  <span className="font-bold text-white">{commercialServices.filter(c => c.tier === 'PREMIUM').length} servicios</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 2. GESTIÓN DE PEDIDOS */}
      {/* ============================================================ */}
      {tab === 'orders' && (
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Buscar por ID, cliente, URL, servicio..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl py-1.5 px-3 outline-none"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PAID_WAITING_PROVIDER_BALANCE">Esperando Saldo</option>
                <option value="REQUIRES_RECONCILIATION">Requiere Reconciliación</option>
                <option value="IN_PROGRESS">En Proceso</option>
                <option value="COMPLETED">Completados</option>
                <option value="AWAITING_PAYMENT">Esperando Pago</option>
                <option value="FAILED">Fallidos</option>
              </select>

              <button
                onClick={loadAllAdminData}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                title="Refrescar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">ID Interno / Proveedor</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Servicio & Destino</th>
                  <th className="p-3.5 text-right">Cantidad</th>
                  <th className="p-3.5 text-right">Precio CLP</th>
                  <th className="p-3.5 text-right">Ganancia</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {orders
                  .filter(o => {
                    if (orderStatusFilter !== 'ALL' && o.status !== orderStatusFilter) return false;
                    if (orderSearch.trim()) {
                      const q = orderSearch.toLowerCase();
                      return o.id.toLowerCase().includes(q) || (o.providerOrderId && o.providerOrderId.toLowerCase().includes(q)) || o.userEmail.toLowerCase().includes(q) || o.targetUrl.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(order => (
                    <tr key={order.id} className="hover:bg-slate-850/60 transition-colors">
                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-white">{order.id}</div>
                        <div className="text-[10px] text-slate-500">Ext: {order.providerOrderId || 'Sin ID'}</div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-slate-400">
                        {formatChileanDate(order.createdAt)}
                      </td>

                      <td className="p-3.5">
                        <div className="font-medium text-white truncate max-w-[130px]">{order.userEmail}</div>
                        <div className="text-[10px] text-slate-500">{order.paymentGateway === 'FLOW' ? 'Flow Chile' : (order.paymentGateway || 'Flow Chile')}</div>
                      </td>

                      <td className="p-3.5 max-w-[200px]">
                        <div className="font-bold text-white truncate">{order.serviceName}</div>
                        <div className="text-[11px] text-orange-400 truncate">{order.targetUrl}</div>
                      </td>

                      <td className="p-3.5 text-right font-bold text-white">
                        {order.quantity.toLocaleString('es-CL')}
                      </td>

                      <td className="p-3.5 text-right font-bold text-white">
                        {formatCLP(order.totalPriceCLP)}
                      </td>

                      <td className="p-3.5 text-right font-bold text-emerald-400">
                        {formatCLP(order.estimatedGrossProfitCLP || 0)}
                      </td>

                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : order.status === 'IN_PROGRESS'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : order.status === 'PAID_WAITING_PROVIDER_BALANCE'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse'
                            : order.status === 'REQUIRES_RECONCILIATION'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {order.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {order.status === 'REQUIRES_RECONCILIATION' && (
                            <button
                              onClick={() => {
                                setReconcileModalOrder(order);
                                setReconcileExternalId('');
                              }}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                            >
                              Reconciliar
                            </button>
                          )}
                          <button
                            onClick={() => handleRefreshOrder(order.id)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                            title="Refrescar estado"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 3. COLA PERSISTENTE (JOB QUEUE) */}
      {/* ============================================================ */}
      {tab === 'queue' && (
        <div className="space-y-4">
          
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Cola Persistente de Ejecución y Resiliencia (job_queue)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Almacena pedidos pagados que esperan saldo en el proveedor o que requirieron reintento seguro con backoff exponencial.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={queueStatusFilter}
                onChange={(e) => setQueueStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl py-1.5 px-3 outline-none"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PENDING">PENDING</option>
                <option value="RETRY">RETRY</option>
                <option value="REQUIRES_RECONCILIATION">REQUIRES_RECONCILIATION</option>
                <option value="DEAD_LETTER">DEAD_LETTER</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>

              <button
                onClick={loadAllAdminData}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Trabajo / Orden</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Intentos</th>
                  <th className="p-3.5">Próxima Ejecución</th>
                  <th className="p-3.5">Último Error / Motivo</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {queueJobs
                  .filter(j => queueStatusFilter === 'ALL' || j.status === queueStatusFilter)
                  .map(job => (
                    <tr key={job.id} className="hover:bg-slate-850/60">
                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-white">{job.id}</div>
                        <div className="text-[10px] text-orange-400">Orden: #{job.orderId}</div>
                      </td>

                      <td className="p-3.5 font-bold text-slate-300">
                        {job.type}
                      </td>

                      <td className="p-3.5 font-medium">
                        {job.attempts} / {job.maxAttempts}
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-slate-400">
                        {formatChileanDate(job.nextRunAt)}
                      </td>

                      <td className="p-3.5 max-w-[260px]">
                        <span className="text-[11px] text-rose-300 line-clamp-2">
                          {job.lastError || 'En espera de programación'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          job.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : job.status === 'REQUIRES_RECONCILIATION'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            : job.status === 'DEAD_LETTER'
                            ? 'bg-rose-950 text-rose-400'
                            : 'bg-amber-500/10 text-amber-300'
                        }`}>
                          {job.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        {job.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-rose-600 text-white font-bold rounded-lg text-[10px] hover:brightness-110 cursor-pointer"
                          >
                            Reintentar Ya
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 4. CATÁLOGO COMERCIAL & MODALIDADES */}
      {/* ============================================================ */}
      {tab === 'commercial' && (
        <div className="space-y-4">
          
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Catálogo Comercial de PotenciaRedes (Nivel 2)</h3>
              <p className="text-xs text-slate-400">
                Determina exactamente lo que visualizan los clientes en la tienda: nombres, planes (Plan Free y Plan Premium con reposición), publicación y precios en CLP.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={commPlatform}
                onChange={(e) => setCommPlatform(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl py-1.5 px-3 outline-none"
              >
                <option value="TODOS">Todas las redes</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="YouTube">YouTube</option>
                <option value="Spotify">Spotify</option>
                <option value="Facebook">Facebook</option>
                <option value="X">X (Twitter)</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Plataforma</th>
                  <th className="p-3.5">Plan</th>
                  <th className="p-3.5">Nombre Comercial</th>
                  <th className="p-3.5">Servicio Técnico Asociado</th>
                  <th className="p-3.5 text-right">Costo USD</th>
                  <th className="p-3.5 text-right">Precio CLP (1k)</th>
                  <th className="p-3.5 text-center">Refill 30d</th>
                  <th className="p-3.5 text-center">Publicado</th>
                  <th className="p-3.5 text-center">Comparar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {commercialServices
                  .filter(c => commPlatform === 'TODOS' || c.platform.toLowerCase() === commPlatform.toLowerCase())
                  .map(s => (
                    <tr key={s.id} className="hover:bg-slate-850/60 transition-colors">
                      <td className="p-3.5 font-bold text-orange-400">{s.platform}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.tier === 'PREMIUM'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {s.tier}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-[240px]">
                        <div className="font-bold text-white line-clamp-1">{s.commercialName}</div>
                        <div className="text-[10px] text-slate-500">{s.commercialCategory}</div>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-400">
                        {s.technicalServiceId}
                        {s.manualProviderSelection && (
                          <span className="ml-1 text-[9px] bg-slate-800 text-orange-400 px-1 py-0.2 rounded font-sans">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-300">
                        {formatUSD(s.originalRateUSD)}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-400">
                        {formatCLP(s.commercialRateCLP)}
                      </td>
                      <td className="p-3.5 text-center">
                        {s.refill ? <span className="text-emerald-400 font-bold">✓ 30d</span> : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggleCommercialService(s.id, s.published)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            s.published
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {s.published ? 'Visible' : 'Oculto'}
                        </button>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedCommForCompare(s.id);
                            setTab('comparator');
                          }}
                          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                          title="Comparar alternativas técnicas"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 5. CATÁLOGO TÉCNICO ORIGINAL DE SYSTEMFOLLOWS */}
      {/* ============================================================ */}
      {tab === 'technical' && (
        <div className="space-y-4">
          
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Catálogo Técnico de Proveedores (Nivel 1)</h3>
              <p className="text-xs text-slate-400">
                Almacena todos los servicios importados desde las APIs mayoristas con su estado de sincronización y registro de cambios histórico.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={techPlatform}
                onChange={(e) => setTechPlatform(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl py-1.5 px-3 outline-none"
              >
                <option value="TODOS">Todas las redes</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="YouTube">YouTube</option>
                <option value="Spotify">Spotify</option>
                <option value="Facebook">Facebook</option>
                <option value="X">X (Twitter)</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">ID Técnico</th>
                  <th className="p-3.5">Red Social</th>
                  <th className="p-3.5">Nombre Original del Proveedor</th>
                  <th className="p-3.5 text-right">Costo USD (1k)</th>
                  <th className="p-3.5 text-right">Límites (Mín/Máx)</th>
                  <th className="p-3.5 text-center">Refill</th>
                  <th className="p-3.5 text-center">Sync Status</th>
                  <th className="p-3.5 text-center">Disponibilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {technicalServices
                  .filter(t => techPlatform === 'TODOS' || t.platform.toLowerCase() === techPlatform.toLowerCase())
                  .map(t => (
                    <tr key={t.id} className="hover:bg-slate-850/60">
                      <td className="p-3.5 font-mono text-slate-400">{t.id}</td>
                      <td className="p-3.5 font-bold text-orange-400">{t.platform}</td>
                      <td className="p-3.5 max-w-[280px]">
                        <div className="font-bold text-white line-clamp-1">{t.name}</div>
                        <div className="text-[10px] text-slate-500">{t.category}</div>
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-300">{formatUSD(t.rateUSD)}</td>
                      <td className="p-3.5 text-right text-slate-400">
                        {t.minQuantity.toLocaleString('es-CL')} / {t.maxQuantity.toLocaleString('es-CL')}
                      </td>
                      <td className="p-3.5 text-center">
                        {t.refill ? <span className="text-emerald-400 font-bold">✓ Refill</span> : <span className="text-slate-600">-</span>}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.syncStatus === 'SYNCED'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : t.syncStatus === 'MODIFIED'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {t.syncStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${t.available ? 'bg-emerald-400' : 'bg-rose-500'}`} title={t.available ? 'Disponible' : 'No disponible'}></span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 6. COMPARADOR INTELIGENTE DE PROVEEDORES */}
      {/* ============================================================ */}
      {tab === 'comparator' && (
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-orange-400" />
              <span>Comparador de Equivalencias y Selección de Proveedores</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Selecciona un servicio comercial para evaluar todas las alternativas técnicas disponibles, comparar tarifas y condiciones de refill, y reasignar el proveedor con un clic.
            </p>

            <div className="max-w-md mb-6">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Selecciona Servicio Comercial a comparar:
              </label>
              <select
                value={selectedCommForCompare}
                onChange={(e) => setSelectedCommForCompare(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 outline-none focus:border-rose-500"
              >
                <option value="">-- Elige un servicio comercial --</option>
                {commercialServices.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.platform}] {c.commercialName} ({c.tier})
                  </option>
                ))}
              </select>
            </div>

            {compareData && compareData.commercial && (
              <div className="space-y-4">
                
                {/* Resumen del Servicio Comercial Seleccionado */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">
                      Servicio Comercial Activo:
                    </span>
                    <h4 className="text-sm font-bold text-white">{compareData.commercial.commercialName}</h4>
                    <p className="text-xs text-slate-400">
                      Modalidad: <strong className="text-white">{compareData.commercial.tier}</strong> • Proveedor actual: <strong className="text-slate-300">{compareData.commercial.technicalServiceId}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Tarifa comercial:</span>
                    <span className="text-lg font-black text-emerald-400">{formatCLP(compareData.commercial.commercialRateCLP)}</span>
                  </div>
                </div>

                {/* Tabla Comparativa de Alternativas Técnicas */}
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-2">
                  Alternativas Técnicas Equivalentes ({compareData.equivalents.length})
                </h4>

                {compareData.equivalents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No se detectaron alternativas equivalentes adicionales para esta categoría.</p>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800">
                        <tr>
                          <th className="p-3">ID Técnico</th>
                          <th className="p-3">Nombre Original</th>
                          <th className="p-3 text-right">Costo USD (1k)</th>
                          <th className="p-3 text-right">Costo CLP (1k)</th>
                          <th className="p-3 text-center">Refill 30d</th>
                          <th className="p-3 text-center">Estado</th>
                          <th className="p-3 text-center">Asignación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {compareData.equivalents.map(eq => {
                          const isCurrent = eq.id === compareData.commercial?.technicalServiceId;
                          return (
                            <tr key={eq.id} className={isCurrent ? 'bg-orange-500/10' : ''}>
                              <td className="p-3 font-mono font-bold text-white">{eq.id}</td>
                              <td className="p-3 max-w-[260px]">
                                <div className="font-semibold text-white truncate">{eq.name}</div>
                                <div className="text-[10px] text-slate-500">Mín: {eq.minQuantity} / Máx: {eq.maxQuantity}</div>
                              </td>
                              <td className="p-3 text-right font-mono text-slate-300">{formatUSD(eq.rateUSD)}</td>
                              <td className="p-3 text-right font-bold text-white">
                                {formatCLP(Math.round(eq.rateUSD * (settings?.usdClpRate || 950)))}
                              </td>
                              <td className="p-3 text-center">
                                {eq.refill ? <span className="text-emerald-400 font-bold">✓ Sí</span> : <span className="text-slate-600">No</span>}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${eq.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                  {eq.available ? 'Disponible' : 'Inactivo'}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {isCurrent ? (
                                  <span className="px-2 py-1 rounded bg-orange-500 text-slate-950 font-bold text-[10px]">
                                    ACTUAL
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleAssignTechnicalService(compareData.commercial!.id, eq.id)}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-semibold cursor-pointer"
                                  >
                                    Asignar Este
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 7. CENTRO DE NOTIFICACIONES */}
      {/* ============================================================ */}
      {tab === 'notifications' && (
        <div className="space-y-4">
          
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-rose-500" />
                <span>Centro de Notificaciones e Incidencias Administrativas</span>
              </h3>
              <p className="text-xs text-slate-400">
                Supervisión de eventos clasificados en Críticas, Advertencias e Informativas con deduplicación de alertas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={notifLevelFilter}
                onChange={(e) => setNotifLevelFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl py-1.5 px-3 outline-none"
              >
                <option value="ALL">Todos los Niveles</option>
                <option value="CRITICAL">🚨 Críticas</option>
                <option value="WARNING">⚠️ Advertencias</option>
                <option value="INFO">ℹ️ Informativas</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            {notifications
              .filter(n => notifLevelFilter === 'ALL' || n.level === notifLevelFilter)
              .map(n => (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    n.resolved
                      ? 'bg-slate-900/40 border-slate-800 opacity-60'
                      : n.level === 'CRITICAL'
                      ? 'bg-rose-950/25 border-rose-500/40'
                      : n.level === 'WARNING'
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          n.level === 'CRITICAL'
                            ? 'bg-rose-500 text-white'
                            : n.level === 'WARNING'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-sky-500/20 text-sky-400'
                        }`}>
                          {n.level}
                        </span>
                        {n.count && n.count > 1 && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-bold">
                            {n.count} ocurrencias
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{formatChileanDate(n.createdAt)}</span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{n.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{n.description}</p>
                      
                      {n.recommendedAction && (
                        <div className="mt-2 text-[11px] text-amber-300/90 font-medium">
                          <strong>Acción recomendada:</strong> {n.recommendedAction}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {!n.resolved ? (
                        <button
                          onClick={() => handleMarkNotificationResolved(n.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-900/40 text-emerald-400 border border-slate-700 hover:border-emerald-500/40 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Resolver Incidencia
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">✓ Resuelta</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* 8. AJUSTES & SUITE DE PRUEBAS */}
      {/* ============================================================ */}
      {tab === 'settings' && (
        <div className="space-y-8">
          
          {/* Suite de Pruebas Automatizada (20 Escenarios de Resiliencia) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-emerald-400" />
                  <span>Suite de Verificación y Resiliencia del Sistema (20 Escenarios)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Valida programáticamente los 20 escenarios obligatorios: detección de cambios, saldo insuficiente, cola de pedidos pagados, reintentos, reconciliación y alertas.
                </p>
              </div>

              <button
                onClick={handleRunVerificationSuite}
                disabled={runningTests}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                <PlayCircle className={`w-4 h-4 ${runningTests ? 'animate-spin' : ''}`} />
                <span>{runningTests ? 'Ejecutando Pruebas...' : 'Ejecutar los 20 Escenarios'}</span>
              </button>
            </div>

            {testReport && (
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <span className="font-bold text-white">Resultado Consolidado:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">✓ {testReport.passed} Aprobados</span>
                    <span className="text-rose-400 font-bold">✗ {testReport.failed} Fallados</span>
                    <span className="text-slate-400 font-mono">Total: {testReport.total}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                  {testReport.results.map(r => (
                    <div key={r.scenarioNumber} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-200">
                          #{r.scenarioNumber}. {r.title}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                          r.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {r.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{r.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ajustes Generales y Umbrales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-orange-400" />
                <span>Configuración de Precios y Proveedor</span>
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Cotización USD / CLP</label>
                  <input
                    type="number"
                    value={newFxRate}
                    onChange={(e) => setNewFxRate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Margen Comercial Base (%)</label>
                  <input
                    type="number"
                    value={newMargin}
                    onChange={(e) => setNewMargin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-200">Precios Base por Plan (CLP x 1.000)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Free Seguidores</label>
                      <input
                        type="number"
                        value={newFreeBaseCLP}
                        onChange={(e) => setNewFreeBaseCLP(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Free Likes/Vistas</label>
                      <input
                        type="number"
                        value={newFreeMicroCLP}
                        onChange={(e) => setNewFreeMicroCLP(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Premium (Reposición)</label>
                      <input
                        type="number"
                        value={newPremiumBaseCLP}
                        onChange={(e) => setNewPremiumBaseCLP(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nueva API Key de SystemFollows</label>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="Dejar vacío para conservar actual"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-200">Pasarela Flow.cl (API REST v3)</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      settings?.flowConfigured
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {settings?.flowConfigured ? `Activa (${settings?.flowEnvironment || 'PRODUCTION'})` : 'Sin Configurar'}
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Ambiente Flow</label>
                    <select
                      value={newFlowEnv}
                      onChange={(e) => setNewFlowEnv(e.target.value === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                    >
                      <option value="PRODUCTION">PRODUCTION (www.flow.cl)</option>
                      <option value="SANDBOX">SANDBOX (sandbox.flow.cl)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Nueva Flow API Key</label>
                      <input
                        type="password"
                        value={newFlowApiKey}
                        onChange={(e) => setNewFlowApiKey(e.target.value)}
                        placeholder="Conservar actual"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Nuevo Flow Secret Key</label>
                      <input
                        type="password"
                        value={newFlowSecretKey}
                        onChange={(e) => setNewFlowSecretKey(e.target.value)}
                        placeholder="Conservar actual"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <h4 className="font-bold text-slate-200 mb-3">Umbrales de Saldo Mayorista (USD)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Bajo (Warning)</label>
                      <input
                        type="number"
                        value={lowUSD}
                        onChange={(e) => setLowUSD(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Crítico</label>
                      <input
                        type="number"
                        value={criticalUSD}
                        onChange={(e) => setCriticalUSD(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Insuficiente</label>
                      <input
                        type="number"
                        value={insufficientUSD}
                        onChange={(e) => setInsufficientUSD(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white font-bold rounded-xl cursor-pointer"
                >
                  Guardar Parámetros
                </button>
              </form>
            </div>

            <div className="space-y-6">
              {/* Prueba en Vivo de Integración Flow */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Probar Pago e Integración Flow.cl</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Genera una orden de prueba firmada con Flow ({settings?.flowEnvironment || 'PRODUCTION'}) y verifica al instante creación, firma HMAC-SHA256, <code>getStatus</code> y URLs de confirmación.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Correo de prueba (MX válido)</label>
                    <input
                      type="email"
                      value={flowTestEmail}
                      onChange={(e) => setFlowTestEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Monto prueba CLP (mín. $350)</label>
                    <input
                      type="number"
                      min={350}
                      max={20000}
                      value={flowTestAmount}
                      onChange={(e) => setFlowTestAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestFlowConnection}
                  disabled={testingFlow}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                >
                  {testingFlow ? 'Probando comunicación con Flow...' : 'Probar Conexión y Crear Orden de Prueba Flow'}
                </button>

                {flowTestResult && (
                  <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-emerald-500/30 text-[11px] space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ambiente / FlowOrder:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {flowTestResult.environment} • #{flowTestResult.flowOrder}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Verificación getStatus:</span>
                      <span className="font-bold text-white">{flowTestResult.getStatusVerified}</span>
                    </div>
                    <div className="text-slate-400 truncate">
                      <span>Webhook: </span>
                      <span className="font-mono text-slate-300">{flowTestResult.confirmationUrl}</span>
                    </div>
                    {flowTestResult.url && flowTestResult.token && (
                      <form method="GET" action={flowTestResult.url} target="_blank" rel="noopener noreferrer" className="pt-1.5">
                        <input type="hidden" name="token" value={flowTestResult.token} />
                        <button
                          type="submit"
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir Checkout de Prueba en Flow ({formatCLP(flowTestResult.amountCLP)})</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Historial de Sincronizaciones */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-400" />
                  <span>Historial de Sincronizaciones con Proveedores</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Registro de eventos de actualización, altas de servicios y detecciones de discontinuidad.
                </p>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
                  {syncHistory.map(h => (
                    <div key={h.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white">{h.provider}</span>
                        <span className="text-[11px] text-slate-400">{formatChileanDate(h.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>Total: <strong className="text-white">{h.totalFetched}</strong></span>
                        <span className="text-emerald-400 font-bold">+{h.newServicesCount} nuevos</span>
                        <span className="text-amber-400 font-bold">{h.modifiedCount} cambios</span>
                        {h.missingCount > 0 && (
                          <span className="text-rose-400 font-bold">{h.missingCount} desaparecidos</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Modal de Reconciliación Manual */}
      {reconcileModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Reconciliar Orden #{reconcileModalOrder.id}</h3>
            <p className="text-xs text-slate-400 mb-4">
              Ingresa el identificador de orden retornado por SystemFollows tras verificar que la orden fue recibida o creada manualmente.
            </p>

            <form onSubmit={handleReconcileOrder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ID Externo Proveedor:</label>
                <input
                  type="text"
                  required
                  value={reconcileExternalId}
                  onChange={(e) => setReconcileExternalId(e.target.value)}
                  placeholder="Ej: 1428592"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nota de Auditoría:</label>
                <input
                  type="text"
                  value={reconcileNote}
                  onChange={(e) => setReconcileNote(e.target.value)}
                  placeholder="Ej: Verificado por panel de soporte mayorista"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReconcileModalOrder(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-xl cursor-pointer"
                >
                  Confirmar Reconciliación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
