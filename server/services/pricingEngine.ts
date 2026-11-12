import { config } from '../config.ts';

export interface PriceCalculationResult {
  originalRateUSD: number;       // Tarifa proveedor por 1.000 en USD
  costUSD: number;               // Costo proveedor total para la cantidad en USD
  costCLP: number;               // Costo proveedor total en CLP
  exchangeRateCLP: number;       // Tipo de cambio aplicado (USD -> CLP)
  marginPercent: number;         // Margen comercial efectivo porcentual aplicado
  unitPricePer1000CLP: number;   // Precio de venta por cada 1.000 unidades en CLP
  totalPriceCLP: number;         // Total comercial cobrado al cliente en CLP
  estimatedGrossProfitCLP: number; // Ganancia bruta estimada
  estimatedGatewayFeeCLP: number; // Comisión estimada Flow Chile (3.44% IVA incluido)
  estimatedNetProfitCLP: number;   // Ganancia neta estimada
}

export class PricingEngine {
  private currentExchangeRate: number;
  private defaultMarginPercent: number;
  private freeBasePriceCLP: number = 7990;
  private freeMicroPriceCLP: number = 5990;
  private premiumBasePriceCLP: number = 14990;
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

  public getPlanFloorPrices(): {
    freeBasePriceCLP: number;
    freeMicroPriceCLP: number;
    premiumBasePriceCLP: number;
  } {
    return {
      freeBasePriceCLP: this.freeBasePriceCLP,
      freeMicroPriceCLP: this.freeMicroPriceCLP,
      premiumBasePriceCLP: this.premiumBasePriceCLP,
    };
  }

