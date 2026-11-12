import crypto from 'crypto';
import { config } from '../../config.ts';
import { ConfirmPaymentResult, CreatePaymentParams, CreatePaymentResult, IPaymentProvider, PaymentStatus } from './types.ts';

export class FlowPaymentProvider implements IPaymentProvider {
  public name = 'FLOW' as const;
  private apiKey: string;
  private secretKey: string;
  private environment: 'PRODUCTION' | 'SANDBOX';

  constructor() {
    this.apiKey = config.flow.apiKey;
    this.secretKey = config.flow.secretKey;
    this.environment = config.flow.environment;
  }

  private get baseUrl(): string {
    return this.environment === 'SANDBOX'
      ? 'https://sandbox.flow.cl/api'
      : 'https://www.flow.cl/api';
  }

  public isConfigured(): boolean {
    return Boolean(
      this.apiKey &&
      this.secretKey &&
      !this.apiKey.startsWith('YOUR_') &&
      !this.secretKey.startsWith('YOUR_')
    );
  }

  public getEnvironment(): 'PRODUCTION' | 'SANDBOX' {
    return this.environment;
  }

  public updateCredentials(params: { apiKey?: string; secretKey?: string; environment?: 'PRODUCTION' | 'SANDBOX' }) {
    if (params.apiKey !== undefined && params.apiKey.trim()) {
      this.apiKey = params.apiKey.trim();
    }
    if (params.secretKey !== undefined && params.secretKey.trim()) {
      this.secretKey = params.secretKey.trim();
    }
    if (params.environment) {
      this.environment = params.environment;
    }
  }

  /**
   * Firma parámetros según especificación Flow API REST v3:
   * Orden alfabético ascendente por clave (excluyendo 's'), concatenar key + value, HMAC-SHA256 con secretKey.
   */
  private signParams(params: Record<string, string | number>): string {
    const keys = Object.keys(params)
      .filter(k => k !== 's' && params[k] !== undefined && params[k] !== null)
      .sort();

    const toSign = keys.map(k => `${k}${params[k]}`).join('');
    return crypto.createHmac('sha256', this.secretKey).update(toSign).digest('hex');
  }

  private mapFlowStatus(flowStatus: number): PaymentStatus {
    switch (Number(flowStatus)) {
      case 1:
        return 'PENDING';
      case 2:
        return 'APPROVED';
      case 3:
        return 'REJECTED';
      case 4:
        return 'CANCELED';
      default:
        return 'ERROR';
    }
  }

