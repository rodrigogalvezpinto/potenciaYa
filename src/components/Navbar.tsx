import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { 
  Flame, 
  ShoppingBag, 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  LayoutDashboard, 
  Menu, 
  X,
  CreditCard
} from 'lucide-react';

interface NavbarProps {
  onOpenAuth: () => void;
  activeView: 'store' | 'orders' | 'admin';
  setActiveView: (view: 'store' | 'orders' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, activeView, setActiveView }) => {
  const { user, profile, isAdmin, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-slate-950/85 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Marca Comercial */}
          <div 
            onClick={() => { setActiveView('store'); setMobileMenuOpen(false); }}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/25 group-hover:shadow-rose-500/40 transition-all duration-200">
              <Flame className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-white">
                  POTENCIA<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-500">REDES</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  CHILE 🇨🇱
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wide">
                Crecimiento SMM Automático en CLP
              </p>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => setActiveView('store')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === 'store'
                  ? 'text-white bg-slate-800/80 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              Catálogo de Servicios
            </button>

            <a
              href="#como-funciona"
              onClick={() => { if (activeView !== 'store') setActiveView('store'); }}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors"
            >
              Cómo Funciona
            </a>

            <a
              href="#ventajas"
              onClick={() => { if (activeView !== 'store') setActiveView('store'); }}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors"
            >
              Ventajas & FAQ
            </a>

            {user && (
              <button
                onClick={() => setActiveView('orders')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'orders'
                    ? 'text-white bg-slate-800/80 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-orange-400" />
                <span>Mis Pedidos</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActiveView('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  activeView === 'admin'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Administración</span>
              </button>
            )}
          </nav>

          {/* Acciones de Usuario Desktop */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-1.5 pr-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-xs uppercase border border-slate-700">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    (user.displayName || user.email || 'U')[0]
                  )}
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {isAdmin ? 'Super Admin' : 'Cliente Activo'}
                  </p>
                </div>
                <button
                  onClick={logout}
                  title="Cerrar sesión"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 shadow-md shadow-rose-600/20 hover:shadow-rose-600/30 transition-all cursor-pointer"
              >
                <UserIcon className="w-4 h-4" />
                <span>Ingresar / Registrarse</span>
              </button>
            )}
          </div>

          {/* Botón Menú Mobile */}
          <div className="flex md:hidden items-center gap-2">
            {!user && (
              <button
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600"
              >
                Ingresar
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Menú Mobile Desplegable */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950 px-4 pt-2 pb-6 space-y-2">
          <button
            onClick={() => { setActiveView('store'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${
              activeView === 'store' ? 'bg-slate-800 text-white' : 'text-slate-300'
            }`}
          >
            Catálogo de Servicios
          </button>
          
          <button
            onClick={() => { setActiveView('orders'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${
              activeView === 'orders' ? 'bg-slate-800 text-white' : 'text-slate-300'
            }`}
          >
            Mis Pedidos
          </button>

          {isAdmin && (
            <button
              onClick={() => { setActiveView('admin'); setMobileMenuOpen(false); }}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20"
            >
              Panel de Administración
            </button>
          )}

          {user ? (
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{user.displayName || user.email}</p>
                <p className="text-xs text-slate-400">{isAdmin ? 'Super Administrador' : 'Cliente'}</p>
              </div>
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="flex items-center gap-1 text-xs text-rose-400 hover:underline"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <button
                onClick={() => { onOpenAuth(); setMobileMenuOpen(false); }}
                className="w-full py-2.5 rounded-xl text-center text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-rose-600"
              >
                Iniciar Sesión / Registro
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
