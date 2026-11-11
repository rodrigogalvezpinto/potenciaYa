import { systemFollowsProvider } from '../providers/smm/systemFollows.ts';
import { notificationService } from './notificationService.ts';
import { adminFirestore } from '../firebaseAdmin.ts';

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
  lowUSD: number;       // Umbral para advertencia (ej: $30 USD)
  criticalUSD: number;  // Umbral crítico (ej: $10 USD)
  insufficientUSD: number; // Umbral de saldo insuficiente (ej: $2 USD)
}

export class BalanceService {
  private latestRecord: ProviderBalanceRecord | null = null;
  private lastSuccessfulTime: string | null = null;
  private history: ProviderBalanceRecord[] = [];
  private thresholds: BalanceThresholds = {
    lowUSD: 30.0,
    criticalUSD: 10.0,
    insufficientUSD: 2.0,
  };

  constructor() {
    this.loadHistoryFromFirestore().catch(console.warn);
  }

  private async loadHistoryFromFirestore() {
    try {
      const snap = await adminFirestore.collection('provider_balance_history')
        .orderBy('timestamp', 'desc')
        .limit(30)
        .get();
      
      const records: ProviderBalanceRecord[] = [];
      snap.forEach(doc => {
        records.push(doc.data() as ProviderBalanceRecord);
      });
      if (records.length > 0) {
        this.history = records;
        this.latestRecord = records[0];
        if (records[0].success) {
          this.lastSuccessfulTime = records[0].timestamp;
        }
      }
    } catch (e: any) {
      console.warn('Balance history Firestore read notice:', e.message);
    }
  }

  public getThresholds(): BalanceThresholds {
    return this.thresholds;
  }

  public setThresholds(thresholds: Partial<BalanceThresholds>): BalanceThresholds {
    this.thresholds = { ...this.thresholds, ...thresholds };
    return this.thresholds;
  }

  /**
   * Consulta el saldo real del proveedor SMM, evalúa umbrales y emite alertas si corresponde.
   */
  public async checkBalance(providerName = 'SystemFollows'): Promise<ProviderBalanceRecord> {
    const now = new Date().toISOString();
    const id = `BAL-${Date.now()}`;

    try {
      const res = await systemFollowsProvider.getBalance();
      const balanceNum = typeof res.balance === 'string' ? parseFloat(res.balance) : (res.balance || 0);
      const isSuccess = !res.error && !isNaN(balanceNum);

      let status: BalanceStatus = 'NORMAL';
      if (!isSuccess) {
        status = 'UNKNOWN';
      } else if (balanceNum <= this.thresholds.insufficientUSD) {
        status = 'INSUFFICIENT';
      } else if (balanceNum <= this.thresholds.criticalUSD) {
        status = 'CRITICAL';
      } else if (balanceNum <= this.thresholds.lowUSD) {
        status = 'LOW';
      }

      const record: ProviderBalanceRecord = {
        id,
        provider: providerName,
        balance: isSuccess ? balanceNum : (this.latestRecord?.balance || 0),
        currency: res.currency || 'USD',
        status,
        timestamp: now,
        success: isSuccess,
        rawResponse: res,
      };

      this.latestRecord = record;
      this.history.unshift(record);
      if (this.history.length > 50) this.history.pop();

      if (isSuccess) {
        this.lastSuccessfulTime = now;
      }

      // Evaluar alertas según umbral
      if (status === 'INSUFFICIENT') {
        await notificationService.notify({
          title: `Saldo Insuficiente en ${providerName}`,
          description: `El saldo actual es de $${balanceNum.toFixed(2)} USD (inferior al umbral mínimo de $${this.thresholds.insufficientUSD} USD). Los nuevos pedidos pagados quedarán en cola esperando recarga.`,
          level: 'CRITICAL',
          entityType: 'BALANCE',
          actionUrl: '/admin?tab=balance',
          recommendedAction: `Recargar fondos de inmediato en la cuenta mayorista de ${providerName}.`,
        });
      } else if (status === 'CRITICAL') {
        await notificationService.notify({
          title: `Saldo Crítico en ${providerName}`,
          description: `El saldo disponible es de solo $${balanceNum.toFixed(2)} USD. Riesgo inminente de detención de despacho.`,
          level: 'CRITICAL',
          entityType: 'BALANCE',
          actionUrl: '/admin?tab=balance',
          recommendedAction: 'Preparar recarga de saldo preventiva en el proveedor.',
        });
      } else if (status === 'LOW') {
        await notificationService.notify({
          title: `Advertencia: Saldo Bajo en ${providerName}`,
          description: `El saldo ha descendido a $${balanceNum.toFixed(2)} USD (umbral de advertencia: $${this.thresholds.lowUSD} USD).`,
          level: 'WARNING',
          entityType: 'BALANCE',
          actionUrl: '/admin?tab=balance',
          recommendedAction: 'Supervisar el flujo de compras y programar recarga.',
        });
      }

      // Persistir registro en Firestore
      this.persistRecord(record).catch(console.warn);

      return record;
    } catch (err: any) {
      const errorRecord: ProviderBalanceRecord = {
        id,
        provider: providerName,
        balance: this.latestRecord?.balance || 0,
        currency: 'USD',
        status: 'UNKNOWN',
        timestamp: now,
        success: false,
        rawResponse: { error: err.message },
      };

      this.latestRecord = errorRecord;
      await notificationService.notify({
        title: `Error al consultar saldo en ${providerName}`,
        description: `No fue posible conectar con la API de ${providerName}: ${err.message}`,
        level: 'WARNING',
        entityType: 'PROVIDER',
        actionUrl: '/admin?tab=balance',
        recommendedAction: 'Verificar estado de la red y validez de la API Key.',
      });

      return errorRecord;
    }
  }

  /**
   * Comprueba si el saldo actual del proveedor cubre el costo requerido en USD
   */
  public hasSufficientBalance(requiredUSD: number): boolean {
    if (!this.latestRecord || !this.latestRecord.success) {
      // Si aún no hemos consultado, considerar disponible pero con monitoreo
      return true;
    }
    return this.latestRecord.balance >= requiredUSD;
  }

  public getStatus() {
    return {
      currentBalance: this.latestRecord?.balance ?? null,
      currency: this.latestRecord?.currency ?? 'USD',
      status: this.latestRecord?.status ?? 'UNKNOWN',
      lastCheckTime: this.latestRecord?.timestamp ?? null,
      lastSuccessfulTime: this.lastSuccessfulTime,
      thresholds: this.thresholds,
      historyCount: this.history.length,
      history: this.history.slice(0, 15),
    };
  }

  private async persistRecord(record: ProviderBalanceRecord): Promise<void> {
    try {
      await adminFirestore.collection('provider_balance_history').doc(record.id).set(record, { merge: true });
    } catch (e: any) {
      console.warn(`Could not persist balance record ${record.id}:`, e.message);
    }
  }
}

export const balanceService = new BalanceService();
