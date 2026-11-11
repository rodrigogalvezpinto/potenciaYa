import { adminFirestore } from '../firebaseAdmin.ts';
import { notificationService } from './notificationService.ts';

export type JobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RETRY'
  | 'COMPLETED'
  | 'DEAD_LETTER'
  | 'REQUIRES_RECONCILIATION';

export interface QueueJob {
  id: string; // ej: "JOB-ORD-123"
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

export class JobQueueService {
  private jobs: Map<string, QueueJob> = new Map();
  private isProcessing = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.loadJobsFromFirestore().then(() => {
      // Iniciar el worker de la cola periódicamente (cada 20 segundos)
      this.intervalTimer = setInterval(() => {
        this.processPendingJobs().catch(console.warn);
      }, 20000);
    });
  }

  private async loadJobsFromFirestore() {
    try {
      const snap = await adminFirestore.collection('job_queue')
        .where('status', 'in', ['PENDING', 'RETRY', 'PROCESSING', 'REQUIRES_RECONCILIATION'])
        .limit(100)
        .get();

      snap.forEach(doc => {
        this.jobs.set(doc.id, doc.data() as QueueJob);
      });
    } catch (e: any) {
      console.warn('Job queue Firestore read notice:', e.message);
    }
  }

  /**
   * Encola un nuevo trabajo para un pedido pagado que no pudo enviarse de inmediato
   */
  public async enqueue(params: {
    orderId: string;
    type: QueueJob['type'];
    payload: QueueJob['payload'];
    initialStatus?: JobStatus;
    reason?: string;
  }): Promise<QueueJob> {
    const id = `JOB-${params.orderId}`;
    const now = new Date().toISOString();

    const existing = this.jobs.get(id);
    if (existing && existing.status !== 'COMPLETED') {
      console.log(`Trabajo ${id} ya existe en cola con estado ${existing.status}`);
      return existing;
    }

    const job: QueueJob = {
      id,
      orderId: params.orderId,
      type: params.type,
      status: params.initialStatus || 'PENDING',
      attempts: 0,
      maxAttempts: 5,
      nextRunAt: now,
      payload: params.payload,
      errorHistory: params.reason ? [params.reason] : [],
      lastError: params.reason,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);
    await this.persistJob(job);

    await notificationService.notify({
      title: `Pedido encolado para reintento: #${params.orderId}`,
      description: `El pedido pagado ingresó a la cola de procesamiento. Motivo: ${params.reason || 'Esperando disponibilidad de saldo o proveedor.'}`,
      level: job.status === 'REQUIRES_RECONCILIATION' ? 'CRITICAL' : 'WARNING',
      entityType: 'ORDER',
      entityId: params.orderId,
      actionUrl: '/admin?tab=queue',
      recommendedAction: 'Supervisar estado de la cola y saldo mayorista.',
    });

    return job;
  }

  /**
   * Procesa trabajos pendientes con backoff exponencial
   */
  public async processPendingJobs(executeCallback?: (job: QueueJob) => Promise<{ success: boolean; externalId?: string; requiresReconciliation?: boolean; insufficientBalance?: boolean; error?: string }>): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    let processedCount = 0;
    const now = new Date().toISOString();

