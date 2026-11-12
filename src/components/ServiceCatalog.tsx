import React, { useState, useMemo } from 'react';
import { CommercialCatalogService, ServiceTier } from '../types/index.ts';
import { formatCLP } from '../utils/currency.ts';
import { 
  Search, 
  RotateCcw, 
  ChevronRight, 
  Flame, 
  Layers, 
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
  Zap,
  Crown
} from 'lucide-react';

interface ServiceCatalogProps {
  services: CommercialCatalogService[];
  loading: boolean;
  selectedPlatform: string;
  onSelectPlatform: (platform: string) => void;
  onSelectService: (service: CommercialCatalogService) => void;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({
  services,
  loading,
  selectedPlatform,
  onSelectPlatform,
  onSelectService,
}) => {
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'featured' | 'priceAsc' | 'priceDesc' | 'minQty'>('featured');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

  // Categorías comerciales disponibles según la plataforma actual
  const categories = useMemo(() => {
    const list = services
      .filter(s => selectedPlatform === 'TODOS' || s.platform.toLowerCase() === selectedPlatform.toLowerCase())
      .map(s => s.commercialCategory || (s as any).category || 'General');
    return ['TODAS', ...Array.from(new Set(list))];
  }, [services, selectedPlatform]);

  // Filtrado y ordenamiento
  const filteredServices = useMemo(() => {
    let result = services.filter(s => s.published !== false && (s as any).active !== false);

    if (selectedPlatform !== 'TODOS') {
      result = result.filter(s => s.platform.toLowerCase() === selectedPlatform.toLowerCase());
    }

    if (selectedCategory !== 'TODAS') {
      result = result.filter(s => (s.commercialCategory || (s as any).category) === selectedCategory);
    }

    if (selectedTier !== 'ALL') {
      result = result.filter(s => s.tier === selectedTier);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        s => (s.commercialName || (s as any).name || '').toLowerCase().includes(q) ||
             (s.description || '').toLowerCase().includes(q) ||
             (s.commercialCategory || (s as any).category || '').toLowerCase().includes(q)
      );
    }

    // Ordenamiento
    if (sortBy === 'priceAsc') {
      result.sort((a, b) => a.commercialRateCLP - b.commercialRateCLP);
    } else if (sortBy === 'priceDesc') {
      result.sort((a, b) => b.commercialRateCLP - a.commercialRateCLP);
    } else if (sortBy === 'minQty') {
      result.sort((a, b) => a.minQuantity - b.minQuantity);
    } else {
      // Destacados primero: Premium > Free
      const tierScore = (t?: ServiceTier) => (t === 'PREMIUM' ? 2 : 1);
      result.sort((a, b) => tierScore(b.tier) - tierScore(a.tier));
    }

    return result;
  }, [services, selectedPlatform, selectedCategory, selectedTier, search, sortBy]);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Instagram': return '📸';
      case 'TikTok': return '🎵';
      case 'YouTube': return '▶️';
      case 'Facebook': return '👥';
      case 'X': return '🐦';
      case 'Spotify': return '🎧';
      case 'Telegram': return '✈️';
      default: return '⚡';
    }
  };

  const getTierBadge = (tier?: ServiceTier) => {
    if (tier === 'PREMIUM') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
          <Crown className="w-3 h-3 text-amber-400" />
          Plan Premium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
        <Zap className="w-3 h-3 text-emerald-400" />
        Plan Free
      </span>
    );
  };

  return (
    <section id="catalogo" className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Título de Sección */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Flame className="w-4 h-4" />
            <span>Catálogo Comercial Inteligente</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Elige entre Plan Free o Plan Premium
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Compara <strong className="text-emerald-400">Plan Free</strong> (entrada económica) y <strong className="text-amber-300">Plan Premium</strong> (mayor estabilidad y retención superior).
          </p>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar seguidores, likes, vistas..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Selector de Planes: Free vs Premium */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 pl-2 pr-1">Plan:</span>
          {[
            { id: 'ALL', label: 'Todos los planes' },
            { id: 'FREE', label: '⚡ Plan Free' },
            { id: 'PREMIUM', label: '👑 Plan Premium (Alta Estabilidad)' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTier(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedTier === t.id
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Selector de Orden */}
        <div className="flex items-center gap-2 ml-auto pr-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg py-1.5 px-2.5 outline-none focus:border-rose-500 cursor-pointer"
          >
            <option value="featured">Destacados por calidad</option>
            <option value="priceAsc">Menor precio por 1.000</option>
            <option value="priceDesc">Mayor precio por 1.000</option>
            <option value="minQty">Menor cantidad mínima</option>
          </select>
        </div>
      </div>

      {/* Filtro por Categorías */}
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-2 mb-6 scrollbar-none">
        <span className="text-xs font-semibold text-slate-400 pl-1 pr-1 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden sm:inline">Tipo:</span>
        </span>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid de Servicios */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Sincronizando catálogo comercial inteligente...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="py-20 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg font-bold text-white mb-1">No se encontraron servicios</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-4">
            No encontramos servicios para los filtros seleccionados.
          </p>
          <button
            onClick={() => { setSearch(''); setSelectedCategory('TODAS'); setSelectedTier('ALL'); onSelectPlatform('TODOS'); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Restablecer todos los filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredServices.map(service => {
            const displayName = service.commercialName || (service as any).name;
            const displayCat = service.commercialCategory || (service as any).category;
            return (
              <div
                key={service.id}
                className={`group relative flex flex-col justify-between bg-slate-900/80 hover:bg-slate-900 border rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:shadow-xl ${
                  service.tier === 'PREMIUM'
                    ? 'border-amber-500/30 hover:border-amber-500/50 hover:shadow-amber-500/5'
                    : 'border-emerald-500/20 hover:border-emerald-500/40'
                }`}
              >
                <div>
                  
                  {/* Badges de Cabecera */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-200">
                      <span>{getPlatformIcon(service.platform)}</span>
                      <span>{service.platform}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {getTierBadge(service.tier)}
                    </div>
                  </div>

                  {/* Categoría Comercial */}
                  <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider mb-1">
                    {displayCat}
                  </p>

                  {/* Nombre Comercial */}
                  <h3 className="text-base font-bold text-white leading-snug group-hover:text-orange-300 transition-colors line-clamp-2">
                    {displayName}
                  </h3>

                  {/* Descripción */}
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {service.description}
                  </p>

                  {/* Metadatos técnicos (Mín / Máx / Refill) */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500">Mínimo:</span>{' '}
                      <strong className="text-slate-300 font-medium">{service.minQuantity.toLocaleString('es-CL')}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Máximo:</span>{' '}
                      <strong className="text-slate-300 font-medium">{service.maxQuantity.toLocaleString('es-CL')}</strong>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    {service.tier === 'PREMIUM' ? (
                      <span className="flex items-center gap-1 text-amber-300 font-medium">
                        <Crown className="w-3 h-3" />
                        Alta retención y estabilidad
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        Entrega rápida automatizada
                      </span>
                    )}
                  </div>

                </div>

                {/* Pie con Precio en CLP y Botón */}
                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                      Por cada 1.000 un.
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold text-white">
                      {formatCLP(service.commercialRateCLP)}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectService(service)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 shadow-md shadow-rose-600/20 active:scale-98 transition-all cursor-pointer"
                  >
                    <span>Comprar</span>
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </section>
  );
};
