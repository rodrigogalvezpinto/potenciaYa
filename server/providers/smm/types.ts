export interface SMMRawService {
  service: string | number;
  name: string;
  type?: string;
  category: string;
  rate: string | number; // Tarifa por cada 1.000 unidades en USD
  min: string | number;
  max: string | number;
  refill: boolean | string | number;
  cancel: boolean | string | number;
  dripfeed?: boolean | string | number;
  desc?: string;
}

export interface SMMAddOrderParams {
  service: string | number;
  link: string;
  quantity: number;
  runs?: number;
  interval?: number;
}

export interface SMMAddOrderResponse {
  order?: number | string;
  error?: string;
}

export interface SMMOrderStatusResponse {
  charge?: string | number;
  start_count?: string | number;
  status?: string; // Pending, In progress, Completed, Partial, Canceled, Processing
  remains?: string | number;
  currency?: string;
  error?: string;
}

export interface SMMBalanceResponse {
  balance?: string | number;
  currency?: string;
  error?: string;
}

export interface SMMRefillResponse {
  refill?: string | number;
  error?: string;
}

export interface SMMRefillStatusResponse {
  status?: string; // Pending, In progress, Completed, Rejected, Error
  error?: string;
}

export interface SMMCancelResponse {
  order?: number | string;
  cancel?: number | string;
  error?: string;
}

export interface ISMMProvider {
  name: string;
  isConfigured(): boolean;
  getServices(): Promise<SMMRawService[]>;
  getBalance(): Promise<SMMBalanceResponse>;
  createOrder(params: SMMAddOrderParams): Promise<SMMAddOrderResponse>;
  getOrderStatus(orderId: string | number): Promise<SMMOrderStatusResponse>;
  getMultipleOrderStatus(orderIds: (string | number)[]): Promise<Record<string, SMMOrderStatusResponse>>;
  requestRefill(orderId: string | number): Promise<SMMRefillResponse>;
  getRefillStatus(refillId: string | number): Promise<SMMRefillStatusResponse>;
  cancelOrder(orderId: string | number): Promise<SMMCancelResponse>;
}
