import { systemFollowsProvider } from '../providers/smm/systemFollows.ts';
import { pricingEngine } from './pricingEngine.ts';
import { notificationService } from './notificationService.ts';
import { adminFirestore } from '../firebaseAdmin.ts';

export type ServiceTier = 'FREE' | 'PREMIUM';

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
// NIVEL 2: CATÁLOGO COMERCIAL DE POTENCIAREDES (Plan Free & Plan Premium)
// -------------------------------------------------------------
export interface CommercialCatalogService {
  id: string; // ej: "COMM-INSTAGRAM-SEGUIDORES-FREE" o "...-PREMIUM"
  published: boolean;
  commercialName: string;
  description: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'Facebook' | 'X' | 'Spotify' | 'Telegram' | 'Otro';
  commercialCategory: string; // "Seguidores", "Likes", "Visualizaciones", "Comentarios"
  tier: ServiceTier; // FREE o PREMIUM
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
  private technicalServices: Map<string, ProviderTechnicalService> = new Map();
  private commercialServices: Map<string, CommercialCatalogService> = new Map();
  private syncHistory: SyncHistoryRecord[] = [];
  private lastSyncTime: string | null = null;
  private isSyncing = false;

  constructor() {
    this.initialize();
    // Sincronización periódica automática cada 15 minutos para detectar cambios de IDs o tarifas
    setInterval(() => {
      this.syncTechnicalCatalog().catch(err => console.warn('Periodic catalog sync warning:', err?.message || err));
    }, 15 * 60 * 1000);
  }

  private async initialize() {
    await this.loadFromFirestore();
    await this.syncTechnicalCatalog();
  }

