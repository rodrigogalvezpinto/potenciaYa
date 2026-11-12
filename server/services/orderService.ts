import { catalogService, CommercialCatalogService, ServiceTier } from './catalogService.ts';
import { pricingEngine, PriceCalculationResult } from './pricingEngine.ts';
import { systemFollowsProvider } from '../providers/smm/systemFollows.ts';
import { balanceService } from './balanceService.ts';
import { jobQueueService } from './jobQueueService.ts';
import { notificationService } from './notificationService.ts';
import { adminFirestore } from '../firebaseAdmin.ts';

export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'PAID_WAITING_PROVIDER_BALANCE'
  | 'QUEUED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'CANCELED'
  | 'FAILED'
  | 'REQUIRES_RECONCILIATION';

export interface CommercialOrder {
  id: string;
  userId: string;
  userEmail: string;
  serviceId: string;
  serviceName: string;
  tier?: ServiceTier;
  technicalServiceId?: string;
  platform: string;
  targetUrl: string;
  quantity: number;
  
  // Instantánea histórica de precios y costos
  unitPricePer1000CLP: number;
  totalPriceCLP: number;
  providerCostUSD: number;
  providerCostCLP: number;
  exchangeRateCLP: number;
  marginPercent: number;
  estimatedGrossProfitCLP: number;
  estimatedGatewayFeeCLP: number;
  estimatedNetProfitCLP: number;

  // Estado y seguimiento
  status: OrderStatus;
  paymentId?: string;
  paymentUrl?: string;
  paymentGateway?: 'FLOW';
  providerOrderId?: string;
  providerStatus?: string;
  startCount?: number;
  remains?: number;
  refillAvailable: boolean;
  cancelAvailable: boolean;
  refillCount?: number;
  lastRefillId?: string;

  // Auditoría y tiempos
  createdAt: string;
  updatedAt: string;
  history: Array<{ status: OrderStatus; timestamp: string; note: string }>;
  errorLogs?: string[];
}

export class OrderService {
  private orders: Map<string, CommercialOrder> = new Map();

  constructor() {
    this.loadOrdersFromFirestore().catch(e => {
      console.warn('Initial orders load notice:', e?.message || e);
    });

    // Conectar el callback de ejecución de la cola de reintentos
    this.attachQueueWorker();
  }

