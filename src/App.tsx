import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Hero } from './components/Hero.tsx';
import { ServiceCatalog } from './components/ServiceCatalog.tsx';
import { PurchaseModal } from './components/PurchaseModal.tsx';
import { HowItWorks } from './components/HowItWorks.tsx';
import { BenefitsSection } from './components/BenefitsSection.tsx';
import { FAQSection } from './components/FAQSection.tsx';
import { CustomerDashboard } from './components/CustomerDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { PaymentReturnPage } from './components/PaymentReturnPage.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { Footer } from './components/Footer.tsx';
import { CommercialService } from './types/index.ts';

function MainApp() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<'store' | 'orders' | 'admin'>('store');
  const [services, setServices] = useState<CommercialService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('TODOS');
  const [selectedService, setSelectedService] = useState<CommercialService | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Detección de retorno de pasarela de pago Flow.cl
  const isPaymentReturn =
    window.location.pathname.includes('flow-return') ||
    window.location.search.includes('flow-return') ||
    window.location.search.includes('token=');

  const fetchCatalog = async () => {
    try {
      setLoadingServices(true);
      const res = await fetch('/api/catalog');
      const data = await res.json();
      if (data.success && Array.isArray(data.services)) {
        setServices(data.services);
      }
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handlePurchaseSuccess = (orderId: string) => {
    setSelectedService(null);
    setActiveView('orders');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white font-sans antialiased">
      
      {/* Barra de Navegación Principal */}
      <Navbar
        onOpenAuth={() => setAuthModalOpen(true)}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Contenido Principal */}
      <main className="flex-1">
        {isPaymentReturn ? (
          <PaymentReturnPage
            onGoToOrders={() => {
              window.history.replaceState({}, '', '/');
              setActiveView('orders');
            }}
            onGoToStore={() => {
              window.history.replaceState({}, '', '/');
              setActiveView('store');
            }}
          />
        ) : activeView === 'admin' ? (
          <AdminDashboard />
        ) : activeView === 'orders' ? (
          <CustomerDashboard />
        ) : (
          <>
            <Hero
              selectedPlatform={selectedPlatform}
              onSelectPlatform={(p) => {
                setSelectedPlatform(p);
                const el = document.getElementById('catalogo');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            <ServiceCatalog
              services={services}
              loading={loadingServices}
              selectedPlatform={selectedPlatform}
              onSelectPlatform={setSelectedPlatform}
              onSelectService={(service) => setSelectedService(service)}
            />

            <HowItWorks />

            <BenefitsSection />

            <FAQSection />
          </>
        )}
      </main>

      {/* Modal de Compra y Cotización */}
      {selectedService && (
        <PurchaseModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      {/* Modal de Autenticación */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Pie de Página */}
      <Footer />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