  private async loadFromFirestore() {
    try {
      const techSnap = await adminFirestore.collection('provider_services').limit(250).get();
      techSnap.forEach(doc => {
        this.technicalServices.set(doc.id, doc.data() as ProviderTechnicalService);
      });

      const commSnap = await adminFirestore.collection('commercial_services').limit(250).get();
      commSnap.forEach(doc => {
        const data = doc.data() as any;
        // Limpiar registros legados ECONOMICO / ESTANDAR para mantener solo FREE y PREMIUM
        if (doc.id.endsWith('-ECONOMICO') || doc.id.endsWith('-ESTANDAR') || (data.tier !== 'FREE' && data.tier !== 'PREMIUM')) {
          adminFirestore.collection('commercial_services').doc(doc.id).delete().catch(() => {});
          return;
        }
        this.commercialServices.set(doc.id, data as CommercialCatalogService);
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
    if (combined.includes('suscriptor') || combined.includes('subscriber')) return 'Suscriptores';
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

          await notificationService.notify({
            title: `Nuevo servicio detectado en ${providerName}`,
            description: `Se detectó "${raw.name}" (ID #${providerServiceId}) en ${platform}. Evaluado automáticamente para Free/Premium.`,
            level: 'INFO',
            entityType: 'SERVICE',
            entityId: internalId,
            actionUrl: '/admin?tab=catalog',
            recommendedAction: 'Revisar asignación comercial si corresponde.',
          });
        } else {
          const changes: ServiceChangeRecord[] = [];
          if (existing.rateUSD !== rateUSD) {
            changes.push({ field: 'rateUSD', oldValue: existing.rateUSD, newValue: rateUSD, timestamp: now });
            const percentIncrease = existing.rateUSD > 0 ? ((rateUSD - existing.rateUSD) / existing.rateUSD) * 100 : 0;
            if (percentIncrease > 15) {
              await notificationService.notify({
                title: `Aumento de tarifa en servicio #${providerServiceId}`,
                description: `El servicio "${existing.name}" subió un ${percentIncrease.toFixed(1)}% (de $${existing.rateUSD} a $${rateUSD} USD).`,
                level: 'WARNING',
                entityType: 'SERVICE',
                entityId: internalId,
                actionUrl: '/admin?tab=catalog',
                recommendedAction: 'El motor de precios ajustó el piso CLP automáticamente si superó el tramo.',
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

      // Detectar servicios que desaparecieron o cambiaron de ID en el proveedor
      for (const [id, techService] of this.technicalServices.entries()) {
        if (techService.provider === providerName && !currentFetchedIds.has(id)) {
          missingCount++;
          if (techService.syncStatus === 'POSSIBLY_UNAVAILABLE' || techService.syncStatus === 'INACTIVE') {
            techService.syncStatus = 'INACTIVE';
            techService.available = false;
            techService.lastSyncedAt = now;
            await notificationService.notify({
              title: `ID #${techService.providerServiceId} retirado por el proveedor`,
              description: `"${techService.name}" desapareció en ${providerName}. El sistema reasignará automáticamente un servicio equivalente.`,
              level: 'WARNING',
              entityType: 'SERVICE',
              entityId: id,
              actionUrl: '/admin?tab=catalog',
              recommendedAction: 'Verificar servicio sustituto en el Comparador Inteligente.',
            });
          } else {
            techService.syncStatus = 'POSSIBLY_UNAVAILABLE';
            techService.lastSyncedAt = now;
          }
          this.persistTechnicalService(techService).catch(console.warn);
        }
      }

      this.lastSyncTime = now;

      // Reconstruir Catálogo Comercial Free vs Premium y reasignar IDs rotos
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
   * Reconstruye y clasifica el Catálogo Comercial en 2 planes claros:
   * - Plan Free (FREE): busca siempre el servicio disponible más económico del proveedor.
   * - Plan Premium (PREMIUM): busca un servicio disponible CON reposición (refill === true).
   */
  public rebuildCommercialCatalog(): void {
    // Limpiar entradas antiguas que no sean FREE / PREMIUM
    for (const [id, item] of this.commercialServices.entries()) {
      if (!id.endsWith('-FREE') && !id.endsWith('-PREMIUM') || (item.tier !== 'FREE' && item.tier !== 'PREMIUM')) {
        this.commercialServices.delete(id);
        adminFirestore.collection('commercial_services').doc(id).delete().catch(() => {});
      }
    }

    const activeTechServices = Array.from(this.technicalServices.values()).filter(s => s.available);

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

      // 1. Plan Free: servicio más barato disponible (prioriza no-refill o el de menor tarifa USD)
      const nonRefillCheapest = sortedByPrice.filter(s => !s.refill);
      const freeCandidate = nonRefillCheapest.length > 0 ? nonRefillCheapest[0] : sortedByPrice[0];
      if (freeCandidate) {
        this.upsertCommercialService({
          id: `COMM-${platform.toUpperCase()}-${commercialCategory.toUpperCase()}-FREE`,
          platform,
          commercialCategory,
          tier: 'FREE',
          technicalServiceId: freeCandidate.id,
          candidate: freeCandidate,
          titleSuffix: 'Plan Free (Económico)',
          descriptionSuffix: 'Opción económica al mejor precio. Busca automáticamente la ruta más barata y rápida.',
          now,
        });
      }

      // 2. Plan Premium: servicio CON reposición (refill === true), estabilidad superior
      const withRefill = sortedByPrice.filter(s => s.refill);
      // Si hay varias opciones con refill, elegir la de mayor calidad/estabilidad dentro del grupo con refill (o la más estable distinta de Free)
      const premiumCandidate = withRefill.length > 0
        ? (withRefill.find(s => s.id !== freeCandidate?.id) || withRefill[0])
        : null;

      if (premiumCandidate) {
        this.upsertCommercialService({
          id: `COMM-${platform.toUpperCase()}-${commercialCategory.toUpperCase()}-PREMIUM`,
          platform,
          commercialCategory,
          tier: 'PREMIUM',
          technicalServiceId: premiumCandidate.id,
          candidate: premiumCandidate,
          titleSuffix: 'Plan Premium (Alta Estabilidad)',
          descriptionSuffix: 'Rutas seleccionadas de alta estabilidad, retención superior y menor tasa de caída.',
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

    // Calcular precio CLP con PricingEngine (Free vs Premium + protección por tramos de costo)
    const priceCalc = pricingEngine.calculate(
      tech.rateUSD,
      1000,
      params.id,
      params.commercialCategory,
      'FLOW',
      params.tier
    );

    // Si fue seleccionado manualmente y ese técnico SIGUE disponible, respetarlo;
    // Si desapareció o se desactivó (!activeTech?.available), reasignar automáticamente al nuevo candidato!
    if (existing && existing.manualProviderSelection) {
      const currentTech = this.technicalServices.get(existing.technicalServiceId);
      if (currentTech && currentTech.available) {
        const recalc = pricingEngine.calculate(
          currentTech.rateUSD,
          1000,
          existing.id,
          existing.commercialCategory,
          'FLOW',
          existing.tier
        );
        existing.commercialRateCLP = recalc.unitPricePer1000CLP;
        existing.originalRateUSD = currentTech.rateUSD;
        existing.minQuantity = Math.max(500, currentTech.minQuantity);
        existing.maxQuantity = Math.max(500, currentTech.maxQuantity);
        existing.refill = existing.tier === 'PREMIUM' ? currentTech.refill : false;
        existing.updatedAt = params.now;
        return;
      }
    }

    const cleanBaseName = `${params.platform} ${params.commercialCategory}`;
    const commService: CommercialCatalogService = {
      id: params.id,
      published: existing ? existing.published : true,
      commercialName: `${cleanBaseName} — ${params.titleSuffix}`,
      description: `${params.descriptionSuffix} Inicio automático tras confirmar pago en Flow.`,
      platform: params.platform,
      commercialCategory: params.commercialCategory,
      tier: params.tier,
      technicalServiceId: tech.id,
      provider: tech.provider,
      originalRateUSD: tech.rateUSD,
      commercialRateCLP: priceCalc.unitPricePer1000CLP,
      minQuantity: Math.max(500, tech.minQuantity),
      maxQuantity: Math.max(500, tech.maxQuantity),
      refill: params.tier === 'PREMIUM' ? Boolean(tech.refill) : false,
      refillDays: params.tier === 'PREMIUM' && tech.refill ? 30 : undefined,
      cancel: tech.cancel,
      linkType: params.platform === 'Instagram' ? 'Usuario (@usuario) o enlace de post' : 'Enlace público directo',
      featured: params.tier === 'PREMIUM',
      manualProviderSelection: false,
      updatedAt: params.now,
    };

    this.commercialServices.set(params.id, commService);
    this.persistCommercialService(commService).catch(console.warn);
  }

  /**
   * Resuelve dinámicamente el mejor servicio técnico en el proveedor justo antes de comprar:
   * - Para FREE: busca el más barato disponible compatible con la cantidad solicitada.
   * - Para PREMIUM: busca obligatoriamente uno disponible CON reposición (refill === true).
   * - Si el ID actual falló (excludedTechIds) o fue removido por el proveedor, busca un reemplazo similar sin perder rentabilidad.
   */
  public resolveDispatchService(params: {
    commercialServiceId: string;
    quantity: number;
    tier?: ServiceTier;
    excludedTechIds?: string[];
    maxAllowedTotalCostCLP?: number;
  }): {
    technicalService: ProviderTechnicalService | null;
    wasAutoReassigned: boolean;
    reason?: string;
  } {
    const excluded = new Set(params.excludedTechIds || []);
    const comm = this.commercialServices.get(params.commercialServiceId);
    const exchangeRate = pricingEngine.getExchangeRate();

    const effectiveTier: ServiceTier = params.tier
      || comm?.tier
      || (params.commercialServiceId.toUpperCase().includes('PREMIUM') ? 'PREMIUM' : 'FREE');

    const currentTech = comm ? this.technicalServices.get(comm.technicalServiceId) : this.technicalServices.get(params.commercialServiceId);

    const isCompatible = (t: ProviderTechnicalService) => {
      if (!t.available) return false;
      if (excluded.has(t.id) || excluded.has(t.providerServiceId)) return false;
      if (params.quantity < t.minQuantity || params.quantity > t.maxQuantity) return false;
      if (effectiveTier === 'PREMIUM' && !t.refill) return false;
      if (params.maxAllowedTotalCostCLP !== undefined) {
        const orderCostCLP = (t.rateUSD / 1000) * params.quantity * exchangeRate;
        if (orderCostCLP > params.maxAllowedTotalCostCLP) return false;
      }
      return true;
    };

    // Buscar alternativas equivalentes de la misma plataforma y categoría comercial
    let candidates: ProviderTechnicalService[] = [];
    if (comm) {
      candidates = Array.from(this.technicalServices.values()).filter(t => {
        const samePlat = t.platform === comm.platform;
        const sameCat = this.detectCommercialCategory(t.name, t.category) === comm.commercialCategory;
        return samePlat && sameCat && isCompatible(t);
      });
    } else if (currentTech) {
      const cat = this.detectCommercialCategory(currentTech.name, currentTech.category);
      candidates = Array.from(this.technicalServices.values()).filter(t => {
        const samePlat = t.platform === currentTech.platform;
        const sameCat = this.detectCommercialCategory(t.name, t.category) === cat;
        return samePlat && sameCat && isCompatible(t);
      });
    }

    // Ordenar candidatos por tarifa ascendente (más barato primero)
    candidates.sort((a, b) => a.rateUSD - b.rateUSD);

    // En Plan FREE siempre priorizamos el más barato disponible (a menos que esté bloqueado manualmente y válido)
    if (effectiveTier === 'FREE') {
      if (comm?.manualProviderSelection && currentTech && isCompatible(currentTech)) {
        return { technicalService: currentTech, wasAutoReassigned: false };
      }
      if (candidates.length > 0) {
        const best = candidates[0];
        const reassigned = !currentTech || best.id !== currentTech.id;
        return {
          technicalService: best,
          wasAutoReassigned: reassigned,
          reason: reassigned
            ? `Ruta más económica seleccionada en Plan Free: #${best.providerServiceId} ($${best.rateUSD} USD/1k)`
            : undefined,
        };
      }
    }

    // En Plan PREMIUM, si el actual sigue válido y tiene refill, usarlo; si no, buscar sustituto con refill
    if (effectiveTier === 'PREMIUM') {
      if (currentTech && isCompatible(currentTech)) {
        return { technicalService: currentTech, wasAutoReassigned: false };
      }
      if (candidates.length > 0) {
        const best = candidates[0];
        return {
          technicalService: best,
          wasAutoReassigned: true,
          reason: `Reemplazo automático con reposición (refill): #${best.providerServiceId} ($${best.rateUSD} USD/1k)`,
        };
      }
    }

    // Fallback final: si el técnico actual todavía existe aunque no cumpla maxAllowedCost, devolverlo si no está excluido
    if (currentTech && currentTech.available && !excluded.has(currentTech.id) && !excluded.has(currentTech.providerServiceId)) {
      return { technicalService: currentTech, wasAutoReassigned: false };
    }

    return { technicalService: null, wasAutoReassigned: false };
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

    return list.map(s => {
      const calc = pricingEngine.calculate(s.originalRateUSD, 1000, s.id, s.commercialCategory, 'FLOW', s.tier);
      return {
        ...s,
        commercialRateCLP: calc.unitPricePer1000CLP,
      };
    });
  }

  public getCommercialServiceById(id: string): CommercialCatalogService | undefined {
    const s = this.commercialServices.get(id);
    if (!s) return undefined;
    const calc = pricingEngine.calculate(s.originalRateUSD, 1000, s.id, s.commercialCategory, 'FLOW', s.tier);
    return {
      ...s,
      commercialRateCLP: calc.unitPricePer1000CLP,
    };
  }

  public updateCommercialService(id: string, updates: Partial<CommercialCatalogService>): CommercialCatalogService | null {
    const s = this.commercialServices.get(id);
    if (!s) return null;

    if (updates.technicalServiceId && updates.technicalServiceId !== s.technicalServiceId) {
      const newTech = this.technicalServices.get(updates.technicalServiceId);
      if (newTech) {
        updates.provider = newTech.provider;
        updates.originalRateUSD = newTech.rateUSD;
        updates.minQuantity = newTech.minQuantity;
        updates.maxQuantity = newTech.maxQuantity;
        updates.refill = s.tier === 'PREMIUM' ? newTech.refill : false;
        updates.manualProviderSelection = true;
      }
    }

    if (updates.minQuantity !== undefined && !isNaN(Number(updates.minQuantity))) {
      updates.minQuantity = Math.max(500, Number(updates.minQuantity));
    }

    if (updates.commercialRateCLP !== undefined && !isNaN(Number(updates.commercialRateCLP))) {
      updates.commercialRateCLP = pricingEngine.roundTo990CLP(Number(updates.commercialRateCLP));
    }

    const updated = {
      ...s,
      ...updates,
      id: s.id,
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
        free: commAll.filter(c => c.tier === 'FREE').length,
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