  private attachQueueWorker() {
    setInterval(async () => {
      await jobQueueService.processPendingJobs(async (job) => {
        const order = this.orders.get(job.orderId);
        if (!order) return { success: false, error: 'Orden no encontrada' };

        // 1. Validar que el pedido siga siendo elegible
        if (order.status !== 'PAID_WAITING_PROVIDER_BALANCE' && order.status !== 'QUEUED') {
          return { success: false, error: `Orden en estado ${order.status}, no elegible para reintento automático.` };
        }

        // 2. Verificar que no exista un ID externo previo
        if (order.providerOrderId) {
          return { success: true, externalId: order.providerOrderId };
        }

        // 3. Verificar si hay saldo antes de despachar
        if (!balanceService.hasSufficientBalance(order.providerCostUSD)) {
          return { success: false, insufficientBalance: true, error: 'Saldo insuficiente en el proveedor' };
        }

        // 4. Intentar enviar
        try {
          const res = await systemFollowsProvider.createOrder({
            service: job.payload.providerServiceId || order.serviceId,
            link: order.targetUrl,
            quantity: order.quantity,
          });

          if (res.error) {
            const errLower = res.error.toLowerCase();
            if (errLower.includes('balance') || errLower.includes('fund') || errLower.includes('saldo')) {
              return { success: false, insufficientBalance: true, error: res.error };
            }
            return { success: false, error: res.error };
          }

          if (res.order) {
            const now = new Date().toISOString();
            order.providerOrderId = String(res.order);
            order.status = 'IN_PROGRESS';
            order.updatedAt = now;
            order.history.push({
              status: 'IN_PROGRESS',
              timestamp: now,
              note: `Orden reintentada con éxito y aceptada por el proveedor. ID Externo: ${res.order}`,
            });
            await this.persistOrder(order);
            return { success: true, externalId: String(res.order) };
          }

          return { success: false, error: 'Respuesta sin ID de orden' };
        } catch (err: any) {
          const msg = err.message || '';
          if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')) {
            order.status = 'REQUIRES_RECONCILIATION';
            order.updatedAt = new Date().toISOString();
            await this.persistOrder(order);
            return { success: false, requiresReconciliation: true, error: msg };
          }
          return { success: false, error: msg };
        }
      });
    }, 15000);
  }

  private async loadOrdersFromFirestore() {
    try {
      const snapshot = await adminFirestore.collection('orders').limit(100).get();
      snapshot.forEach(doc => {
        this.orders.set(doc.id, doc.data() as CommercialOrder);
      });
    } catch (e: any) {
      console.warn('Firestore orders collection read note:', e.message);
    }
  }

  public validateLink(platform: string, link: string): { valid: boolean; reason?: string } {
    if (!link || typeof link !== 'string' || link.trim().length < 2) {
      return { valid: false, reason: 'El enlace o usuario no puede estar vacío.' };
    }

    const trimmed = link.trim();
    if (platform === 'Instagram') {
      if (trimmed.startsWith('@') && trimmed.length >= 2) return { valid: true };
      if (trimmed.includes('instagram.com/')) return { valid: true };
      if (!trimmed.includes(' ') && trimmed.length >= 2) return { valid: true };
      return { valid: false, reason: 'Ingresa un usuario (@ejemplo) o enlace de Instagram válido.' };
    }

    if (platform === 'TikTok') {
      if (trimmed.startsWith('@') || trimmed.includes('tiktok.com/')) return { valid: true };
      if (!trimmed.includes(' ') && trimmed.length >= 2) return { valid: true };
      return { valid: false, reason: 'Ingresa un usuario (@ejemplo) o video de TikTok válido.' };
    }

    if (platform === 'YouTube') {
      if (trimmed.includes('youtube.com/') || trimmed.includes('youtu.be/')) return { valid: true };
      return { valid: false, reason: 'Ingresa una URL válida de canal o video de YouTube.' };
    }

    if (platform === 'Spotify') {
      if (trimmed.includes('spotify.com/')) return { valid: true };
      return { valid: false, reason: 'Ingresa una URL válida de perfil o canción de Spotify.' };
    }

    return { valid: true };
  }

  /**
   * Crea una orden comercial preliminar en estado AWAITING_PAYMENT.
   */
  public async createDraftOrder(params: {
    userId: string;
    userEmail: string;
    serviceId: string;
    targetUrl: string;
    quantity: number;
    gateway?: 'FLOW';
  }): Promise<{ order: CommercialOrder; priceCalc: PriceCalculationResult }> {
    // Buscar en catálogo comercial
    const commService = catalogService.getCommercialServiceById(params.serviceId);
    let originalRateUSD = 1.5;
    let minQty = 10;
    let maxQty = 100000;
    let refill = false;
    let cancel = false;
    let serviceName = 'Servicio Redes Sociales';
    let platform = 'Instagram';
    let commCategory = 'Seguidores';
    let tier: ServiceTier = params.serviceId.toUpperCase().includes('PREMIUM') ? 'PREMIUM' : 'FREE';
    let technicalServiceId: string | undefined;

    if (commService) {
      originalRateUSD = commService.originalRateUSD;
      minQty = commService.minQuantity;
      maxQty = commService.maxQuantity;
      refill = commService.refill;
      cancel = commService.cancel;
      serviceName = commService.commercialName;
      platform = commService.platform;
      commCategory = commService.commercialCategory;
      tier = commService.tier;
      technicalServiceId = commService.technicalServiceId;
    } else {
      // Buscar en catálogo técnico si se pasó ID técnico directo
      const techService = catalogService.getTechnicalServiceById(params.serviceId);
      if (techService) {
        originalRateUSD = techService.rateUSD;
        minQty = techService.minQuantity;
        maxQty = techService.maxQuantity;
        refill = techService.refill;
        cancel = techService.cancel;
        serviceName = techService.name;
        platform = techService.platform;
        commCategory = catalogService.detectCommercialCategory(techService.name, techService.category);
        tier = techService.refill ? 'PREMIUM' : 'FREE';
        technicalServiceId = techService.id;
      } else {
        throw new Error(`El servicio #${params.serviceId} no existe en el catálogo comercial.`);
      }
    }

    const effectiveMinQty = Math.max(500, minQty);
    if (!Number.isFinite(params.quantity) || params.quantity < effectiveMinQty) {
      throw new Error(`La cantidad mínima permitida es ${effectiveMinQty.toLocaleString('es-CL')} unidades.`);
    }

    if (params.quantity > maxQty) {
      throw new Error(`La cantidad máxima permitida es ${maxQty.toLocaleString('es-CL')}.`);
    }

    const linkValidation = this.validateLink(platform, params.targetUrl);
    if (!linkValidation.valid) {
      throw new Error(linkValidation.reason);
    }

    const priceCalc = pricingEngine.calculate(
      originalRateUSD,
      params.quantity,
      params.serviceId,
      commCategory,
      'FLOW',
      tier
    );

    const now = new Date().toISOString();
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const order: CommercialOrder = {
      id: orderId,
      userId: params.userId,
      userEmail: params.userEmail,
      serviceId: params.serviceId,
      serviceName,
      tier,
      technicalServiceId,
      platform,
      targetUrl: params.targetUrl.trim(),
      quantity: params.quantity,

      unitPricePer1000CLP: priceCalc.unitPricePer1000CLP,
      totalPriceCLP: priceCalc.totalPriceCLP,
      providerCostUSD: priceCalc.costUSD,
      providerCostCLP: priceCalc.costCLP,
      exchangeRateCLP: priceCalc.exchangeRateCLP,
      marginPercent: priceCalc.marginPercent,
      estimatedGrossProfitCLP: priceCalc.estimatedGrossProfitCLP,
      estimatedGatewayFeeCLP: priceCalc.estimatedGatewayFeeCLP,
      estimatedNetProfitCLP: priceCalc.estimatedNetProfitCLP,

      status: 'AWAITING_PAYMENT',
      paymentGateway: 'FLOW',
      remains: params.quantity,
      refillAvailable: tier === 'PREMIUM' && refill,
      cancelAvailable: cancel,
      refillCount: 0,

      createdAt: now,
      updatedAt: now,
      history: [
        {
          status: 'AWAITING_PAYMENT',
          timestamp: now,
          note: 'Orden comercial iniciada. Esperando confirmación de pago por Flow Chile.',
        },
      ],
    };

    this.orders.set(orderId, order);
    this.persistOrder(order).catch(console.warn);

    return { order, priceCalc };
  }

  /**
   * Confirma el pago de la orden y ejecuta el despacho con manejo de saldo e idempotencia estricta.
   */
  public async handlePaymentSuccess(orderId: string, paymentDetails: {
    paymentId: string;
    authorizationCode?: string;
    gateway?: 'FLOW';
  }): Promise<CommercialOrder> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Orden ${orderId} no encontrada.`);
    }

    // Regla de idempotencia estricta
    if (order.status !== 'AWAITING_PAYMENT') {
      console.log(`Idempotencia: Orden ${orderId} ya en estado ${order.status}, ignorando callback repetido.`);
      return order;
    }

    const now = new Date().toISOString();
    order.status = 'PAID';
    order.paymentId = paymentDetails.paymentId;
    order.paymentGateway = paymentDetails.gateway || 'FLOW';
    order.updatedAt = now;
    order.history.push({
      status: 'PAID',
      timestamp: now,
      note: `Pago verificado y aprobado. Código de autorización: ${paymentDetails.authorizationCode || 'N/A'}.`,
    });

    // Despacho inteligente a proveedor con control de saldo
    await this.dispatchToProvider(order);

    return order;
  }

  /**
   * Envía la orden pagada al proveedor SMM.
   * - En Plan Free busca automáticamente el servicio disponible más barato en el proveedor.
   * - En Plan Premium busca un servicio verificado CON reposición (refill).
   * - Si el ID del proveedor cambió o falló por desactivación, re-sincroniza el catálogo y busca un servicio equivalente similar dentro del margen de ganancia.
   */
  public async dispatchToProvider(order: CommercialOrder): Promise<void> {
    const maxAllowedCostCLP = Math.round(order.totalPriceCLP * 0.72);
    const resolution = catalogService.resolveDispatchService({
      commercialServiceId: order.serviceId,
      quantity: order.quantity,
      tier: order.tier,
      maxAllowedTotalCostCLP: maxAllowedCostCLP,
    });

    let targetTech = resolution.technicalService;
    let targetProviderServiceId = targetTech ? targetTech.providerServiceId : order.serviceId;
    const comm = catalogService.getCommercialServiceById(order.serviceId);
    if (!targetTech && comm) {
      const tech = catalogService.getTechnicalServiceById(comm.technicalServiceId);
      if (tech) {
        targetTech = tech;
        targetProviderServiceId = tech.providerServiceId;
      }
    }

    if (targetTech) {
      order.technicalServiceId = targetTech.id;
      if (resolution.wasAutoReassigned && resolution.reason) {
        order.history.push({
          status: order.status,
          timestamp: new Date().toISOString(),
          note: resolution.reason,
        });
      }
    }

    // 2. Verificar saldo preventivo
    const hasBalance = balanceService.hasSufficientBalance(order.providerCostUSD);

    if (!hasBalance) {
      const updatedTime = new Date().toISOString();
      order.status = 'PAID_WAITING_PROVIDER_BALANCE';
      order.updatedAt = updatedTime;
      order.history.push({
        status: 'PAID_WAITING_PROVIDER_BALANCE',
        timestamp: updatedTime,
        note: 'Pago aprobado. Pedido en cola de aprovisionamiento prioritario por control de saldo mayorista.',
      });

      await jobQueueService.enqueue({
        orderId: order.id,
        type: 'DISPATCH_PROVIDER_ORDER',
        payload: {
          serviceId: order.serviceId,
          providerServiceId: targetProviderServiceId,
          targetUrl: order.targetUrl,
          quantity: order.quantity,
          userEmail: order.userEmail,
          costUSD: order.providerCostUSD,
        },
        initialStatus: 'PENDING',
        reason: 'Saldo insuficiente en el proveedor SMM al momento del pago.',
      });

      await this.persistOrder(order);
      return;
    }

    // 3. Intentar despacho al proveedor
    const now = new Date().toISOString();
    order.status = 'SUBMITTING';
    order.updatedAt = now;
    order.history.push({
      status: 'SUBMITTING',
      timestamp: now,
      note: `Despachando orden a API de SystemFollows (Servicio técnico #${targetProviderServiceId}).`,
    });

    try {
      let response = await systemFollowsProvider.createOrder({
        service: targetProviderServiceId,
        link: order.targetUrl,
        quantity: order.quantity,
      });

      // Si el ID cambió o fue deshabilitado por el proveedor, resincronizar y reintentar automáticamente con un similar
      if (response.error) {
        const errLower = response.error.toLowerCase();
        const isServiceIdError =
          errLower.includes('service') ||
          errLower.includes('disabled') ||
          errLower.includes('not found') ||
          errLower.includes('invalid id') ||
          errLower.includes('unavailable');

        if (isServiceIdError) {
          await catalogService.syncTechnicalCatalog();
          const fallback = catalogService.resolveDispatchService({
            commercialServiceId: order.serviceId,
            quantity: order.quantity,
            tier: order.tier,
            excludedTechIds: [targetProviderServiceId, ...(targetTech ? [targetTech.id] : [])],
            maxAllowedTotalCostCLP: maxAllowedCostCLP,
          });

          if (fallback.technicalService) {
            const newId = fallback.technicalService.providerServiceId;
            order.technicalServiceId = fallback.technicalService.id;
            order.history.push({
              status: 'SUBMITTING',
              timestamp: new Date().toISOString(),
              note: `ID #${targetProviderServiceId} no disponible en proveedor ("${response.error}"). Reasignando automáticamente a servicio equivalente #${newId}.`,
            });

            await notificationService.notify({
              title: `Reasignación automática por cambio de ID (#${targetProviderServiceId} → #${newId})`,
              description: `La orden ${order.id} fue redirigida automáticamente al servicio equivalente #${newId} tras cambio en el proveedor.`,
              level: 'WARNING',
              entityType: 'ORDER',
              entityId: order.id,
            });

            response = await systemFollowsProvider.createOrder({
              service: newId,
              link: order.targetUrl,
              quantity: order.quantity,
            });
          }
        }
      }

      const updatedTime = new Date().toISOString();

      if (response.error) {
        const errLower = response.error.toLowerCase();
        // Si el proveedor indica falta de saldo durante la llamada
        if (errLower.includes('balance') || errLower.includes('fund') || errLower.includes('saldo')) {
          order.status = 'PAID_WAITING_PROVIDER_BALANCE';
          order.updatedAt = updatedTime;
          order.history.push({
            status: 'PAID_WAITING_PROVIDER_BALANCE',
            timestamp: updatedTime,
            note: `SystemFollows reportó falta de saldo: "${response.error}". Pedido retenido y encolado para reintento automático.`,
          });

          await jobQueueService.enqueue({
            orderId: order.id,
            type: 'DISPATCH_PROVIDER_ORDER',
            payload: {
              serviceId: order.serviceId,
              providerServiceId: targetProviderServiceId,
              targetUrl: order.targetUrl,
              quantity: order.quantity,
              userEmail: order.userEmail,
              costUSD: order.providerCostUSD,
            },
            initialStatus: 'PENDING',
            reason: response.error,
          });

          await notificationService.notify({
            title: `Pedido retenido por falta de saldo: #${order.id}`,
            description: `El proveedor rechazó la orden por saldo insuficiente. El pedido pagado quedó en espera sin perderse.`,
            level: 'CRITICAL',
            entityType: 'ORDER',
            entityId: order.id,
            actionUrl: '/admin?tab=queue',
            recommendedAction: 'Recargar saldo en SystemFollows para desbloquear la cola.',
          });
        } else {
          // Otro error de proveedor
          order.status = 'FAILED';
          order.updatedAt = updatedTime;
          order.errorLogs = [...(order.errorLogs || []), `SystemFollows Error: ${response.error}`];
          order.history.push({
            status: 'FAILED',
            timestamp: updatedTime,
            note: `Error de proveedor: ${response.error}. En cola para revisión administrativa.`,
          });
        }
      } else if (response.order) {
        // Éxito confirmado por el proveedor
        order.providerOrderId = String(response.order);
        order.status = 'IN_PROGRESS';
        order.providerStatus = 'In progress';
        order.remains = order.remains ?? order.quantity;
        order.updatedAt = updatedTime;
        order.history.push({
          status: 'IN_PROGRESS',
          timestamp: updatedTime,
          note: `Orden recibida y aceptada por el proveedor. ID Externo: ${response.order}.`,
        });
      } else {
        // Respuesta indeterminada: marcar REQUIRES_RECONCILIATION
        order.status = 'REQUIRES_RECONCILIATION';
        order.updatedAt = updatedTime;
        order.history.push({
          status: 'REQUIRES_RECONCILIATION',
          timestamp: updatedTime,
          note: 'Respuesta indeterminada de la API. Requiere reconciliación.',
        });

        await jobQueueService.enqueue({
          orderId: order.id,
          type: 'RECONCILE_ORDER',
          payload: {
            serviceId: order.serviceId,
            providerServiceId: targetProviderServiceId,
            targetUrl: order.targetUrl,
            quantity: order.quantity,
            userEmail: order.userEmail,
            costUSD: order.providerCostUSD,
          },
          initialStatus: 'REQUIRES_RECONCILIATION',
          reason: 'Timeout o respuesta vacía de SystemFollows',
        });
      }
    } catch (err: any) {
      // Excepción de timeout de red
      const updatedTime = new Date().toISOString();
      order.status = 'REQUIRES_RECONCILIATION';
      order.updatedAt = updatedTime;
      order.errorLogs = [...(order.errorLogs || []), err.message];
      order.history.push({
        status: 'REQUIRES_RECONCILIATION',
        timestamp: updatedTime,
        note: `Excepción de red al despachar: ${err.message}. Marcado para reconciliación obligatoria sin duplicar envío.`,
      });

      await jobQueueService.enqueue({
        orderId: order.id,
        type: 'RECONCILE_ORDER',
        payload: {
          serviceId: order.serviceId,
          providerServiceId: targetProviderServiceId,
          targetUrl: order.targetUrl,
          quantity: order.quantity,
          userEmail: order.userEmail,
          costUSD: order.providerCostUSD,
        },
        initialStatus: 'REQUIRES_RECONCILIATION',
        reason: `Excepción de red: ${err.message}`,
      });
    }

    await this.persistOrder(order);
  }

  /**
   * Reconciliación manual o asistida por el administrador
   */
  public async reconcileOrder(orderId: string, externalId: string, note?: string): Promise<CommercialOrder> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Orden no encontrada');

    const now = new Date().toISOString();
    order.providerOrderId = externalId;
    order.status = 'IN_PROGRESS';
    order.updatedAt = now;
    order.history.push({
      status: 'IN_PROGRESS',
      timestamp: now,
      note: `Orden reconciliada manualmente con ID externo #${externalId}. ${note || ''}`,
    });

    await jobQueueService.markReconciled(`JOB-${orderId}`, externalId);
    await this.persistOrder(order);
    return order;
  }

  public async refreshOrderStatus(orderId: string): Promise<CommercialOrder> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Orden ${orderId} no encontrada.`);

    if (!order.providerOrderId) return order;
    if (order.status === 'COMPLETED' || order.status === 'CANCELED') return order;

    try {
      const prevRemains = order.remains;
      const prevStart = order.startCount;
      const prevProviderStatus = order.providerStatus;

      const statusRes = await systemFollowsProvider.getOrderStatus(order.providerOrderId);
      if (statusRes.error) return order;

      const now = new Date().toISOString();
      order.providerStatus = statusRes.status;
      if (statusRes.start_count !== undefined && !isNaN(Number(statusRes.start_count))) {
        order.startCount = Number(statusRes.start_count);
      }
      if (statusRes.remains !== undefined && !isNaN(Number(statusRes.remains))) {
        order.remains = Math.max(0, Number(statusRes.remains));
      }

      const normalizedStatus = (statusRes.status || '').toLowerCase();
      let newInternalStatus: OrderStatus = order.status;

      if (normalizedStatus.includes('completed')) {
        newInternalStatus = 'COMPLETED';
        order.remains = 0;
      } else if (normalizedStatus.includes('in progress') || normalizedStatus.includes('processing')) {
        newInternalStatus = 'IN_PROGRESS';
      } else if (normalizedStatus.includes('partial')) {
        newInternalStatus = 'PARTIAL';
      } else if (normalizedStatus.includes('canceled') || normalizedStatus.includes('cancelled')) {
        newInternalStatus = 'CANCELED';
      } else if (normalizedStatus.includes('pending')) {
        newInternalStatus = 'PENDING';
      }

      const changed =
        newInternalStatus !== order.status ||
        prevRemains !== order.remains ||
        prevStart !== order.startCount ||
        prevProviderStatus !== order.providerStatus;

      if (newInternalStatus !== order.status) {
        order.status = newInternalStatus;
        order.history.push({
          status: newInternalStatus,
          timestamp: now,
          note: `Estado actualizado desde SystemFollows: ${statusRes.status} (Restantes: ${order.remains ?? 0}).`,
        });
      }

      if (changed) {
        order.updatedAt = now;
        await this.persistOrder(order);
      }
    } catch (e: any) {
      console.warn(`Refresh order ${orderId} failed:`, e.message);
    }

    return order;
  }

  public async refreshOrdersBatch(orderIds: string[]): Promise<CommercialOrder[]> {
    const updated: CommercialOrder[] = [];
    for (const id of orderIds.slice(0, 15)) {
      try {
        const res = await this.refreshOrderStatus(id);
        updated.push(res);
      } catch {}
    }
    return updated;
  }

  public async requestRefill(orderId: string, userId: string, isAdmin = false): Promise<{ success: boolean; message: string }> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Orden no encontrada');

    if (!isAdmin && order.userId !== userId) {
      throw new Error('No tienes permisos para solicitar refill en esta orden.');
    }

    if (!order.refillAvailable) {
      throw new Error('Este servicio no cuenta con garantía de refill.');
    }

    if (!order.providerOrderId) {
      throw new Error('La orden no tiene un identificador de proveedor asignado.');
    }

    const res = await systemFollowsProvider.requestRefill(order.providerOrderId);
    if (res.error) {
      throw new Error(`Error de refill: ${res.error}`);
    }

    const now = new Date().toISOString();
    order.refillCount = (order.refillCount || 0) + 1;
    order.lastRefillId = String(res.refill);
    order.updatedAt = now;
    order.history.push({
      status: order.status,
      timestamp: now,
      note: `Solicitud de refill enviada a SystemFollows. ID Refill: ${res.refill}.`,
    });

    await this.persistOrder(order);

    return {
      success: true,
      message: `Refill solicitado exitosamente con ID #${res.refill}.`,
    };
  }

  public async cancelOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Orden no encontrada');

    if (!order.providerOrderId) {
      order.status = 'CANCELED';
      order.updatedAt = new Date().toISOString();
      await this.persistOrder(order);
      return { success: true, message: 'Orden cancelada localmente.' };
    }

    const res = await systemFollowsProvider.cancelOrder(order.providerOrderId);
    if (res.error) {
      throw new Error(`No se pudo cancelar en el proveedor: ${res.error}`);
    }

    const now = new Date().toISOString();
    order.status = 'CANCELED';
    order.updatedAt = now;
    order.history.push({
      status: 'CANCELED',
      timestamp: now,
      note: 'Cancelación confirmada por SystemFollows.',
    });

    await this.persistOrder(order);
    return { success: true, message: 'Orden cancelada correctamente.' };
  }

  public async setPaymentReference(orderId: string, paymentId: string, paymentUrl?: string): Promise<CommercialOrder | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    order.paymentId = paymentId;
    if (paymentUrl) order.paymentUrl = paymentUrl;
    order.updatedAt = new Date().toISOString();
    await this.persistOrder(order);
    return order;
  }

  public getOrder(id: string): CommercialOrder | undefined {
    return this.orders.get(id);
  }

  public getUserOrders(userIdOrEmail: string): CommercialOrder[] {
    const term = userIdOrEmail.toLowerCase().trim();
    return Array.from(this.orders.values())
      .filter(o => o.userId === userIdOrEmail || o.userEmail.toLowerCase() === term)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public findOrderByQuery(query: string): CommercialOrder[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return Array.from(this.orders.values())
      .filter(o => 
        o.id.toLowerCase() === q || 
        o.userEmail.toLowerCase() === q ||
        (o.providerOrderId && o.providerOrderId.toLowerCase() === q)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAllOrders(filter?: { status?: OrderStatus; platform?: string; search?: string }): CommercialOrder[] {
    let list = Array.from(this.orders.values());

    if (filter?.status) {
      list = list.filter(o => o.status === filter.status);
    }
    if (filter?.platform) {
      list = list.filter(o => o.platform.toLowerCase() === filter.platform!.toLowerCase());
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.providerOrderId && o.providerOrderId.toLowerCase().includes(q)) ||
        o.userEmail.toLowerCase().includes(q) ||
        o.targetUrl.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getFinancialMetrics() {
    const orders = Array.from(this.orders.values());
    const paidOrders = orders.filter(o => o.status !== 'AWAITING_PAYMENT' && o.status !== 'CANCELED');

    const totalSalesCLP = paidOrders.reduce((acc, o) => acc + (o.totalPriceCLP || 0), 0);
    const totalCostCLP = paidOrders.reduce((acc, o) => acc + (o.providerCostCLP || 0), 0);
    const totalCostUSD = paidOrders.reduce((acc, o) => acc + (o.providerCostUSD || 0), 0);
    const totalGrossProfitCLP = paidOrders.reduce((acc, o) => acc + (o.estimatedGrossProfitCLP || 0), 0);
    const totalGatewayFeeCLP = paidOrders.reduce((acc, o) => acc + (o.estimatedGatewayFeeCLP || 0), 0);
    const totalNetProfitCLP = paidOrders.reduce((acc, o) => acc + (o.estimatedNetProfitCLP || 0), 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const salesToday = paidOrders
      .filter(o => o.createdAt.startsWith(todayStr))
      .reduce((acc, o) => acc + o.totalPriceCLP, 0);

    return {
      totalOrders: orders.length,
      paidOrdersCount: paidOrders.length,
      pendingOrdersCount: orders.filter(o => o.status === 'PENDING' || o.status === 'IN_PROGRESS' || o.status === 'QUEUED' || o.status === 'PAID_WAITING_PROVIDER_BALANCE').length,
      waitingBalanceCount: orders.filter(o => o.status === 'PAID_WAITING_PROVIDER_BALANCE').length,
      reconciliationCount: orders.filter(o => o.status === 'REQUIRES_RECONCILIATION').length,
      completedOrdersCount: orders.filter(o => o.status === 'COMPLETED').length,
      failedOrdersCount: orders.filter(o => o.status === 'FAILED').length,
      totalSalesCLP,
      salesTodayCLP: salesToday,
      totalCostCLP,
      totalCostUSD: Number(totalCostUSD.toFixed(2)),
      totalGrossProfitCLP,
      totalGatewayFeeCLP,
      totalNetProfitCLP,
    };
  }

  private async persistOrder(order: CommercialOrder): Promise<void> {
    try {
      await adminFirestore.collection('orders').doc(order.id).set(order, { merge: true });
    } catch (e: any) {
      console.warn(`Could not persist order ${order.id} to Firestore:`, e.message);
    }
  }
}

export const orderService = new OrderService();
