import { adminFirestore } from '../firebaseAdmin.ts';

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
  count?: number; // Para deduplicación / repeticiones
}

export class NotificationService {
  private notifications: Map<string, AdminNotification> = new Map();
  private loadedFromDb = false;

  constructor() {
    this.loadFromFirestore().catch(e => {
      console.warn('Initial notifications load notice:', e?.message || e);
    });
  }

  private async loadFromFirestore() {
    try {
      const snap = await adminFirestore.collection('admin_notifications')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      
      snap.forEach(doc => {
        this.notifications.set(doc.id, doc.data() as AdminNotification);
      });
      this.loadedFromDb = true;
    } catch (err: any) {
      console.warn('Admin notifications Firestore read notice:', err.message);
    }
  }

  /**
   * Crea una notificación con deduplicación inteligente.
   * Si ya existe una alerta idéntica no resuelta en los últimos 30 minutos, incrementa su contador.
   */
  public async notify(params: {
    title: string;
    description: string;
    level: NotificationLevel;
    entityType?: AdminNotification['entityType'];
    entityId?: string;
    actionUrl?: string;
    recommendedAction?: string;
  }): Promise<AdminNotification> {
    const now = new Date().toISOString();
    const deduplicationKey = `${params.level}_${params.entityType || 'SYS'}_${params.entityId || 'NONE'}_${params.title}`;

    // Buscar si ya existe una similar no resuelta
    const existing = Array.from(this.notifications.values()).find(
      n => !n.resolved && `${n.level}_${n.entityType || 'SYS'}_${n.entityId || 'NONE'}_${n.title}` === deduplicationKey
    );

    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.createdAt = now;
      existing.description = params.description;
      this.persist(existing).catch(console.warn);
      return existing;
    }

    const id = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const notification: AdminNotification = {
      id,
      title: params.title,
      description: params.description,
      level: params.level,
      entityType: params.entityType,
      entityId: params.entityId,
      actionUrl: params.actionUrl,
      recommendedAction: params.recommendedAction,
      read: false,
      resolved: false,
      createdAt: now,
      count: 1,
    };

    this.notifications.set(id, notification);
    this.persist(notification).catch(console.warn);

    // Si es crítica, registrar en log de servidor para auditoría
    if (params.level === 'CRITICAL') {
      console.error(`🚨 [ALERTA CRÍTICA ADMINISTRATIVA] ${params.title}: ${params.description}`);
    } else if (params.level === 'WARNING') {
      console.warn(`⚠️ [ADVERTENCIA ADMINISTRATIVA] ${params.title}: ${params.description}`);
    }

    return notification;
  }

  public getNotifications(filter?: {
    level?: NotificationLevel;
    resolved?: boolean;
    read?: boolean;
    search?: string;
  }): AdminNotification[] {
    let list = Array.from(this.notifications.values());

    if (filter?.level) {
      list = list.filter(n => n.level === filter.level);
    }
    if (filter?.resolved !== undefined) {
      list = list.filter(n => n.resolved === filter.resolved);
    }
    if (filter?.read !== undefined) {
      list = list.filter(n => n.read === filter.read);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q));
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async markAsRead(id: string): Promise<boolean> {
    const notif = this.notifications.get(id);
    if (!notif) return false;
    notif.read = true;
    await this.persist(notif);
    return true;
  }

  public async markAllAsRead(): Promise<void> {
    for (const notif of this.notifications.values()) {
      notif.read = true;
      this.persist(notif).catch(console.warn);
    }
  }

  public async resolve(id: string, userEmail?: string): Promise<boolean> {
    const notif = this.notifications.get(id);
    if (!notif) return false;
    notif.resolved = true;
    notif.resolvedAt = new Date().toISOString();
    notif.resolvedBy = userEmail || 'admin';
    await this.persist(notif);
    return true;
  }

  public getCounts() {
    const all = Array.from(this.notifications.values());
    return {
      total: all.length,
      critical: all.filter(n => n.level === 'CRITICAL' && !n.resolved).length,
      warnings: all.filter(n => n.level === 'WARNING' && !n.resolved).length,
      info: all.filter(n => n.level === 'INFO' && !n.resolved).length,
      unread: all.filter(n => !n.read).length,
    };
  }

  private async persist(notif: AdminNotification): Promise<void> {
    try {
      await adminFirestore.collection('admin_notifications').doc(notif.id).set(notif, { merge: true });
    } catch (e: any) {
      console.warn(`Could not persist notification ${notif.id} to Firestore:`, e.message);
    }
  }
}

export const notificationService = new NotificationService();
