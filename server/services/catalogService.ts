import { systemFollowsProvider } from '../providers/smm/systemFollows.ts';
import { SMMRawService } from '../providers/smm/types.ts';
import { pricingEngine } from './pricingEngine.ts';
import { notificationService } from './notificationService.ts';
import { adminFirestore } from '../firebaseAdmin.ts';

export type ServiceTier = 'ECONOMICO' | 'ESTANDAR' | 'PREMIUM';

export type SyncStatus = 'SYNCED' | 'MODIFIED' | 'POSSIBLY_UNAVAILABLE' | 'INACTIVE';

export interface ServiceChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
}

// -------------------------------------------------------------
// NIVEL 1: CATÁLOGO TÉCNICO DE PROVEEDORES
// -------------------------------------------------------------
export interface ProviderTechnicalService {
  id: string; // ej: "SF-101"
  provider: string; // "SystemFollows"
  providerServiceId: string;
  name: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'Facebook' | 'X' | 'Spotify' | 'Telegram' | 'Otro';
  category: string;
  serviceType: string;
  rateUSD: number; // Tarifa por 1000 en USD
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

// -------------------------------------------------------------
// NIVEL 2: CATÁLOGO COMERCIAL DE POTENCIAREDES
// -------------------------------------------------------------
export interface CommercialCatalogService {
  id: string; // ej: "COMM-IG-SEGUIDORES-PREMIUM"
  published: boolean;
  commercialName: string;
  description: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'Facebook' | 'X' | 'Spotify' | 'Telegram' | 'Otro';
  commercialCategory: string; // "Seguidores", "Likes", "Visualizaciones", "Comentarios"
  tier: ServiceTier; // ECONOMICO, ESTANDAR, PREMIUM
  technicalServiceId: string; // ID del servicio técnico activo asociado
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

export class CatalogService {
  // Catálogo Técnico de Proveedores
  private technicalServices: Map<string, ProviderTechnicalService> = new Map();
  // Catálogo Comercial de PotenciaRedes
  private commercialServices: Map<string, CommercialCatalogService> = new Map();
  // Historial de sincronizaciones
  private syncHistory: SyncHistoryRecord[] = [];
  private lastSyncTime: string | null = null;
  private isSyncing = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    await this.loadFromFirestore();
    // Ejecutar primera sincronización con el catálogo base de SystemFollows
    await this.syncTechnicalCatalog();
  }

  private async loadFromFirestore() {
    try {
      const techSnap = await adminFirestore.collection('provider_services').limit(200).get();
      techSnap.forEach(doc => {
        this.technicalServices.set(doc.id, doc.data() as ProviderTechnicalService);
      });

      const commSnap = await adminFirestore.collection('commercial_services').limit(200).get();
      commSnap.forEach(doc => {
        this.commercialServices.set(doc.id, doc.data() as CommercialCatalogService);
      });

      const syncSnap = await adminFirestore.collection('provider_sync_history')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      syncSnap.forEach(doc => {
        this.syncHistory.push(doc.data() as SyncHistoryRecord);
      });
    } catch (e: any) {
      console.warn('Initial catalog Firestore load notice:', e.message);
    }
  }

  public detectPlatform(name: string, category: string): ProviderTechnicalService['platform'] {
    const combined = `${name} ${category}`.toLowerCase();
    if (combined.includes('instagram') || combined.includes('ig ')) return 'Instagram';
    if (combined.includes('tiktok') || combined.includes('tik tok')) return 'TikTok';
    if (combined.includes('youtube') || combined.includes('yt ')) return 'YouTube';
    if (combined.includes('facebook') || combined.includes('fb ')) return 'Facebook';
    if (combined.includes('twitter') || combined.includes(' x ') || combined.startsWith('x ')) return 'X';
    if (combined.includes('spotify')) return 'Spotify';
    if (combined.includes('telegram') || combined.includes('tg ')) return 'Telegram';
    return 'Otro';
  }

