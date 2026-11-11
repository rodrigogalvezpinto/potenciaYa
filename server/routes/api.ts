import { Router, Request, Response } from 'express';
import { catalogService } from '../services/catalogService.ts';
import { pricingEngine } from '../services/pricingEngine.ts';
import { orderService } from '../services/orderService.ts';
import { balanceService } from '../services/balanceService.ts';
import { jobQueueService } from '../services/jobQueueService.ts';
import { notificationService } from '../services/notificationService.ts';
import { verificationSuite } from '../tests/verificationSuite.ts';
import { webpayProvider } from '../providers/payments/webpay.ts';
import { mercadoPagoProvider } from '../providers/payments/mercadopago.ts';
import { systemFollowsProvider } from '../providers/smm/systemFollows.ts';
import { config } from '../config.ts';
import { adminFirestore } from '../firebaseAdmin.ts';

export const apiRouter = Router();

// Cargar configuraciones persistidas desde Firestore al inicio
async function loadSettingsFromFirestore() {
  try {
    const doc = await adminFirestore.collection('settings').doc('global').get();
    if (doc.exists) {
      const data = doc.data();
      if (data) {
        if (data.usdClpRate) pricingEngine.setExchangeRate(Number(data.usdClpRate));
        if (data.defaultGlobalMarginPercent) pricingEngine.setDefaultMargin(Number(data.defaultGlobalMarginPercent));
        if (data.systemFollowsApiKey) systemFollowsProvider.updateCredentials(String(data.systemFollowsApiKey));
        if (data.thresholds) balanceService.setThresholds(data.thresholds);
        console.log('✅ Configuraciones globales cargadas desde Firestore.');
      }
    }
  } catch (err: any) {
    console.warn('Settings Firestore read notice:', err.message);
  }
}
loadSettingsFromFirestore().catch(console.warn);

// -------------------------------------------------------------
// HEALTHCHECK & ESTADO PÚBLICO
// -------------------------------------------------------------
apiRouter.get('/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'PotenciaRedes',
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
    currency: 'CLP',
    timezone: 'America/Santiago',
    pricing: {
      usdClpRate: pricingEngine.getExchangeRate(),
      defaultMarginPercent: pricingEngine.getDefaultMargin(),
    },
    balance: balanceService.getStatus(),
    integrations: {
      systemFollowsConfigured: systemFollowsProvider.isConfigured(),
      webpayEnvironment: config.webpay.environment,
      mercadopagoEnvironment: config.mercadopago.environment,
    },
    notificationsCount: notificationService.getCounts(),
    queueCount: jobQueueService.getCounts(),
  });
});

