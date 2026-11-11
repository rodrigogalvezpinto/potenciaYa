# Arquitectura del Sistema — PotenciaRedes

PotenciaRedes es una plataforma SaaS de alto rendimiento para comercializar servicios de marketing digital y crecimiento en redes sociales para el mercado chileno (CLP) y latinoamericano, desacoplando completamente al proveedor mayorista (SystemFollows) de la experiencia de compra.

## 1. Topología General

```
[ Cliente / Navegador ]
         │ (HTTPS / REST / WebSocket)
         ▼
[ Express Server (server.ts) & Vite SSR/Middleware ]
   ├── Dominio de Autenticación & Autorización (Firebase Auth & RBAC)
   ├── Dominio de Catálogo & Motor de Precios (USD -> CLP + Márgenes)
   ├── Dominio de Pedidos (Validación, Idempotencia, Máquina de Estados)
   ├── Dominio de Pagos (Webpay Plus & Mercado Pago con reconciliación)
   ├── Dominio de Proveedores SMM (Abstracción SMMProvider / SystemFollows)
   ├── Dominio de Automatización (Workers de sincronización y reintentos)
   └── Dominio de Auditoría y Logs
         │
         ├──► [ Firestore Database (ai-studio-potenciaredes-...) ]
         ├──► [ SystemFollows API v2 (https://systemfollows.com/api/v2) ]
         ├──► [ Transbank Webpay Plus API ]
         └──► [ Mercado Pago Checkout API ]
```

## 2. Dominios y Responsabilidades

1. **Authentication & RBAC**:
   - Roles: `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`.
   - Verificación de sesión en backend vía Firebase Token y sincronización de privilegios.

2. **Catalog & Pricing Engine**:
   - Tarifa de costo original en USD provista por SystemFollows.
   - Conversión a CLP mediante tipo de cambio configurable con historial de cotizaciones.
   - Cálculo de margen comercial (Global, por Categoría o por Servicio individual).
   - Snapshot inmutable de costo y precio de venta al momento de emitir la orden comercial.

3. **Orders & State Machine**:
   - Estados: `AWAITING_PAYMENT`, `PAID`, `QUEUED`, `SUBMITTING`, `SUBMITTED`, `PENDING`, `IN_PROGRESS`, `PARTIAL`, `COMPLETED`, `CANCELED`, `FAILED`, `REQUIRES_RECONCILIATION`.
   - Idempotencia estricta para evitar dobles envíos.
   - Validación de URL según plataforma (Instagram, TikTok, YouTube, X, Facebook, Spotify, Telegram, etc.).

4. **Payments Hub**:
   - Proveedores: Transbank Webpay Plus y Mercado Pago.
   - Doble verificación backend (confirmación de commit/webhook antes de encolar orden a proveedor).
   - Manejo de reembolsos y reconciliación.

5. **SMM Provider Interface (`SMMProvider`)**:
   - Interfaz extensible con métodos: `getServices()`, `getBalance()`, `addOrder()`, `getOrderStatus()`, `requestRefill()`, `getRefillStatus()`, `cancelOrder()`.
   - Implementación `SystemFollowsProvider` con reintentos exponenciales y manejo de fallos.

6. **Refills & Cancelations**:
   - Solicitudes auditadas de reposición (refill) cuando el servicio lo admita.

7. **Observability & Audit**:
   - Registro en `audit_logs` de toda acción administrativa y eventos de pago.