  public async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!this.isConfigured()) {
      throw new Error('Flow.cl no está configurado. Define FLOW_API_KEY y FLOW_SECRET_KEY en el servidor.');
    }

    const amountCLP = Math.max(350, Math.round(params.amountCLP));
    const subject = (params.serviceTitle || `Orden ${params.orderId} PotenciaRedes`)
      .replace(/[^\w\sáéíóúÁÉÍÓÚñÑ.,-]/g, '')
      .slice(0, 120);

    const requestParams: Record<string, string | number> = {
      amount: amountCLP,
      apiKey: this.apiKey,
      commerceOrder: params.orderId,
      currency: 'CLP',
      email: params.userEmail,
      optional: JSON.stringify({ orderId: params.orderId, platform: 'PotenciaRedes' }),
      paymentMethod: config.flow.paymentMethod || 9,
      subject,
      urlConfirmation: params.confirmationUrl || params.returnUrl,
      urlReturn: params.returnUrl,
    };

    const s = this.signParams(requestParams);
    const body = new URLSearchParams();
    Object.entries(requestParams).forEach(([k, v]) => body.append(k, String(v)));
    body.append('s', s);

    const response = await fetch(`${this.baseUrl}/payment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Respuesta inválida de Flow (${response.status}): ${rawText.slice(0, 200)}`);
    }

    if (!response.ok || !data.url || !data.token) {
      const msg = String(data?.message || '');
      if (msg.toLowerCase().includes('useremail') && msg.toLowerCase().includes('not valid')) {
        throw new Error('Flow rechazó el correo ingresado. Usa un correo válido real (ej: @gmail.com, @outlook.com) para emitir tu comprobante.');
      }
      throw new Error(data?.message || `Error Flow HTTP ${response.status}: ${rawText}`);
    }

    const redirectUrl = `${data.url}?token=${encodeURIComponent(data.token)}`;

    return {
      paymentId: data.token,
      gateway: 'FLOW',
      redirectUrl,
      url: data.url,
      token: data.token,
      flowOrder: data.flowOrder,
    };
  }

  public async confirmPayment(token: string): Promise<ConfirmPaymentResult> {
    if (!this.isConfigured()) {
      throw new Error('Flow.cl no está configurado en el servidor.');
    }

    const requestParams: Record<string, string | number> = {
      apiKey: this.apiKey,
      token,
    };
    const s = this.signParams(requestParams);
    const qs = new URLSearchParams({
      apiKey: this.apiKey,
      token,
      s,
    });

    try {
      const response = await fetch(`${this.baseUrl}/payment/getStatus?${qs.toString()}`, {
        method: 'GET',
      });

      const rawText = await response.text();
      const data = JSON.parse(rawText);

      if (!response.ok) {
        throw new Error(data?.message || `Flow getStatus HTTP ${response.status}`);
      }

      const status = this.mapFlowStatus(data.status);
      const paidAmount = Number(data.paymentData?.amount ?? data.amount ?? 0);
      const media = data.paymentData?.media ? String(data.paymentData.media).toUpperCase() : 'FLOW';

      return {
        paymentId: token,
        orderId: data.commerceOrder || '',
        status,
        amountCLP: paidAmount,
        authorizationCode: data.flowOrder ? `${media}-${data.flowOrder}` : undefined,
        gatewayReference: data.flowOrder ? String(data.flowOrder) : undefined,
        rawResponse: data,
      };
    } catch (err: any) {
      console.error('Error confirming Flow transaction:', err);
      return {
        paymentId: token,
        orderId: '',
        status: 'ERROR',
        amountCLP: 0,
        rawResponse: { error: err.message },
      };
    }
  }

  public async getStatusByCommerceId(commerceOrder: string): Promise<ConfirmPaymentResult> {
    if (!this.isConfigured()) {
      throw new Error('Flow.cl no está configurado en el servidor.');
    }

    const requestParams: Record<string, string | number> = {
      apiKey: this.apiKey,
      commerceId: commerceOrder,
    };
    const s = this.signParams(requestParams);
    const qs = new URLSearchParams({
      apiKey: this.apiKey,
      commerceId: commerceOrder,
      s,
    });

    try {
      const response = await fetch(`${this.baseUrl}/payment/getStatusByCommerceId?${qs.toString()}`, {
        method: 'GET',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || `Flow getStatusByCommerceId HTTP ${response.status}`);
      }

      const status = this.mapFlowStatus(data.status);
      const paidAmount = Number(data.paymentData?.amount ?? data.amount ?? 0);
      const media = data.paymentData?.media ? String(data.paymentData.media).toUpperCase() : 'FLOW';

      return {
        paymentId: data.flowOrder ? `FLOW-${data.flowOrder}` : commerceOrder,
        orderId: data.commerceOrder || commerceOrder,
        status,
        amountCLP: paidAmount,
        authorizationCode: data.flowOrder ? `${media}-${data.flowOrder}` : undefined,
        gatewayReference: data.flowOrder ? String(data.flowOrder) : undefined,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        paymentId: commerceOrder,
        orderId: commerceOrder,
        status: 'ERROR',
        amountCLP: 0,
        rawResponse: { error: err.message },
      };
    }
  }
}

export const flowProvider = new FlowPaymentProvider();
