import { Router, Request, Response } from 'express';
import { catalogService } from '../services/catalogService.ts';
import { pricingEngine } from '../services/pricingEngine.ts';
import { orderService } from '../services/orderService.ts';
import { balanceService } from '../services/balanceService.ts';
import { jobQueueService } from '../services/jobQueueService.ts';
import { notificationService } from '../services/notificationService.ts';
import { verificationSuite } from '../tests/verificationSuite.ts';
import { flowProvider } from '../providers/payments/flow.ts';
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
        if (data.freeBasePriceCLP || data.freeMicroPriceCLP || data.premiumBasePriceCLP) {
          pricingEngine.setPlanFloorPrices({
            ...(data.freeBasePriceCLP && { freeBasePriceCLP: Number(data.freeBasePriceCLP) }),
            ...(data.freeMicroPriceCLP && { freeMicroPriceCLP: Number(data.freeMicroPriceCLP) }),
            ...(data.premiumBasePriceCLP && { premiumBasePriceCLP: Number(data.premiumBasePriceCLP) }),
          });
        }
        if (data.systemFollowsApiKey) systemFollowsProvider.updateCredentials(String(data.systemFollowsApiKey));
        if (data.flowApiKey || data.flowSecretKey || data.flowEnvironment) {
          flowProvider.updateCredentials({
            ...(data.flowApiKey && { apiKey: String(data.flowApiKey) }),
            ...(data.flowSecretKey && { secretKey: String(data.flowSecretKey) }),
            ...(data.flowEnvironment && {
              environment: String(data.flowEnvironment).toUpperCase() === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION',
            }),
          });
        }
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
      flowConfigured: flowProvider.isConfigured(),
      flowEnvironment: flowProvider.getEnvironment(),
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
    const { serviceId, quantity } = req.body;
    const commService = catalogService.getCommercialServiceById(String(serviceId));
    let originalRateUSD = 1.5;
    let serviceName = 'Servicio';
    let platform = 'Instagram';
    let commCategory = 'Seguidores';
    let tier: 'FREE' | 'PREMIUM' = 'FREE';

    if (commService) {
      originalRateUSD = commService.originalRateUSD;
      serviceName = commService.commercialName;
      platform = commService.platform;
      commCategory = commService.commercialCategory;
      tier = commService.tier;
    } else {
      const techService = catalogService.getTechnicalServiceById(String(serviceId));
      if (techService) {
        originalRateUSD = techService.rateUSD;
        serviceName = techService.name;
        platform = techService.platform;
        commCategory = catalogService.detectCommercialCategory(techService.name, techService.category);
        tier = techService.refill ? 'PREMIUM' : 'FREE';
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
      commCategory,
      'FLOW',
      tier
    );

    res.json({
      success: true,
      service: {
        id: serviceId,
        name: serviceName,
        platform,
        tier,
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
    const { userId, userEmail, serviceId, targetUrl, quantity } = req.body;

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
      gateway: 'FLOW',
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

// -------------------------------------------------------------
// FLOW.CL REST API v3 (Creación, Webhook urlConfirmation y Confirmación)
// -------------------------------------------------------------
apiRouter.post('/payments/flow/create', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const order = orderService.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Orden comercial no encontrada' });
    }

    const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
    const protoHeader = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    const protocol = protoHeader === 'https' || host.endsWith('.run.app') ? 'https' : 'http';
    const returnUrl = `${protocol}://${host}/checkout/flow-return?orderId=${encodeURIComponent(order.id)}`;
    const confirmationUrl = `${protocol}://${host}/api/payments/flow/webhook`;

    const paymentResult = await flowProvider.createPayment({
      orderId: order.id,
      amountCLP: order.totalPriceCLP,
      userEmail: order.userEmail,
      serviceTitle: order.serviceName,
      returnUrl,
      confirmationUrl,
    });

    await orderService.setPaymentReference(order.id, paymentResult.paymentId, paymentResult.redirectUrl);

    res.json({
      success: true,
      payment: paymentResult,
    });
  } catch (error: any) {
    console.error('Error creando pago Flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook asíncrono server-to-server llamado por Flow (urlConfirmation)
apiRouter.post('/payments/flow/webhook', async (req: Request, res: Response) => {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token) {
      return res.status(400).send('Missing token');
    }

    const confirmRes = await flowProvider.confirmPayment(String(token));
    const targetOrderId = confirmRes.orderId;
    const existingOrder = targetOrderId ? orderService.getOrder(targetOrderId) : undefined;

    if (
      confirmRes.status === 'APPROVED' &&
      existingOrder &&
      confirmRes.amountCLP >= existingOrder.totalPriceCLP
    ) {
      await orderService.handlePaymentSuccess(existingOrder.id, {
        paymentId: confirmRes.paymentId,
        authorizationCode: confirmRes.authorizationCode,
        gateway: 'FLOW',
      });
    }

    return res.status(200).send('OK');
  } catch (error: any) {
    console.error('Error en webhook Flow:', error);
    return res.status(200).send('OK');
  }
});

// Confirmación activa desde el frontend (/checkout/flow-return o botón Verificar Pago)
apiRouter.post('/payments/flow/confirm', async (req: Request, res: Response) => {
  try {
    const { token, orderId } = req.body;
    if (!token && !orderId) {
      return res.status(400).json({ success: false, error: 'Token o ID de orden requerido para verificar Flow' });
    }

    const orderFromId = orderId ? orderService.getOrder(String(orderId)) : undefined;
    const effectiveToken = token ? String(token) : orderFromId?.paymentId;

    const confirmRes = effectiveToken
      ? await flowProvider.confirmPayment(effectiveToken)
      : await flowProvider.getStatusByCommerceId(String(orderId));

    const targetOrderId = (orderId && orderService.getOrder(String(orderId)))
      ? String(orderId)
      : confirmRes.orderId;
    const existingOrder = targetOrderId ? orderService.getOrder(targetOrderId) : undefined;

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        status: confirmRes.status,
        error: 'Orden comercial no encontrada en el sistema.',
      });
    }

    // Verificación estricta de monto para evitar fraude o alteración
    if (confirmRes.amountCLP > 0 && confirmRes.amountCLP < existingOrder.totalPriceCLP) {
      return res.status(400).json({
        success: false,
        status: 'REJECTED',
        error: `El monto pagado en Flow (${confirmRes.amountCLP} CLP) es menor al total de la orden (${existingOrder.totalPriceCLP} CLP).`,
      });
    }

    if (confirmRes.status === 'APPROVED') {
      const updatedOrder = await orderService.handlePaymentSuccess(existingOrder.id, {
        paymentId: confirmRes.paymentId,
        authorizationCode: confirmRes.authorizationCode,
        gateway: 'FLOW',
      });
      return res.json({
        success: true,
        status: 'APPROVED',
        order: updatedOrder,
        confirmation: confirmRes,
      });
    }

    if (confirmRes.status === 'PENDING') {
      return res.json({
        success: false,
        status: 'PENDING',
        order: existingOrder,
        message: 'El pago aún está pendiente de confirmación en Flow (puede demorar unos segundos o estar en espera de caja Servipag/Sencillito).',
        confirmation: confirmRes,
      });
    }

    return res.json({
      success: false,
      status: confirmRes.status,
      order: existingOrder,
      message: confirmRes.status === 'CANCELED'
        ? 'El pago fue cancelado o expiró en Flow.'
        : 'El pago en Flow fue rechazado o no pudo ser confirmado.',
      confirmation: confirmRes,
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

apiRouter.post('/orders/refresh-batch', async (req: Request, res: Response) => {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds)) {
      return res.status(400).json({ success: false, error: 'orderIds debe ser una lista' });
    }
    const orders = await orderService.refreshOrdersBatch(orderIds.map(String));
    res.json({ success: true, orders });
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

apiRouter.post('/admin/flow/test', async (req: Request, res: Response) => {
  try {
    const { testEmail, amountCLP } = req.body || {};
    const email = (typeof testEmail === 'string' && testEmail.includes('@'))
      ? testEmail.trim()
      : (config.adminEmails[0] || 'rodrigogalvez@42labs.cl');
    const amount = Math.max(350, Math.min(20000, Number(amountCLP) || 500));

    const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
    const protoHeader = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    const protocol = protoHeader === 'https' || host.endsWith('.run.app') ? 'https' : 'http';

    const testOrderId = `TEST-FLOW-${Date.now()}`;
    const returnUrl = `${protocol}://${host}/checkout/flow-return?orderId=${encodeURIComponent(testOrderId)}`;
    const confirmationUrl = `${protocol}://${host}/api/payments/flow/webhook`;

    const result = await flowProvider.createPayment({
      orderId: testOrderId,
      amountCLP: amount,
      userEmail: email,
      serviceTitle: 'Prueba de Integración Flow PotenciaRedes',
      returnUrl,
      confirmationUrl,
    });

    const checkStatus = await flowProvider.confirmPayment(result.token || result.paymentId);

    res.json({
      success: true,
      environment: flowProvider.getEnvironment(),
      testOrderId,
      flowOrder: result.flowOrder,
      token: result.token,
      redirectUrl: result.redirectUrl,
      url: result.url,
      confirmationUrl,
      returnUrl,
      getStatusVerified: checkStatus.status,
      amountCLP: amount,
      email,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.get('/admin/settings', (_req: Request, res: Response) => {
  const floorPrices = pricingEngine.getPlanFloorPrices();
  res.json({
    success: true,
    settings: {
      usdClpRate: pricingEngine.getExchangeRate(),
      defaultGlobalMarginPercent: pricingEngine.getDefaultMargin(),
      freeBasePriceCLP: floorPrices.freeBasePriceCLP,
      freeMicroPriceCLP: floorPrices.freeMicroPriceCLP,
      premiumBasePriceCLP: floorPrices.premiumBasePriceCLP,
      systemFollowsApiUrl: config.systemFollows.apiUrl,
      systemFollowsConfigured: systemFollowsProvider.isConfigured(),
      flowConfigured: flowProvider.isConfigured(),
      flowEnvironment: flowProvider.getEnvironment(),
      adminEmails: config.adminEmails,
      thresholds: balanceService.getThresholds(),
    },
  });
});

apiRouter.post('/admin/settings', async (req: Request, res: Response) => {
  try {
    const {
      usdClpRate,
      defaultGlobalMarginPercent,
      freeBasePriceCLP,
      freeMicroPriceCLP,
      premiumBasePriceCLP,
      systemFollowsApiKey,
      flowApiKey,
      flowSecretKey,
      flowEnvironment,
      thresholds,
    } = req.body;

    if (usdClpRate && !isNaN(Number(usdClpRate))) {
      pricingEngine.setExchangeRate(Number(usdClpRate));
    }

    if (defaultGlobalMarginPercent && !isNaN(Number(defaultGlobalMarginPercent))) {
      pricingEngine.setDefaultMargin(Number(defaultGlobalMarginPercent));
    }

    if (freeBasePriceCLP || freeMicroPriceCLP || premiumBasePriceCLP) {
      pricingEngine.setPlanFloorPrices({
        ...(freeBasePriceCLP && !isNaN(Number(freeBasePriceCLP)) && { freeBasePriceCLP: Number(freeBasePriceCLP) }),
        ...(freeMicroPriceCLP && !isNaN(Number(freeMicroPriceCLP)) && { freeMicroPriceCLP: Number(freeMicroPriceCLP) }),
        ...(premiumBasePriceCLP && !isNaN(Number(premiumBasePriceCLP)) && { premiumBasePriceCLP: Number(premiumBasePriceCLP) }),
      });
    }

    if (systemFollowsApiKey && typeof systemFollowsApiKey === 'string' && systemFollowsApiKey.trim().length > 0) {
      systemFollowsProvider.updateCredentials(systemFollowsApiKey.trim());
    }

    const normalizedFlowEnv = flowEnvironment === 'SANDBOX' || flowEnvironment === 'PRODUCTION' ? flowEnvironment : undefined;
    if (
      (flowApiKey && typeof flowApiKey === 'string' && flowApiKey.trim().length > 0) ||
      (flowSecretKey && typeof flowSecretKey === 'string' && flowSecretKey.trim().length > 0) ||
      normalizedFlowEnv
    ) {
      flowProvider.updateCredentials({
        ...(flowApiKey && typeof flowApiKey === 'string' && flowApiKey.trim().length > 0 && { apiKey: flowApiKey.trim() }),
        ...(flowSecretKey && typeof flowSecretKey === 'string' && flowSecretKey.trim().length > 0 && { secretKey: flowSecretKey.trim() }),
        ...(normalizedFlowEnv && { environment: normalizedFlowEnv }),
      });
    }

    if (thresholds && typeof thresholds === 'object') {
      balanceService.setThresholds(thresholds);
    }

    // Reconstruir catálogo comercial para reflejar inmediatamente cambios de precios o clave SystemFollows
    catalogService.rebuildCommercialCatalog();

    const floorPrices = pricingEngine.getPlanFloorPrices();

    // Persistir en Firestore
    await adminFirestore.collection('settings').doc('global').set({
      usdClpRate: pricingEngine.getExchangeRate(),
      defaultGlobalMarginPercent: pricingEngine.getDefaultMargin(),
      freeBasePriceCLP: floorPrices.freeBasePriceCLP,
      freeMicroPriceCLP: floorPrices.freeMicroPriceCLP,
      premiumBasePriceCLP: floorPrices.premiumBasePriceCLP,
      ...(systemFollowsApiKey && typeof systemFollowsApiKey === 'string' && systemFollowsApiKey.trim() && { systemFollowsApiKey: systemFollowsApiKey.trim() }),
      ...(flowApiKey && typeof flowApiKey === 'string' && flowApiKey.trim() && { flowApiKey: flowApiKey.trim() }),
      ...(flowSecretKey && typeof flowSecretKey === 'string' && flowSecretKey.trim() && { flowSecretKey: flowSecretKey.trim() }),
      ...(normalizedFlowEnv && { flowEnvironment: normalizedFlowEnv }),
      thresholds: balanceService.getThresholds(),
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(console.warn);

    res.json({
      success: true,
      message: 'Configuraciones actualizadas y persistidas exitosamente',
      settings: {
        usdClpRate: pricingEngine.getExchangeRate(),
        defaultGlobalMarginPercent: pricingEngine.getDefaultMargin(),
        freeBasePriceCLP: floorPrices.freeBasePriceCLP,
        freeMicroPriceCLP: floorPrices.freeMicroPriceCLP,
        premiumBasePriceCLP: floorPrices.premiumBasePriceCLP,
        systemFollowsConfigured: systemFollowsProvider.isConfigured(),
        flowConfigured: flowProvider.isConfigured(),
        flowEnvironment: flowProvider.getEnvironment(),
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