  public detectCommercialCategory(name: string, category: string): string {
    const combined = `${name} ${category}`.toLowerCase();
    if (combined.includes('seguidor') || combined.includes('follower')) return 'Seguidores';
    if (combined.includes('like') || combined.includes('me gusta')) return 'Likes';
    if (combined.includes('reproducci') || combined.includes('vista') || combined.includes('view')) return 'Visualizaciones';
    if (combined.includes('comentario') || combined.includes('comment')) return 'Comentarios';
    if (combined.includes('oyente') || combined.includes('listener')) return 'Oyentes';
    if (combined.includes('miembro') || combined.includes('member')) return 'Miembros';
    return 'Otros Servicios';
  }

  /**
   * Sincronización Inteligente del Catálogo Técnico desde SystemFollows
   */
  public async syncTechnicalCatalog(providerName = 'SystemFollows'): Promise<SyncHistoryRecord> {
    if (this.isSyncing) {
      return {
        id: `SYNC-${Date.now()}`,
        provider: providerName,
        timestamp: this.lastSyncTime || new Date().toISOString(),
        totalFetched: this.technicalServices.size,
        newServicesCount: 0,
        modifiedCount: 0,
        missingCount: 0,
        success: true,
      };
    }

    this.isSyncing = true;
    const now = new Date().toISOString();
    const syncId = `SYNC-${Date.now()}`;

    try {
      const rawList = await systemFollowsProvider.getServices();
      const currentFetchedIds = new Set<string>();

      let newCount = 0;
      let modCount = 0;
      let missingCount = 0;

      for (const raw of rawList) {
        const providerServiceId = String(raw.service);
        const internalId = `${providerName.substring(0, 2).toUpperCase()}-${providerServiceId}`;
        currentFetchedIds.add(internalId);

        const rateUSD = typeof raw.rate === 'string' ? parseFloat(raw.rate) : raw.rate;
        const minQty = typeof raw.min === 'string' ? parseInt(raw.min, 10) : raw.min;
        const maxQty = typeof raw.max === 'string' ? parseInt(raw.max, 10) : raw.max;
        const hasRefill = raw.refill === true || raw.refill === '1' || raw.refill === 1;
        const hasCancel = raw.cancel === true || raw.cancel === '1' || raw.cancel === 1;
        const platform = this.detectPlatform(raw.name, raw.category);

        const existing = this.technicalServices.get(internalId);

        if (!existing) {
          // 1. Servicio nuevo detectado
          newCount++;
          const newService: ProviderTechnicalService = {
            id: internalId,
            provider: providerName,
            providerServiceId,
            name: raw.name,
            platform,
            category: raw.category,
            serviceType: raw.type || 'Default',
            rateUSD,
            currency: 'USD',
            minQuantity: minQty || 10,
            maxQuantity: maxQty || 100000,
            available: true,
            refill: hasRefill,
            cancel: hasCancel,
            dripfeed: Boolean(raw.dripfeed),
            description: raw.desc || '',
            lastSyncedAt: now,
            syncStatus: 'SYNCED',
            changeHistory: [],
          };
          this.technicalServices.set(internalId, newService);
          this.persistTechnicalService(newService).catch(console.warn);

          // Notificar servicio nuevo
          await notificationService.notify({
            title: `Nuevo servicio detectado en ${providerName}`,
            description: `Se detectó "${raw.name}" (ID #${providerServiceId}) en ${platform}. Disponible para revisión y publicación comercial.`,
            level: 'INFO',
            entityType: 'SERVICE',
            entityId: internalId,
            actionUrl: '/admin?tab=catalog',
            recommendedAction: 'Revisar y asignar modalidad comercial en el catálogo comercial.',
          });
        } else {
          // 2. Verificar modificaciones contra versión anterior
          const changes: ServiceChangeRecord[] = [];
          if (existing.rateUSD !== rateUSD) {
            changes.push({ field: 'rateUSD', oldValue: existing.rateUSD, newValue: rateUSD, timestamp: now });
            // Alerta si el precio subió más de 15%
            const percentIncrease = ((rateUSD - existing.rateUSD) / existing.rateUSD) * 100;
            if (percentIncrease > 15) {
              await notificationService.notify({
                title: `Aumento de tarifa en servicio #${providerServiceId}`,
                description: `El servicio "${existing.name}" subió un ${percentIncrease.toFixed(1)}% (de $${existing.rateUSD} a $${rateUSD} USD).`,
                level: 'WARNING',
                entityType: 'SERVICE',
                entityId: internalId,
                actionUrl: '/admin?tab=catalog',
                recommendedAction: 'Verificar impacto en el margen de ganancia comercial.',
              });
            }
          }
          if (existing.minQuantity !== minQty) {
            changes.push({ field: 'minQuantity', oldValue: existing.minQuantity, newValue: minQty, timestamp: now });
          }
          if (existing.maxQuantity !== maxQty) {
            changes.push({ field: 'maxQuantity', oldValue: existing.maxQuantity, newValue: maxQty, timestamp: now });
          }
          if (existing.refill !== hasRefill) {
            changes.push({ field: 'refill', oldValue: existing.refill, newValue: hasRefill, timestamp: now });
          }

          if (changes.length > 0) {
            modCount++;
            existing.changeHistory = [...existing.changeHistory, ...changes];
            existing.rateUSD = rateUSD;
            existing.minQuantity = minQty;
            existing.maxQuantity = maxQty;
            existing.refill = hasRefill;
            existing.cancel = hasCancel;
            existing.name = raw.name;
            existing.syncStatus = 'MODIFIED';
            existing.available = true;
            existing.lastSyncedAt = now;
            this.persistTechnicalService(existing).catch(console.warn);
          } else {
            existing.lastSyncedAt = now;
            existing.syncStatus = 'SYNCED';
            existing.available = true;
          }
        }
      }

      // 3. Detectar servicios que desaparecieron de la respuesta
      for (const [id, techService] of this.technicalServices.entries()) {
        if (techService.provider === providerName && !currentFetchedIds.has(id)) {
          missingCount++;
          if (techService.syncStatus === 'POSSIBLY_UNAVAILABLE') {
            // Confirmado por segunda sincronización
            techService.syncStatus = 'INACTIVE';
            techService.available = false;
            techService.lastSyncedAt = now;
            await notificationService.notify({
              title: `Servicio desactivado por el proveedor`,
              description: `"${techService.name}" (#${techService.providerServiceId}) ha sido confirmado como inactivo en ${providerName}.`,
              level: 'WARNING',
              entityType: 'SERVICE',
              entityId: id,
              actionUrl: '/admin?tab=catalog',
              recommendedAction: 'Verificar si existen pedidos pendientes o reemplazar servicio comercial asociado.',
            });
          } else {
            // Primera ausencia: marcar temporalmente pero NO borrar
            techService.syncStatus = 'POSSIBLY_UNAVAILABLE';
            techService.lastSyncedAt = now;
          }
          this.persistTechnicalService(techService).catch(console.warn);
        }
      }

      this.lastSyncTime = now;

      // 4. Actualizar o generar el Catálogo Comercial inteligente (auto-clasificación en Económico, Estándar, Premium)
      this.rebuildCommercialCatalog();

      const record: SyncHistoryRecord = {
        id: syncId,
        provider: providerName,
        timestamp: now,
        totalFetched: rawList.length,
        newServicesCount: newCount,
        modifiedCount: modCount,
        missingCount,
        success: true,
      };

      this.syncHistory.unshift(record);
      if (this.syncHistory.length > 30) this.syncHistory.pop();
      this.persistSyncRecord(record).catch(console.warn);

      return record;
    } catch (err: any) {
      console.error('Error during catalog sync:', err);
      const errRecord: SyncHistoryRecord = {
        id: syncId,
        provider: providerName,
        timestamp: now,
        totalFetched: 0,
        newServicesCount: 0,
        modifiedCount: 0,
        missingCount: 0,
        success: false,
        error: err.message,
      };
      this.syncHistory.unshift(errRecord);
      return errRecord;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Reconstruye y clasifica el Catálogo Comercial agrupando por Plataforma y Categoría.
   * Divide en Económico, Estándar y Premium cuando existen alternativas verificadas.
   */
  public rebuildCommercialCatalog(): void {
    const activeTechServices = Array.from(this.technicalServices.values()).filter(s => s.available);

    // Agrupar por plataforma y categoría comercial
    const groups = new Map<string, ProviderTechnicalService[]>();
    for (const service of activeTechServices) {
      const commCategory = this.detectCommercialCategory(service.name, service.category);
      const groupKey = `${service.platform}:::${commCategory}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(service);
    }

    const now = new Date().toISOString();

    for (const [groupKey, serviceList] of groups.entries()) {
      const [platform, commercialCategory] = groupKey.split(':::') as [ProviderTechnicalService['platform'], string];

      // Ordenar por precio ascendente
      const sortedByPrice = [...serviceList].sort((a, b) => a.rateUSD - b.rateUSD);

      // Si hay servicios con refill, identificar el mejor candidato para Premium
      const withRefill = serviceList.filter(s => s.refill);
      const bestRefill = withRefill.length > 0 ? withRefill.sort((a, b) => b.rateUSD - a.rateUSD)[0] : null;

      // 1. Modalidad Económico: menor precio, enfocado en volumen/precio competitivo
      const econCandidate = sortedByPrice[0];
      if (econCandidate) {
        this.upsertCommercialService({
          id: `COMM-${platform.toUpperCase()}-${commercialCategory.toUpperCase()}-ECONOMICO`,
          platform,
          commercialCategory,
          tier: 'ECONOMICO',
          technicalServiceId: econCandidate.id,
          candidate: econCandidate,
          titleSuffix: 'Económico (Precio Mayorista)',
          descriptionSuffix: 'Modalidad económica orientada a máxima cantidad al menor costo en pesos chilenos.',
          now,
        });
      }

      // 2. Modalidad Estándar: equilibrio calidad/precio
      if (sortedByPrice.length > 1) {
        const midIdx = Math.floor(sortedByPrice.length / 2);
        const standardCandidate = sortedByPrice[midIdx];
        this.upsertCommercialService({
          id: `COMM-${platform.toUpperCase()}-${commercialCategory.toUpperCase()}-ESTANDAR`,
          platform,
          commercialCategory,
          tier: 'ESTANDAR',
          technicalServiceId: standardCandidate.id,
          candidate: standardCandidate,
          titleSuffix: 'Estándar (Equilibrio y Calidad)',
          descriptionSuffix: 'Velocidad optimizada y mayor estabilidad para perfiles en crecimiento continuo.',
          now,
        });
      }

      // 3. Modalidad Premium: mayor calidad, retención y garantía de Refill (si existe candidato con refill)
      if (bestRefill && bestRefill.id !== econCandidate.id) {
        this.upsertCommercialService({
          id: `COMM-${platform.toUpperCase()}-${commercialCategory.toUpperCase()}-PREMIUM`,
          platform,
          commercialCategory,
          tier: 'PREMIUM',
          technicalServiceId: bestRefill.id,
          candidate: bestRefill,
          titleSuffix: 'Premium (Alta Retención & 30 Días Refill)',
          descriptionSuffix: 'Máxima calidad documentada con garantía de reposición ante caídas por 30 días.',
          now,
        });
      }
    }
  }

  private upsertCommercialService(params: {
    id: string;
    platform: ProviderTechnicalService['platform'];
    commercialCategory: string;
    tier: ServiceTier;
    technicalServiceId: string;
    candidate: ProviderTechnicalService;
    titleSuffix: string;
    descriptionSuffix: string;
    now: string;
  }) {
    const existing = this.commercialServices.get(params.id);
    const tech = this.technicalServices.get(params.technicalServiceId) || params.candidate;

    // Calcular precio CLP con PricingEngine
    const priceCalc = pricingEngine.calculate(tech.rateUSD, 1000, params.id, params.commercialCategory);

    // Si ya existe y fue configurado manualmente por el admin, respetar selección y título
    if (existing && existing.manualProviderSelection) {
      const activeTech = this.technicalServices.get(existing.technicalServiceId) || tech;
      const recacl = pricingEngine.calculate(activeTech.rateUSD, 1000, existing.id, existing.commercialCategory);
      existing.commercialRateCLP = recacl.unitPricePer1000CLP;
      existing.originalRateUSD = activeTech.rateUSD;
      existing.refill = activeTech.refill;
      existing.updatedAt = params.now;
      return;
    }

    const cleanBaseName = `${params.platform} ${params.commercialCategory}`;
    const commService: CommercialCatalogService = {
      id: params.id,
      published: existing ? existing.published : true,
      commercialName: `${cleanBaseName} — ${params.titleSuffix}`,
      description: `${params.descriptionSuffix} Inicio automático tras confirmación de pago.`,
      platform: params.platform,
      commercialCategory: params.commercialCategory,
      tier: params.tier,
      technicalServiceId: tech.id,
      provider: tech.provider,
      originalRateUSD: tech.rateUSD,
      commercialRateCLP: priceCalc.unitPricePer1000CLP,
      minQuantity: tech.minQuantity,
      maxQuantity: tech.maxQuantity,
      refill: tech.refill,
      refillDays: tech.refill ? 30 : undefined,
      cancel: tech.cancel,
      linkType: params.platform === 'Instagram' ? 'Usuario (@usuario) o enlace de post' : 'Enlace público directo',
      featured: params.tier === 'PREMIUM' || params.tier === 'ESTANDAR',
      manualProviderSelection: false,
      updatedAt: params.now,
    };

    this.commercialServices.set(params.id, commService);
    this.persistCommercialService(commService).catch(console.warn);
  }

  // -------------------------------------------------------------
  // CONSULTAS Y MODIFICACIONES
  // -------------------------------------------------------------

  public getCommercialServices(filter?: {
    platform?: string;
    commercialCategory?: string;
    tier?: ServiceTier;
    search?: string;
    onlyPublished?: boolean;
  }): CommercialCatalogService[] {
    let list = Array.from(this.commercialServices.values());

    if (filter?.onlyPublished !== false) {
      list = list.filter(s => s.published);
    }
    if (filter?.platform && filter.platform !== 'TODOS') {
      list = list.filter(s => s.platform.toLowerCase() === filter.platform!.toLowerCase());
    }
    if (filter?.commercialCategory && filter.commercialCategory !== 'TODAS') {
      list = list.filter(s => s.commercialCategory.toLowerCase() === filter.commercialCategory!.toLowerCase());
    }
    if (filter?.tier) {
      list = list.filter(s => s.tier === filter.tier);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(s => s.commercialName.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }

    // Actualizar precio en vivo según tasa de cambio actual
    return list.map(s => {
      const calc = pricingEngine.calculate(s.originalRateUSD, 1000, s.id, s.commercialCategory);
      return {
        ...s,
        commercialRateCLP: calc.unitPricePer1000CLP,
      };
    });
  }

  public getCommercialServiceById(id: string): CommercialCatalogService | undefined {
    const s = this.commercialServices.get(id);
    if (!s) return undefined;
    const calc = pricingEngine.calculate(s.originalRateUSD, 1000, s.id, s.commercialCategory);
    return {
      ...s,
      commercialRateCLP: calc.unitPricePer1000CLP,
    };
  }

  public updateCommercialService(id: string, updates: Partial<CommercialCatalogService>): CommercialCatalogService | null {
    const s = this.commercialServices.get(id);
    if (!s) return null;

    // Si cambia el servicio técnico asignado
    if (updates.technicalServiceId && updates.technicalServiceId !== s.technicalServiceId) {
      const newTech = this.technicalServices.get(updates.technicalServiceId);
      if (newTech) {
        updates.provider = newTech.provider;
        updates.originalRateUSD = newTech.rateUSD;
        updates.minQuantity = newTech.minQuantity;
        updates.maxQuantity = newTech.maxQuantity;
        updates.refill = newTech.refill;
        updates.manualProviderSelection = true;
      }
    }

    const updated = {
      ...s,
      ...updates,
      id: s.id, // Inmutable
      updatedAt: new Date().toISOString(),
    };

    this.commercialServices.set(id, updated);
    this.persistCommercialService(updated).catch(console.warn);
    return updated;
  }

  public getTechnicalServices(filter?: {
    platform?: string;
    provider?: string;
    search?: string;
    availableOnly?: boolean;
  }): ProviderTechnicalService[] {
    let list = Array.from(this.technicalServices.values());

    if (filter?.availableOnly) {
      list = list.filter(s => s.available);
    }
    if (filter?.platform && filter.platform !== 'TODOS') {
      list = list.filter(s => s.platform.toLowerCase() === filter.platform!.toLowerCase());
    }
    if (filter?.provider) {
      list = list.filter(s => s.provider.toLowerCase() === filter.provider!.toLowerCase());
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }

    return list.sort((a, b) => a.rateUSD - b.rateUSD);
  }

  public getTechnicalServiceById(id: string): ProviderTechnicalService | undefined {
    return this.technicalServices.get(id);
  }

  /**
   * Comparador Inteligente: Encuentra alternativas técnicas equivalentes para un servicio comercial dado
   */
  public getEquivalentAlternatives(commercialServiceId: string): ProviderTechnicalService[] {
    const comm = this.commercialServices.get(commercialServiceId);
    if (!comm) return [];

    return Array.from(this.technicalServices.values()).filter(tech => {
      const samePlatform = tech.platform === comm.platform;
      const sameCategory = this.detectCommercialCategory(tech.name, tech.category) === comm.commercialCategory;
      return samePlatform && sameCategory && tech.available;
    }).sort((a, b) => a.rateUSD - b.rateUSD);
  }

  public getSyncHistory(): SyncHistoryRecord[] {
    return this.syncHistory;
  }

  public getStats() {
    const techAll = Array.from(this.technicalServices.values());
    const commAll = Array.from(this.commercialServices.values());

    return {
      totalTechnical: techAll.length,
      activeTechnical: techAll.filter(t => t.available).length,
      inactiveTechnical: techAll.filter(t => !t.available).length,
      possiblyUnavailable: techAll.filter(t => t.syncStatus === 'POSSIBLY_UNAVAILABLE').length,
      totalCommercial: commAll.length,
      publishedCommercial: commAll.filter(c => c.published).length,
      tiers: {
        economico: commAll.filter(c => c.tier === 'ECONOMICO').length,
        estandar: commAll.filter(c => c.tier === 'ESTANDAR').length,
        premium: commAll.filter(c => c.tier === 'PREMIUM').length,
      },
      lastSyncTime: this.lastSyncTime,
    };
  }

  private async persistTechnicalService(service: ProviderTechnicalService): Promise<void> {
    try {
      await adminFirestore.collection('provider_services').doc(service.id).set(service, { merge: true });
    } catch (e: any) {
      console.warn(`Could not persist technical service ${service.id}:`, e.message);
    }
  }

  private async persistCommercialService(service: CommercialCatalogService): Promise<void> {
    try {
      await adminFirestore.collection('commercial_services').doc(service.id).set(service, { merge: true });
    } catch (e: any) {
      console.warn(`Could not persist commercial service ${service.id}:`, e.message);
    }
  }

  private async persistSyncRecord(record: SyncHistoryRecord): Promise<void> {
    try {
      await adminFirestore.collection('provider_sync_history').doc(record.id).set(record, { merge: true });
    } catch (e: any) {
      console.warn(`Could not persist sync history ${record.id}:`, e.message);
    }
  }
}

export const catalogService = new CatalogService();