  /**
   * Redondea cualquier monto al múltiplo terminado en .990 más cercano (mínimo $990 CLP).
   * Ejemplos: 7990 -> 7990 | 3995 -> 3990 | 7495 -> 7990 | 12400 -> 11990 | 12500 -> 12990
   */
  public roundTo990CLP(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 990) return 990;
    return Math.max(990, Math.round((Math.round(amount) + 10) / 1000) * 1000 - 10);
  }

  /**
   * Redondea hacia arriba al siguiente precio terminado en .990 CLP para proteger pisos de costo y margen.
   * Ejemplos: 5990 -> 5990 | 5991 -> 6990 | 2000 -> 2990
   */
  public ceilTo990CLP(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 990) return 990;
    return Math.max(990, Math.ceil((Math.round(amount) + 10) / 1000) * 1000 - 10);
  }

  public setPlanFloorPrices(params: {
    freeBasePriceCLP?: number;
    freeMicroPriceCLP?: number;
    premiumBasePriceCLP?: number;
  }): void {
    if (params.freeBasePriceCLP && params.freeBasePriceCLP >= 990) {
      this.freeBasePriceCLP = this.roundTo990CLP(params.freeBasePriceCLP);
    }
    if (params.freeMicroPriceCLP && params.freeMicroPriceCLP >= 990) {
      this.freeMicroPriceCLP = this.roundTo990CLP(params.freeMicroPriceCLP);
    }
    if (params.premiumBasePriceCLP && params.premiumBasePriceCLP >= 990) {
      this.premiumBasePriceCLP = this.roundTo990CLP(params.premiumBasePriceCLP);
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

  private inferTier(serviceId?: string, tier?: 'FREE' | 'PREMIUM'): 'FREE' | 'PREMIUM' {
    if (tier === 'FREE' || tier === 'PREMIUM') return tier;
    if (serviceId && serviceId.toUpperCase().includes('PREMIUM')) return 'PREMIUM';
    return 'FREE';
  }

  private isMicroEngagementCategory(category?: string, serviceId?: string): boolean {
    const combined = `${category || ''} ${serviceId || ''}`.toLowerCase();
    return (
      combined.includes('like') ||
      combined.includes('visualizaci') ||
      combined.includes('vista') ||
      combined.includes('reel') ||
      combined.includes('reproducci')
    );
  }

  /**
   * Tabla inteligente de pisos mínimos por tramos de costo proveedor (CLP x 1.000), siempre terminados en .990:
   * - Costo <= $1.000 CLP: Free micro (likes/vistas) $5.990 CLP | Free seguidores $7.990 CLP | Premium $14.990 CLP
   * - Costo $1.001 - $2.500 CLP: Free $7.990 CLP | Premium $14.990 CLP
   * - Costo $2.501 - $4.500 CLP: Free $11.990 CLP | Premium $14.990 CLP
   * - Costo $4.501 - $6.500 CLP (ej: $5.900): mínimo $14.990 CLP
   * - Costo $6.501 - $10.000 CLP: mínimo $21.990 CLP
   * - Costo > $10.000 CLP: escalado >= 2.1x siempre redondeado a $X.990 CLP
   */
  public getCostBracketFloorCLP(
    costPer1000CLP: number,
    tier: 'FREE' | 'PREMIUM',
    isMicro: boolean
  ): number {
    if (tier === 'PREMIUM') {
      if (costPer1000CLP <= 5500) {
        return this.roundTo990CLP(this.premiumBasePriceCLP); // $14.990 CLP por defecto
      }
      if (costPer1000CLP <= 6800) {
        return Math.max(this.roundTo990CLP(this.premiumBasePriceCLP), 14990);
      }
      if (costPer1000CLP <= 10000) {
        return 21990;
      }
      const scaled = this.ceilTo990CLP(costPer1000CLP * 2.1);
      return Math.max(24990, scaled);
    }

    // Plan FREE
    if (costPer1000CLP <= 1000) {
      return this.roundTo990CLP(isMicro ? this.freeMicroPriceCLP : this.freeBasePriceCLP);
    }
    if (costPer1000CLP <= 2500) {
      return Math.max(this.roundTo990CLP(this.freeBasePriceCLP), 7990);
    }
    if (costPer1000CLP <= 4500) {
      return 11990;
    }
    if (costPer1000CLP <= 6500) {
      return 14990;
    }
    if (costPer1000CLP <= 10000) {
      return 21990;
    }
    const scaled = this.ceilTo990CLP(costPer1000CLP * 2.0);
    return Math.max(24990, scaled);
  }

  /**
   * Calcula el precio comercial exacto para un servicio y cantidad dados.
   * Todos los valores finales (unitario por 1.000 y total a pagar) se redondean estrictamente a .990 CLP.
   */
  public calculate(
    originalRatePer1000USD: number,
    quantity: number,
    serviceId?: string,
    category?: string,
    _gateway: 'FLOW' = 'FLOW',
    tier?: 'FREE' | 'PREMIUM'
  ): PriceCalculationResult {
    const effectiveTier = this.inferTier(serviceId, tier);
    const isMicro = this.isMicroEngagementCategory(category, serviceId);
    const configuredMargin = this.getMarginFor(serviceId, category);
    const exchangeRate = this.currentExchangeRate;

    // Costo proveedor por 1.000 en CLP
    const costPer1000CLP = originalRatePer1000USD * exchangeRate;

    // 1. Piso mínimo por tramo y plan (protege rentabilidad aunque suban tarifas o cambien IDs)
    const floorPer1000CLP = this.getCostBracketFloorCLP(costPer1000CLP, effectiveTier, isMicro);

    // 2. Precio por margen porcentual tradicional redondeado hacia arriba a .990 si supera al piso
    const marginBasedPer1000 = this.ceilTo990CLP(costPer1000CLP * (1 + configuredMargin / 100));

    const unitPricePer1000CLP = Math.max(floorPer1000CLP, marginBasedPer1000);

    // Costo total proveedor en USD y CLP para la cantidad solicitada
    const costUSD = (originalRatePer1000USD / 1000) * quantity;
    const costCLP = Math.round(costUSD * exchangeRate);

    // Total comercial proporcional redondeado estrictamente a .990 CLP
    let totalPriceCLP: number;
    if (quantity === 1000) {
      totalPriceCLP = unitPricePer1000CLP;
    } else {
      const rawTotal = (unitPricePer1000CLP / 1000) * quantity;
      totalPriceCLP = this.roundTo990CLP(rawTotal);
      // Garantizar cobertura mínima de costo + comisión Flow también redondeada a .990 CLP
      const minOrderFloor = Math.max(2990, this.ceilTo990CLP(costCLP * 2.1));
      if (totalPriceCLP < minOrderFloor) {
        totalPriceCLP = minOrderFloor;
      }
    }

    // Ganancia Bruta
    const estimatedGrossProfitCLP = Math.max(0, totalPriceCLP - costCLP);

    // Comisión estimada de pasarela Flow Chile (3.44% IVA incluido)
    const gatewayFeeRate = 0.0344;
    const estimatedGatewayFeeCLP = Math.round(totalPriceCLP * gatewayFeeRate);

    // Ganancia Neta
    const estimatedNetProfitCLP = estimatedGrossProfitCLP - estimatedGatewayFeeCLP;

    // Margen porcentual efectivo real sobre el costo del proveedor
    const effectiveMarginPercent = costCLP > 0
      ? Math.round(((totalPriceCLP - costCLP) / costCLP) * 100)
      : configuredMargin;

    return {
      originalRateUSD: originalRatePer1000USD,
      costUSD: Number(costUSD.toFixed(4)),
      costCLP,
      exchangeRateCLP: exchangeRate,
      marginPercent: effectiveMarginPercent,
      unitPricePer1000CLP,
      totalPriceCLP,
      estimatedGrossProfitCLP,
      estimatedGatewayFeeCLP,
      estimatedNetProfitCLP,
    };
  }
}

export const pricingEngine = new PricingEngine();
