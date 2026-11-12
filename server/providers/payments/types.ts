export type PaymentGatewayType = 'FLOW';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED'
  | 'REFUNDED'
  | 'EXPIRED'
  | 'ERROR';

export interface CreatePaymentParams {
  orderId: string;
  amountCLP: number;
  userEmail: string;
  serviceTitle: string;
  returnUrl: string;
  confirmationUrl?: string;
}

export interface CreatePaymentResult {
  paymentId: string;
  gateway: PaymentGatewayType;
  redirectUrl: string;
  url?: string;
  token?: string;
  flowOrder?: number;
}

export interface ConfirmPaymentResult {
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  amountCLP: number;
  authorizationCode?: string;
  gatewayReference?: string;
  rawResponse?: any;
}

export interface IPaymentProvider {
  name: PaymentGatewayType;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  confirmPayment(tokenOrId: string): Promise<ConfirmPaymentResult>;
}
