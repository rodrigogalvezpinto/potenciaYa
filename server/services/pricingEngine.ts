import { config } from '../config.ts';

export interface PriceCalculationResult {
  originalRateUSD: number;       // Tarifa proveedor por 1.000 en USD
  costUSD: number;               // Costo proveedor total para la cantidad en USD
  costCLP: number;               // Costo proveedor total en CLP
  exchangeRateCLP: number;       // Tipo de cambio aplicado (USD -> CLP)
  marginPercent: number;         // Margen comercial porcentual aplicado
  unitPricePer1000CLP: number;   // Precio de venta por cada 1.000 unidades en CLP
  totalPriceCLP: number;         // Total comercial cobrado al cliente en CLP (redondeado)
  estimatedGrossProfitCLP: number; // Ganancia bruta estimada
  estimatedGatewayFeeCLP: number; // Comisión estimada de pasarela (aprox. 3.19% + IVA)
  estimatedNetProfitCLP: number;   // Ganancia neta estimada
}

export class PricingEngine {
  private currentExchangeRate: number;
  private defaultMarginPercent: number;
  private categoryMargins: Map<string, number> = new Map();
  private serviceMargins: Map<string, number> = new Map();

  constructor() {
    this.currentExchangeRate = config.pricing.defaultUsdClpRate;
    this.defaultMarginPercent = config.pricing.defaultGlobalMarginPercent;
  }

  public getExchangeRate(): number {
    return this.currentExchangeRate;
  }

  public setExchangeRate(rate: number): void {
    if (rate > 0) {
      this.currentExchangeRate = rate;
    }
  }

  public getDefaultMargin(): number {
    return this.defaultMarginPercent;
  }

  public setDefaultMargin(margin: number): void {
    if (margin >= 0) {
      this.defaultMarginPercent = margin;
    }
  }

  public setCategoryMargin(category: string, margin: number): void {
    this.categoryMargins.set(category.toLowerCase(), margin);
  }

  public setServiceMargin(serviceId: string, margin: number): void {
    this.serviceMargins.set(serviceId, margin);
  }

  public getMarginFor(serviceId?: string, category?: string): number {
    if (serviceId && this.serviceMargins.has(serviceId)) {
      return this.serviceMargins.get(serviceId)!;
    }
    if (category && this.categoryMargins.has(category.toLowerCase())) {
      return this.categoryMargins.get(category.toLowerCase())!;
    }
    return this.defaultMarginPercent;
  }

  /**
   * Calcula el precio comercial exacto para un servicio y cantidad dados.
   * La fórmula aplica: Costo Base + Margen Comercial + Redondeo psicológico chileno.
   */
  public calculate(
    originalRatePer1000USD: number,
    quantity: number,
    serviceId?: string,
    category?: string,
    gateway: 'WEBPAY' | 'MERCADOPAGO' = 'WEBPAY'
  ): PriceCalculationResult {
    const marginPercent = this.getMarginFor(serviceId, category);
    const exchangeRate = this.currentExchangeRate;

    // Costo proveedor por 1.000 en CLP
    const costPer1000CLP = originalRatePer1000USD * exchangeRate;
    
    // Precio venta por 1.000 en CLP con margen
    const multiplier = 1 + marginPercent / 100;
    const rawCommercialRatePer1000CLP = costPer1000CLP * multiplier;

    // Total en CLP proporcional a la cantidad
    const rawTotalPriceCLP = (rawCommercialRatePer1000CLP / 1000) * quantity;

    // En Chile no hay centavos. Redondear al múltiplo de $10 o $50 superior para presentación limpia
    let totalPriceCLP = Math.ceil(rawTotalPriceCLP / 10) * 10;
    if (totalPriceCLP < 500) {
      // Precio mínimo por orden para asegurar cobertura de comisión bancaria
      totalPriceCLP = 500;
    }

    // Costo total proveedor en USD y CLP
    const costUSD = (originalRatePer1000USD / 1000) * quantity;
    const costCLP = Math.round(costUSD * exchangeRate);

    // Ganancia Bruta
    const estimatedGrossProfitCLP = Math.max(0, totalPriceCLP - costCLP);

    // Comisión estimada de pasarela (Transbank / MP aprox 3.19% total con IVA)
    const gatewayFeeRate = gateway === 'WEBPAY' ? 0.029 : 0.034;
    const estimatedGatewayFeeCLP = Math.round(totalPriceCLP * gatewayFeeRate);

    // Ganancia Neta
    const estimatedNetProfitCLP = estimatedGrossProfitCLP - estimatedGatewayFeeCLP;

    // Tarifa por 1000 redondeada para catálogo
    const unitPricePer1000CLP = Math.round(rawCommercialRatePer1000CLP / 10) * 10;

    return {
      originalRateUSD: originalRatePer1000USD,
      costUSD: Number(costUSD.toFixed(4)),
      costCLP,
      exchangeRateCLP: exchangeRate,
      marginPercent,
      unitPricePer1000CLP,
      totalPriceCLP,
      estimatedGrossProfitCLP,
      estimatedGatewayFeeCLP,
      estimatedNetProfitCLP,
    };
  }
}

export const pricingEngine = new PricingEngine();