// -------------------------------------------------------------
// CATÁLOGO COMERCIAL PÚBLICO (Nivel 2)
// -------------------------------------------------------------
apiRouter.get('/catalog', (req: Request, res: Response) => {
  try {
    const { platform, commercialCategory, tier, search } = req.query;
    const services = catalogService.getCommercialServices({
      platform: platform ? String(platform) : undefined,
      commercialCategory: commercialCategory ? String(commercialCategory) : undefined,
      tier: tier ? (String(tier) as any) : undefined,
      search: search ? String(search) : undefined,
      onlyPublished: true,
    });
    res.json({
      success: true,
      total: services.length,
      exchangeRateCLP: pricingEngine.getExchangeRate(),
      services,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/catalog/:id', (req: Request, res: Response) => {
  try {
    const service = catalogService.getCommercialServiceById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Servicio comercial no encontrado' });
    }
    res.json({ success: true, service });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cotización comercial en vivo
apiRouter.post('/pricing/quote', (req: Request, res: Response) => {
  try {
    const { serviceId, quantity, gateway } = req.body;
    const commService = catalogService.getCommercialServiceById(String(serviceId));
    let originalRateUSD = 1.5;
    let serviceName = 'Servicio';
    let platform = 'Instagram';

    if (commService) {
      originalRateUSD = commService.originalRateUSD;
      serviceName = commService.commercialName;
      platform = commService.platform;
    } else {
      const techService = catalogService.getTechnicalServiceById(String(serviceId));
      if (techService) {
        originalRateUSD = techService.rateUSD;
        serviceName = techService.name;
        platform = techService.platform;
      } else {
        return res.status(404).json({ success: false, error: 'Servicio no encontrado' });
      }
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Cantidad inválida' });
    }

    const calculation = pricingEngine.calculate(
      originalRateUSD,
      qty,
      serviceId,
      platform,
      gateway === 'MERCADO_PAGO' ? 'MERCADOPAGO' : 'WEBPAY'
    );

    res.json({
      success: true,
      service: {
        id: serviceId,
        name: serviceName,
        platform,
      },
      quote: calculation,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// PEDIDOS Y PAGOS
// -------------------------------------------------------------
apiRouter.post('/orders/draft', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, serviceId, targetUrl, quantity, gateway } = req.body;

    if (!serviceId || !targetUrl || !quantity) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos para la orden' });
    }

    const effectiveUserId = userId || 'anonymous-guest';
    const effectiveUserEmail = userEmail || 'cliente@potenciaredes.cl';

    const { order, priceCalc } = await orderService.createDraftOrder({
      userId: effectiveUserId,
      userEmail: effectiveUserEmail,
      serviceId: String(serviceId),
      targetUrl: String(targetUrl),
      quantity: parseInt(quantity, 10),
      gateway: gateway === 'MERCADO_PAGO' ? 'MERCADO_PAGO' : 'WEBPAY_PLUS',
    });

    res.json({
      success: true,
      order,
      priceCalc,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

apiRouter.post('/payments/webpay/create', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const order = orderService.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Orden comercial no encontrada' });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const returnUrl = `${protocol}://${host}/checkout/webpay-return?orderId=${order.id}`;

    const paymentResult = await webpayProvider.createPayment({
      orderId: order.id,
      amountCLP: order.totalPriceCLP,
      userEmail: order.userEmail,
      serviceTitle: order.serviceName,
      returnUrl,
    });

    res.json({
      success: true,
      payment: paymentResult,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/payments/webpay/commit', async (req: Request, res: Response) => {
  try {
    const { token, orderId } = req.body;
    if (!token && !orderId) {
      return res.status(400).json({ success: false, error: 'Token de Webpay requerido' });
    }

    const confirmRes = await webpayProvider.confirmPayment(token || 'TBK-MOCK-SANDBOX');
    const targetOrderId = orderId || confirmRes.orderId;
    const existingOrder = orderService.getOrder(targetOrderId);

    // Verificación estricta de monto para evitar discrepancias o fraude
    if (confirmRes.amountCLP > 0 && existingOrder && confirmRes.amountCLP < existingOrder.totalPriceCLP) {
      return res.status(400).json({
        success: false,
        status: 'REJECTED',
        error: `El monto pagado (${confirmRes.amountCLP} CLP) es menor al valor de la orden (${existingOrder.totalPriceCLP} CLP).`,
      });
    }

    if (confirmRes.status === 'APPROVED') {
      const updatedOrder = await orderService.handlePaymentSuccess(targetOrderId, {
        paymentId: confirmRes.paymentId,
        authorizationCode: confirmRes.authorizationCode,
        gateway: 'WEBPAY_PLUS',
      });
      return res.json({
        success: true,
        status: 'APPROVED',
        order: updatedOrder,
        confirmation: confirmRes,
      });
    }

    res.json({
      success: false,
      status: confirmRes.status,
      message: 'La transacción no fue aprobada por el emisor bancario.',
      confirmation: confirmRes,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirmación de pago realizado en portal oficial Webpay.cl (idFormulario 436254 / company 186612)
apiRouter.post('/payments/webpay/portal-confirm', async (req: Request, res: Response) => {
  try {
    const { orderId, authorizationCode } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId es requerido' });
    }
    const order = orderService.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Orden comercial no encontrada' });
    }

    const authCode = authorizationCode ? String(authorizationCode).trim() : `WPY-${Date.now().toString().slice(-6)}`;
    const updatedOrder = await orderService.handlePaymentSuccess(orderId, {
      paymentId: `WPY-PORTAL-${Date.now()}`,
      authorizationCode: authCode,
      gateway: 'WEBPAY_PLUS',
    });

    res.json({
      success: true,
      status: 'APPROVED',
      order: updatedOrder,
      message: 'Pago de Webpay.cl confirmado exitosamente. Tu orden ha sido despachada.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/payments/mercadopago/create', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const order = orderService.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const returnUrl = `${protocol}://${host}/checkout/mercadopago-return?orderId=${order.id}`;

    const paymentResult = await mercadoPagoProvider.createPayment({
      orderId: order.id,
      amountCLP: order.totalPriceCLP,
      userEmail: order.userEmail,
      serviceTitle: order.serviceName,
      returnUrl,
    });

    res.json({
      success: true,
      payment: paymentResult,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/payments/mercadopago/confirm', async (req: Request, res: Response) => {
  try {
    const { orderId, preferenceId } = req.body;
    const confirmRes = await mercadoPagoProvider.confirmPayment(preferenceId || 'MP-PREF-MOCK');

    if (confirmRes.status === 'APPROVED') {
      const updatedOrder = await orderService.handlePaymentSuccess(orderId, {
        paymentId: confirmRes.paymentId,
        authorizationCode: confirmRes.authorizationCode,
        gateway: 'MERCADO_PAGO',
      });
      return res.json({
        success: true,
        status: 'APPROVED',
        order: updatedOrder,
      });
    }

    res.json({
      success: false,
      status: confirmRes.status,
      message: 'El pago no ha sido aprobado aún.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pedidos de usuario
apiRouter.get('/orders/user/:userId', (req: Request, res: Response) => {
  try {
    const orders = orderService.getUserOrders(req.params.userId);
    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Búsqueda de pedidos por ID, correo o referencia externa (público para clientes e invitados)
apiRouter.get('/orders/lookup', (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Término de búsqueda requerido' });
    }
    const orders = orderService.findOrderByQuery(query);
    res.json({ success: true, total: orders.length, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/orders/:orderId', (req: Request, res: Response) => {
  try {
    const order = orderService.getOrder(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/orders/:orderId/refresh', async (req: Request, res: Response) => {
  try {
    const updated = await orderService.refreshOrderStatus(req.params.orderId);
    res.json({ success: true, order: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/orders/:orderId/refill', async (req: Request, res: Response) => {
  try {
    const { userId, isAdmin } = req.body;
    const result = await orderService.requestRefill(req.params.orderId, userId, Boolean(isAdmin));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

apiRouter.post('/orders/:orderId/cancel', async (req: Request, res: Response) => {
  try {
    const result = await orderService.cancelOrder(req.params.orderId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Reconciliación manual de orden
apiRouter.post('/admin/orders/:orderId/reconcile', async (req: Request, res: Response) => {
  try {
    const { externalId, note } = req.body;
    if (!externalId) {
      return res.status(400).json({ success: false, error: 'ID externo de proveedor requerido para reconciliar' });
    }
    const order = await orderService.reconcileOrder(req.params.orderId, externalId, note);
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// CATÁLOGO TÉCNICO Y COMPARADOR INTELIGENTE (Admin)
// -------------------------------------------------------------
apiRouter.get('/admin/catalog/technical', (req: Request, res: Response) => {
  try {
    const { platform, search, availableOnly } = req.query;
    const services = catalogService.getTechnicalServices({
      platform: platform ? String(platform) : undefined,
      search: search ? String(search) : undefined,
      availableOnly: availableOnly === 'true',
    });
    res.json({ success: true, total: services.length, services });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/admin/catalog/comparison/:commercialId', (req: Request, res: Response) => {
  try {
    const commercial = catalogService.getCommercialServiceById(req.params.commercialId);
    if (!commercial) {
      return res.status(404).json({ success: false, error: 'Servicio comercial no encontrado' });
    }
    const equivalents = catalogService.getEquivalentAlternatives(req.params.commercialId);
    res.json({
      success: true,
      commercial,
      equivalents,
      exchangeRateCLP: pricingEngine.getExchangeRate(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.patch('/admin/catalog/commercial/:id', (req: Request, res: Response) => {
  try {
    const updated = catalogService.updateCommercialService(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Servicio comercial no encontrado' });
    }
    res.json({ success: true, service: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// CONTROL DE SALDO Y PROVEEDORES
// -------------------------------------------------------------
apiRouter.get('/admin/balance', (_req: Request, res: Response) => {
  res.json({ success: true, status: balanceService.getStatus() });
});

apiRouter.post('/admin/balance/check', async (_req: Request, res: Response) => {
  try {
    const record = await balanceService.checkBalance();
    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/admin/balance/thresholds', (req: Request, res: Response) => {
  try {
    const { lowUSD, criticalUSD, insufficientUSD } = req.body;
    const updated = balanceService.setThresholds({
      ...(lowUSD !== undefined && { lowUSD: Number(lowUSD) }),
      ...(criticalUSD !== undefined && { criticalUSD: Number(criticalUSD) }),
      ...(insufficientUSD !== undefined && { insufficientUSD: Number(insufficientUSD) }),
    });
    res.json({ success: true, thresholds: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// COLA PERSISTENTE (Job Queue)
// -------------------------------------------------------------
apiRouter.get('/admin/queue', (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const jobs = jobQueueService.getJobs({
      status: status ? (status as any) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({
      success: true,
      counts: jobQueueService.getCounts(),
      jobs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/admin/queue/:jobId/retry', async (req: Request, res: Response) => {
  try {
    const success = await jobQueueService.retryJobNow(req.params.jobId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Trabajo no encontrado en cola' });
    }
    res.json({ success: true, message: 'Trabajo reprogramado para ejecución inmediata.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// CENTRO DE NOTIFICACIONES ADMINISTRATIVAS
// -------------------------------------------------------------
apiRouter.get('/admin/notifications', (req: Request, res: Response) => {
  try {
    const { level, resolved, read, search } = req.query;
    const notifications = notificationService.getNotifications({
      level: level ? (level as any) : undefined,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      read: read !== undefined ? read === 'true' : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({
      success: true,
      counts: notificationService.getCounts(),
      notifications,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/admin/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const success = await notificationService.markAsRead(req.params.id);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/admin/notifications/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { userEmail } = req.body;
    const success = await notificationService.resolve(req.params.id, userEmail);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/admin/notifications/read-all', async (_req: Request, res: Response) => {
  try {
    await notificationService.markAllAsRead();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// HISTORIAL DE SINCRONIZACIÓN Y MÉTRICAS
// -------------------------------------------------------------
apiRouter.get('/admin/sync/history', (_req: Request, res: Response) => {
  res.json({ success: true, history: catalogService.getSyncHistory() });
});

apiRouter.post('/admin/services/sync', async (_req: Request, res: Response) => {
  try {
    const record = await catalogService.syncTechnicalCatalog();
    res.json({ success: true, record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/admin/metrics', async (_req: Request, res: Response) => {
  try {
    const financial = orderService.getFinancialMetrics();
    const catalogStats = catalogService.getStats();
    const balanceStatus = balanceService.getStatus();
    const queueCounts = jobQueueService.getCounts();
    const notifCounts = notificationService.getCounts();

    res.json({
      success: true,
      financial,
      catalog: catalogStats,
      balance: balanceStatus,
      queue: queueCounts,
      notifications: notifCounts,
      exchangeRateCLP: pricingEngine.getExchangeRate(),
      defaultMarginPercent: pricingEngine.getDefaultMargin(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/admin/orders', (req: Request, res: Response) => {
  try {
    const { status, platform, search } = req.query;
    const orders = orderService.getAllOrders({
      status: status ? (status as any) : undefined,
      platform: platform ? String(platform) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({ success: true, total: orders.length, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/admin/settings', (_req: Request, res: Response) => {
  res.json({
    success: true,
    settings: {
      usdClpRate: pricingEngine.getExchangeRate(),
      defaultGlobalMarginPercent: pricingEngine.getDefaultMargin(),
      systemFollowsApiUrl: config.systemFollows.apiUrl,
      systemFollowsConfigured: systemFollowsProvider.isConfigured(),
      webpayEnvironment: config.webpay.environment,
      webpayCommerceCode: config.webpay.commerceCode,
      mercadopagoEnvironment: config.mercadopago.environment,
      adminEmails: config.adminEmails,
      thresholds: balanceService.getThresholds(),
    },
  });
});

apiRouter.post('/admin/settings', async (req: Request, res: Response) => {
  try {
    const { usdClpRate, defaultGlobalMarginPercent, systemFollowsApiKey, thresholds } = req.body;

    if (usdClpRate && !isNaN(Number(usdClpRate))) {
      pricingEngine.setExchangeRate(Number(usdClpRate));
    }

    if (defaultGlobalMarginPercent && !isNaN(Number(defaultGlobalMarginPercent))) {
      pricingEngine.setDefaultMargin(Number(defaultGlobalMarginPercent));
    }

    if (systemFollowsApiKey && typeof systemFollowsApiKey === 'string' && systemFollowsApiKey.trim().length > 0) {
      systemFollowsProvider.updateCredentials(systemFollowsApiKey.trim());
    }

    if (thresholds && typeof thresholds === 'object') {
      balanceService.setThresholds(thresholds);
    }

    // Persistir en Firestore
    await adminFirestore.collection('settings').doc('global').set({
      usdClpRate: pricingEngine.getExchangeRate(),
      defaultGlobalMarginPercent: pricingEngine.getDefaultMargin(),
      ...(systemFollowsApiKey && { systemFollowsApiKey: systemFollowsApiKey.trim() }),
      thresholds: balanceService.getThresholds(),
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(console.warn);

    res.json({
      success: true,
      message: 'Configuraciones actualizadas y persistidas exitosamente',
      settings: {
        usdClpRate: pricingEngine.getExchangeRate(),
        defaultGlobalMarginPercent: pricingEngine.getDefaultMargin(),
        systemFollowsConfigured: systemFollowsProvider.isConfigured(),
        thresholds: balanceService.getThresholds(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// SUITE DE VERIFICACIÓN AUTOMATIZADA (20 Escenarios)
// -------------------------------------------------------------
apiRouter.post('/admin/tests/run', async (_req: Request, res: Response) => {
  try {
    const report = await verificationSuite.runAllTests();
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