    try {
      const eligibleJobs = Array.from(this.jobs.values()).filter(
        j => (j.status === 'PENDING' || j.status === 'RETRY') && new Date(j.nextRunAt) <= new Date(now)
      );

      for (const job of eligibleJobs) {
        if (!executeCallback) break;

        job.status = 'PROCESSING';
        job.attempts += 1;
        job.lastAttemptAt = new Date().toISOString();
        job.updatedAt = job.lastAttemptAt;

        try {
          const res = await executeCallback(job);

          if (res.success) {
            job.status = 'COMPLETED';
            job.updatedAt = new Date().toISOString();
            processedCount++;
            await notificationService.notify({
              title: `Pedido recuperado y despachado: #${job.orderId}`,
              description: `El pedido en cola fue aceptado exitosamente por el proveedor. ID Externo: ${res.externalId}`,
              level: 'INFO',
              entityType: 'ORDER',
              entityId: job.orderId,
            });
          } else if (res.requiresReconciliation) {
            job.status = 'REQUIRES_RECONCILIATION';
            job.lastError = res.error || 'Timeout indeterminado en API de proveedor';
            job.errorHistory.push(`${new Date().toISOString()}: ${job.lastError}`);
            job.updatedAt = new Date().toISOString();
            await notificationService.notify({
              title: `Pedido requiere reconciliación: #${job.orderId}`,
              description: `No se tiene certeza de recepción por parte del proveedor tras timeout. Reconciliar antes de reenviar.`,
              level: 'CRITICAL',
              entityType: 'ORDER',
              entityId: job.orderId,
              actionUrl: '/admin?tab=queue',
              recommendedAction: 'Verificar en panel del proveedor o consultar por API.',
            });
          } else if (res.insufficientBalance) {
            job.status = 'RETRY';
            // Backoff exponencial: 2^attempts * 30 segundos
            const delaySeconds = Math.min(Math.pow(2, job.attempts) * 30, 3600);
            job.nextRunAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
            job.lastError = 'Saldo insuficiente en el proveedor';
            job.errorHistory.push(`${new Date().toISOString()}: Saldo insuficiente`);
            job.updatedAt = new Date().toISOString();
          } else {
            if (job.attempts >= job.maxAttempts) {
              job.status = 'DEAD_LETTER';
              await notificationService.notify({
                title: `Pedido enviado a Dead Letter Queue: #${job.orderId}`,
                description: `Superó el límite de ${job.maxAttempts} reintentos. Requiere intervención manual. Error: ${res.error}`,
                level: 'CRITICAL',
                entityType: 'ORDER',
                entityId: job.orderId,
                actionUrl: '/admin?tab=queue',
                recommendedAction: 'Revisar logs técnicos y reintentar manualmente.',
              });
            } else {
              job.status = 'RETRY';
              const delaySeconds = Math.min(Math.pow(2, job.attempts) * 45, 1800);
              job.nextRunAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
              job.lastError = res.error;
              job.errorHistory.push(`${new Date().toISOString()}: ${res.error}`);
            }
            job.updatedAt = new Date().toISOString();
          }
        } catch (err: any) {
          job.status = 'RETRY';
          job.lastError = err.message;
          job.errorHistory.push(`${new Date().toISOString()}: ${err.message}`);
          job.nextRunAt = new Date(Date.now() + 60000).toISOString();
          job.updatedAt = new Date().toISOString();
        }

        await this.persistJob(job);
      }
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  public getJobs(filter?: { status?: JobStatus; search?: string }): QueueJob[] {
    let list = Array.from(this.jobs.values());

    if (filter?.status) {
      list = list.filter(j => j.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(j => j.orderId.toLowerCase().includes(q) || j.id.toLowerCase().includes(q));
    }

    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getJob(id: string): QueueJob | undefined {
    return this.jobs.get(id);
  }

  public async retryJobNow(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.status = 'PENDING';
    job.nextRunAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    await this.persistJob(job);
    return true;
  }

  public async markReconciled(jobId: string, externalId?: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.status = 'COMPLETED';
    job.updatedAt = new Date().toISOString();
    job.errorHistory.push(`Reconciliado manualmente por administrador. ID: ${externalId || 'Confirmado'}`);
    await this.persistJob(job);
    return true;
  }

  public getCounts() {
    const all = Array.from(this.jobs.values());
    return {
      total: all.length,
      pending: all.filter(j => j.status === 'PENDING').length,
      retrying: all.filter(j => j.status === 'RETRY').length,
      requiresReconciliation: all.filter(j => j.status === 'REQUIRES_RECONCILIATION').length,
      deadLetter: all.filter(j => j.status === 'DEAD_LETTER').length,
      completed: all.filter(j => j.status === 'COMPLETED').length,
    };
  }

  private async persistJob(job: QueueJob): Promise<void> {
    try {
      await adminFirestore.collection('job_queue').doc(job.id).set(job, { merge: true });
    } catch (e: any) {
      console.warn(`Could not persist queue job ${job.id}:`, e.message);
    }
  }
}

export const jobQueueService = new JobQueueService();
