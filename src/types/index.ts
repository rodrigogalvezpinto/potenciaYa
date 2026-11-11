export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';

export type ServiceTier = 'ECONOMICO' | 'ESTANDAR' | 'PREMIUM';

export type SyncStatus = 'SYNCED' | 'MODIFIED' | 'POSSIBLY_UNAVAILABLE' | 'INACTIVE';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  status: 'ACTIVE' | 'BLOCKED';
  totalSpent?: number;
  orderCount?: number;
  createdAt: string;
}

export interface ServiceChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
}

export interface ProviderTechnicalService {
  id: string;
  provider: string;
  providerServiceId: string;
  name: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'Facebook' | 'X' | 'Spotify' | 'Telegram' | 'Otro';
  category: string;
  serviceType: string;
  rateUSD: number;
  currency: string;
  minQuantity: number;
  maxQuantity: number;
  available: boolean;
  refill: boolean;
  cancel: boolean;
  dripfeed?: boolean;
  description: string;
  lastSyncedAt: string;
  syncStatus: SyncStatus;
  changeHistory: ServiceChangeRecord[];
}

export interface CommercialCatalogService {
  id: string;
  published: boolean;
  commercialName: string;
  description: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'Facebook' | 'X' | 'Spotify' | 'Telegram' | 'Otro';
  commercialCategory: string;
  tier: ServiceTier;
  technicalServiceId: string;
  provider: string;
  originalRateUSD: number;
  commercialRateCLP: number;
  minQuantity: number;
  maxQuantity: number;
  refill: boolean;
  refillDays?: number;
  cancel: boolean;
  linkType: string;
  featured: boolean;
  customMarginPercent?: number;
  manualProviderSelection: boolean;
  priorityScore?: number;
  updatedAt: string;
}

// Compatibilidad
export type CommercialService = CommercialCatalogService;

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

export interface OrderHistoryItem {
  status: OrderStatus;
  timestamp: string;
  note: string;
}

export interface CommercialOrder {
  id: string;
  userId: string;
  userEmail: string;
  serviceId: string;
  serviceName: string;
  platform: string;
  targetUrl: string;
  quantity: number;
  unitPricePer1000CLP: number;
  totalPriceCLP: number;
  providerCostUSD: number;
  providerCostCLP: number;
  exchangeRateCLP: number;
  marginPercent: number;
  estimatedGrossProfitCLP: number;
  estimatedGatewayFeeCLP: number;
  estimatedNetProfitCLP: number;
  status: OrderStatus;
  paymentId?: string;
  paymentGateway?: 'WEBPAY_PLUS' | 'MERCADO_PAGO';
  providerOrderId?: string;
  providerStatus?: string;
  startCount?: number;
  remains?: number;
  refillAvailable: boolean;
  cancelAvailable: boolean;
  refillCount?: number;
  lastRefillId?: string;
  createdAt: string;
  updatedAt: string;
  history: OrderHistoryItem[];
  errorLogs?: string[];
}

export type JobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RETRY'
  | 'COMPLETED'
  | 'DEAD_LETTER'
  | 'REQUIRES_RECONCILIATION';

export interface QueueJob {
  id: string;
  orderId: string;
  type: 'DISPATCH_PROVIDER_ORDER' | 'RECONCILE_ORDER' | 'POLL_STATUS';
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  lastAttemptAt?: string;
  payload: {
    serviceId: string;
    providerServiceId: string;
    targetUrl: string;
    quantity: number;
    userEmail: string;
    costUSD: number;
  };
  errorHistory: string[];
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export interface AdminNotification {
  id: string;
  title: string;
  description: string;
  level: NotificationLevel;
  entityType?: 'ORDER' | 'PROVIDER' | 'SERVICE' | 'BALANCE' | 'PAYMENT' | 'SYSTEM';
  entityId?: string;
  actionUrl?: string;
  recommendedAction?: string;
  read: boolean;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  count?: number;
}

export type BalanceStatus = 'NORMAL' | 'LOW' | 'CRITICAL' | 'INSUFFICIENT' | 'UNKNOWN';

export interface ProviderBalanceRecord {
  id: string;
  provider: string;
  balance: number;
  currency: string;
  status: BalanceStatus;
  timestamp: string;
  success: boolean;
  rawResponse?: any;
}

export interface BalanceThresholds {
  lowUSD: number;
  criticalUSD: number;
  insufficientUSD: number;
}

export interface SyncHistoryRecord {
  id: string;
  provider: string;
  timestamp: string;
  totalFetched: number;
  newServicesCount: number;
  modifiedCount: number;
  missingCount: number;
  success: boolean;
  error?: string;
}

export interface FinancialMetrics {
  totalOrders: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  waitingBalanceCount: number;
  reconciliationCount: number;
  completedOrdersCount: number;
  failedOrdersCount: number;
  totalSalesCLP: number;
  salesTodayCLP: number;
  totalCostCLP: number;
  totalCostUSD: number;
  totalGrossProfitCLP: number;
  totalGatewayFeeCLP: number;
  totalNetProfitCLP: number;
}

export interface TestResult {
  scenarioNumber: number;
  title: string;
  passed: boolean;
  details: string;
  timestamp: string;
}

export interface SystemSettings {
  usdClpRate: number;
  defaultGlobalMarginPercent: number;
  systemFollowsApiUrl: string;
  systemFollowsConfigured: boolean;
  webpayEnvironment: string;
  webpayCommerceCode: string;
  mercadopagoEnvironment: string;
  adminEmails: string[];
  thresholds?: BalanceThresholds;
}
