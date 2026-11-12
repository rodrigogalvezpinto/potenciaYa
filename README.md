# PotenciaRedes — Plataforma Comercial SaaS de Crecimiento en Redes Sociales (Chile / CLP)

Aplicación web **Full-Stack (React + Vite + Express + TypeScript + Firebase + Flow.cl + SystemFollows API v2)** lista para operar servicios digitales de crecimiento en redes sociales en **Pesos Chilenos (CLP)** con pasarela local **Flow Chile**, selección inteligente de proveedor, protección automática de márgenes y seguimiento en vivo de pedidos.

---

## 1. Stack Tecnológico

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React.
- **Backend:** Node.js + Express (`tsx server.ts`) sirviendo API REST (`/api/*`), webhooks de pago y la SPA en el puerto `3000`.
- **Pasarela de Pago Única:** **Flow.cl REST API v3** (firma HMAC-SHA256, Webpay, Redcompra, tarjetas débito/crédito, Servipag, MACH, Onepay).
- **Proveedor Técnico SMM:** **SystemFollows API v2** (`https://systemfollows.com/api/v2`) con modo simulación seguro automático si falta la `API Key`.
- **Base de Datos y Auth:** **Firebase Authentication** (Google Sign-In + Email/Password) + **Cloud Firestore** (`firebase-admin` en backend y SDK cliente en frontend).
- **Moneda y Zona Horaria:** `CLP` (Pesos Chilenos, formato `es-CL`) y `America/Santiago`.

---

## 2. Flujo Completo de Operación (Punta a Punta)

```text
[Cliente / Invitado]
   │  1. Elige red social y servicio (Plan Free o Plan Premium, mín. 500 unid.)
   │  2. Ingresa enlace/usuario público y correo (no requiere crear cuenta previa)
   ▼
[POST /api/orders/draft]
   │  • Valida cantidad >= 500 y enlace válido según plataforma
   │  • Calcula precio exacto con PricingEngine (tramos de costo + redondeo .990 CLP)
   │  • Guarda orden en estado AWAITING_PAYMENT
   ▼
[POST /api/payments/flow/create]
   │  • Genera orden en Flow.cl firmada con HMAC-SHA256 (monto fijo en CLP, no editable)
   │  • Redirige al cliente al checkout seguro de Flow Chile
   ▼
[Confirmación de Pago por Doble Vía]
   ├─ Vía A (Webhook): POST /api/payments/flow/webhook  (server-to-server)
   └─ Vía B (Retorno / Polling): /checkout/flow-return + POST /api/payments/flow/confirm
   │  • Verifica en Flow API: status === 2 (Pagado) y amountCLP >= order.totalPriceCLP
   ▼
[Despacho Automático al Proveedor — orderService.handlePaymentSuccess()]
   │  • Resuelve la mejor ruta activa con catalogService.resolveDispatchService():
   │      - Plan FREE: ruta disponible más barata compatible
   │      - Plan PREMIUM: ruta disponible de alta estabilidad (refill === true interno)
   │  • Verifica saldo del proveedor (balanceService)
   │  • Envía compra a SystemFollows (action: "add")
   │  • Si el ID técnico cambió/caducó en el proveedor:
   │      -> Resincroniza catálogo al instante, busca servicio equivalente dentro
   │         del techo de costo (<= 72% del total CLP) y reintenta automáticamente
   │  • Si falta saldo o hay fallo temporal de red:
   │      -> Pasa a cola persistente (jobQueueService) para reintento automático
   ▼
[Seguimiento en Vivo — CustomerDashboard]
   │  • Clientes e invitados ven barra de avance en vivo cada 20s (/api/orders/refresh-batch)
   └─ Consultan por orden ORD-... o correo sin perder pedidos
```

---

## 3. Estructura del Proyecto

```text
/
├── server.ts                         # Punto de entrada único (Express + API + Vite middleware / dist)
├── package.json                      # Scripts dev, build, start, lint
├── .env.example                      # Plantilla de variables de entorno (sin secretos)
├── firebase-applet-config.json       # Configuración de proyecto Firebase y Firestore DB ID
├── firebase-blueprint.json           # Esquema conceptual de colecciones Firestore
├── firestore.rules                   # Reglas de seguridad Firestore
│
├── server/
│   ├── config.ts                     # Carga configuración .env (Flow, SystemFollows, Admin emails, CLP)
│   ├── firebaseAdmin.ts              # Inicializa Firebase Admin SDK y Firestore DB específico
│   ├── routes/
│   │   └── api.ts                    # Todos los endpoints REST públicos, Flow y Admin
│   ├── providers/
│   │   ├── payments/
│   │   │   └── flow.ts               # Cliente Flow.cl REST v3 (HMAC-SHA256, create, getStatus, webhook)
│   │   └── smm/
│   │       ├── types.ts              # Interfaces proveedor SMM (services, add, status, balance, cancel)
│   │       └── systemFollows.ts      # Cliente SystemFollows API v2 + catálogo semilla inicial
│   ├── services/
│   │   ├── pricingEngine.ts          # Motor de precios CLP por tramos, pisos y redondeo estricto .990
│   │   ├── catalogService.ts         # Catálogo técnico vs comercial, sync c/15m y failover de IDs
│   │   ├── orderService.ts           # Ciclo de vida de órdenes, despacho automático y tracking en vivo
│   │   ├── balanceService.ts         # Monitoreo de saldo USD en proveedor y umbrales de alerta
│   │   ├── jobQueueService.ts        # Cola persistente de reintentos con backoff exponencial
│   │   └── notificationService.ts    # Centro de alertas operativas para el administrador
│   └── tests/
│       └── verificationSuite.ts      # Suite automatizada de 20 escenarios ejecutables desde Admin
│
└── src/
    ├── App.tsx                       # Enrutador principal (Tienda, Mis Pedidos, Admin, Retorno Flow)
    ├── firebase.ts                   # SDK cliente Firebase Auth + Firestore
    ├── context/AuthContext.tsx       # Manejo de sesión Google/Email y detección de rol Admin
    ├── constants/terms.ts            # Letra chica de Términos y Condiciones de Entrega
    ├── types/index.ts                # Tipos TypeScript compartidos (ServiceTier, Orders, Catalog, etc.)
    ├── utils/currency.ts             # Formateadores de CLP y fechas America/Santiago
    └── components/
        ├── Navbar.tsx                # Navegación superior, login y acceso Admin/Pedidos
        ├── Hero.tsx                  # Portada y filtro rápido por red social
        ├── ServiceCatalog.tsx        # Catálogo público con filtros Plan Free / Plan Premium
        ├── PurchaseModal.tsx         # Cotizador en vivo (mín. 500), checkout Flow y letra chica T&C
        ├── PaymentReturnPage.tsx     # Página de retorno desde Flow con verificación en tiempo real
        ├── CustomerDashboard.tsx     # Mis Pedidos: rastreo por ID/email + barra de progreso en vivo
        ├── AdminDashboard.tsx        # Panel completo de administración, métricas, test Flow y ajustes
        ├── HowItWorks.tsx            # Pasos de compra
        ├── BenefitsSection.tsx       # Ventajas de la plataforma
        ├── FAQSection.tsx            # Preguntas frecuentes
        ├── AuthModal.tsx             # Modal de acceso Google / Email
        ├── Footer.tsx                # Pie de página + enlace discreto a Términos del Servicio
        └── ErrorBoundary.tsx         # Captura de errores de UI React
```

---

## 4. Reglas Comerciales y Lógica de Negocio

### A. Planes Comerciales: `FREE` vs `PREMIUM`
El catálogo comercial agrupa servicios por **Plataforma** (Instagram, TikTok, YouTube, Facebook, X, Spotify, Telegram) y **Categoría** (Seguidores, Likes, Visualizaciones, Comentarios, Suscriptores, etc.) en exactamente dos modalidades:

1. **Plan Free (`FREE`):**
   - Selecciona automáticamente la ruta técnica **más económica** disponible en SystemFollows para esa categoría.
   - Pensado como entrada rápida y de menor costo.
2. **Plan Premium (`PREMIUM`):**
   - Visualmente se presenta como **Alta Estabilidad**.
   - Internamente exige servicios técnicos del proveedor marcados con `refill === true` para garantizar rutas de mejor calidad, mayor retención y menor tasa de caída.

### B. Mínimo Global de Compra: `500` Unidades
- Todo servicio publicado tiene `minQuantity >= 500` unidades sin excepciones.
- Se valida en 3 capas:
  1. **Catálogo (`catalogService.ts`):** Fuerza `Math.max(500, tech.minQuantity)`.
  2. **API / Órdenes (`api.ts` y `orderService.ts`):** Rechaza cotizaciones y órdenes `< 500`.
  3. **Frontend (`PurchaseModal.tsx`):** Bloquea el envío e inicia el selector en `500`–`1.000`.

### C. Motor de Precios y Redondeo Estricto `.990 CLP` (`pricingEngine.ts`)
- Todos los precios mostrados y cobrados (por cada 1.000 unidades, cantidades parciales como 500 o 750, mínimos de orden y ediciones manuales) terminan **siempre en `.990 CLP`** (`roundTo990CLP` / `ceilTo990CLP`, con mínimo absoluto de orden `$2.990 CLP`).
- **Tabla automática de protección por tramos de costo (x 1.000 unidades):**
  - Costo `<= $1.000 CLP`: Free Likes/Vistas **$5.990** | Free Seguidores **$7.990** | Premium **$14.990**
  - Costo `$1.001 – $2.500 CLP`: Free **$7.990** | Premium **$14.990**
  - Costo `$2.501 – $4.500 CLP`: Free **$11.990** | Premium **$14.990**
  - Costo `$4.501 – $6.500 CLP` *(ej. `$5.900`)*: mínimo **$14.990 CLP**
  - Costo `$6.501 – $10.000 CLP`: mínimo **$21.990 CLP**
  - Costo `> $10.000 CLP`: escalado automático `>= 2.0x / 2.1x` terminado en `.990`.
- Además descuenta la comisión estimada de Flow Chile (**`3.44%`** IVA incluido) para reportar **Utilidad Bruta** y **Utilidad Neta real** en el Panel Admin.

### D. Tolerancia a Cambios de ID en SystemFollows (`catalogService.ts` + `orderService.ts`)
- El backend resincroniza el catálogo técnico cada **15 minutos** de forma automática.
- Si al despachar una orden pagada el ID del servicio fue eliminado, desactivado o cambiado por el proveedor:
  1. `orderService.dispatchToProvider()` intercepta el error del proveedor.
  2. Ejecuta `catalogService.syncTechnicalCatalog()`.
  3. Llama a `catalogService.resolveDispatchService(...)` buscando un sustituto equivalente en la misma plataforma/categoría que respete el plan (`FREE` o `PREMIUM`) y no supere el techo de costo (`<= 72%` del monto pagado en CLP).
  4. Reintenta automáticamente el envío con el nuevo ID y deja registro en el historial de la orden y en las alertas de Admin.

### E. Términos y Condiciones Discretos (`src/constants/terms.ts`)
- La tienda principal **no** muestra promesas ni badges de "Garantía / 30 Días de Refill / Reposición" ni avisos llamativos de "sin garantía".
- Bajo una línea discreta colapsable (*"Al continuar con tu compra aceptas nuestros Términos y Condiciones"* en `PurchaseModal` y *"Términos del Servicio"* en `Footer`), se informa explícitamente:
  1. Que PotenciaRedes actúa solo como intermediario tecnológico y recaudador (no es proveedor directo ni operador final).
  2. Que las redes sociales aplican detección de bots y limpieza periódica de cuentas.
  3. Que los servicios se contratan sin garantía de reposición, permanencia ni reembolso, deslindando responsabilidad por caídas, demoras o acciones de terceros/plataformas.

---

## 5. Integración con Flow.cl (REST API v3)

Implementada en `server/providers/payments/flow.ts`:
- **Ambientes soportados:** `PRODUCTION` (`https://www.flow.cl/api`) y `SANDBOX` (`https://sandbox.flow.cl/api`).
- **Firma de Seguridad:** Todas las peticiones se firman ordenando parámetros alfabéticamente y generando HMAC-SHA256 con `FLOW_SECRET_KEY`.
- **Doble confirmación de pago:**
  - `urlConfirmation` -> `POST /api/payments/flow/webhook` (Flow notifica al servidor).
  - `urlReturn` -> `/checkout/flow-return` -> redirige a `/?flow-return=true&token=...&orderId=...` -> `PaymentReturnPage.tsx` llama a `POST /api/payments/flow/confirm`.
  - Además `CustomerDashboard.tsx` hace polling cada 8s a `/api/payments/flow/confirm` para órdenes `AWAITING_PAYMENT`.
- **Anti-tampering:** El servidor siempre reconsulta `payment/getStatus` en Flow y exige `status === 2` y `amount >= order.totalPriceCLP` antes de despachar.

### Cómo probar Flow sin riesgo
En **Admin -> Ajustes & Tests -> "Probar Pago e Integración Flow.cl"**:
- **En Producción:** Puedes generar una orden de prueba desde `$350 CLP` (por defecto `$500 CLP`) y abrir el checkout real de Flow.
- **En Sandbox (Gratis):** Crea una cuenta en `sandbox.flow.cl`, pega tus llaves Sandbox en Ajustes, cambia el ambiente a `SANDBOX` y paga con tarjetas simuladas de prueba sin dinero real.

---

## 6. Endpoints Principales de la API (`/api/*`)

| Método y Ruta | Descripción |
| :--- | :--- |
| `GET /api/health` | Estado general, moneda, tasa USD/CLP, integraciones activas y conteo de colas/alertas |
| `GET /api/catalog` | Lista servicios comerciales publicados (filtros: `platform`, `commercialCategory`, `tier`, `search`) |
| `POST /api/pricing/quote` | Cotiza cantidad (`>= 500`) devolviendo costo, total `.990 CLP`, comisión Flow y margen |
| `POST /api/orders/draft` | Crea orden preliminar `AWAITING_PAYMENT` validando link y mínimo `500` |
| `POST /api/payments/flow/create` | Crea sesión de cobro en Flow.cl y retorna `redirectUrl` + `token` |
| `POST /api/payments/flow/webhook` | Webhook server-to-server llamado por Flow (`urlConfirmation`) |
| `POST /api/payments/flow/confirm` | Verifica estado en Flow y dispara el despacho automático si fue pagado |
| `GET /api/orders/lookup?query=` | Búsqueda de órdenes por `ORD-...` o correo electrónico (para invitados) |
| `GET /api/orders/user/:userId` | Lista órdenes asociadas a un UID o email |
| `POST /api/orders/refresh-batch` | Actualiza estado y `remains` en lote desde SystemFollows para la barra de avance en vivo |
| `POST /api/orders/:orderId/refresh` | Refresca estado de una orden individual |
| `GET /api/admin/metrics` | Métricas financieras CLP/USD, estado catálogo, saldo y cola |
| `GET /api/admin/orders` | Listado total de órdenes con detalle técnico y costos |
| `GET /api/admin/catalog/technical` | Servicios crudos sincronizados desde SystemFollows |
| `GET /api/admin/catalog/comparison/:id` | Alternativas equivalentes ordenadas por costo para reasignación |
| `PATCH /api/admin/catalog/commercial/:id` | Editar publicación, precio (`.990`) o proveedor técnico manual |
| `POST /api/admin/services/sync` | Ejecuta sincronización inmediata contra SystemFollows |
| `POST /api/admin/balance/check` | Consulta saldo USD actual en SystemFollows |
| `POST /api/admin/flow/test` | Lanza una transacción de prueba en Flow y verifica `getStatus` |
| `GET / POST /api/admin/settings` | Lee y persiste dólar CLP, precios base Free/Premium y credenciales en Firestore |
| `POST /api/admin/tests/run` | Ejecuta la suite automatizada de 20 escenarios |

---

## 7. Base de Datos Firestore y Autenticación

- **Proyecto / DB:** Configurado en `firebase-applet-config.json` (Base de datos dedicada `ai-studio-potenciaredes-2db07e76-6893-4c7c-9473-ad0b5921f0f9`).
- **Colecciones principales:**
  - `orders`: Órdenes comerciales, estados, costos, ID proveedor, avance (`remains`, `startCount`) e historial.
  - `commercial_services`: Catálogo comercial publicado (Free y Premium).
  - `provider_services`: Servicios técnicos sincronizados de SystemFollows con historial de cambios.
  - `settings`: Documento `global` con precios base, tasa USD/CLP, credenciales y umbrales.
  - `job_queue`: Trabajos pendientes/reintentos automáticos de despacho.
  - `admin_notifications`, `provider_sync_history`, `provider_balance_history`, `users`, `admins`.
- **Roles:**
  - **Clientes e Invitados:** Pueden navegar, cotizar, pagar en Flow y rastrear órdenes por código o correo **sin necesidad de registrarse**; opcionalmente pueden entrar con Google para centralizar sus compras.
  - **Administrador:** Se concede automáticamente al correo definido en `ADMIN_EMAILS` / `BOOTSTRAP_ADMIN_EMAILS` (por defecto `rodrigogalvez@42labs.cl`).

---

## 8. Variables de Entorno e Instalación Local

Copia `.env.example` a `.env` y completa tus claves reales (nunca subas `.env` a repositorios públicos):

```env
PORT=3000
APP_URL="https://tu-dominio-en-produccion.com"
ADMIN_EMAILS="rodrigogalvez@42labs.cl"

# SystemFollows API v2
SYSTEMFOLLOWS_API_URL="https://systemfollows.com/api/v2"
SYSTEMFOLLOWS_API_KEY="TU_SYSTEMFOLLOWS_API_KEY"

# Precios base
DEFAULT_USD_CLP_RATE="950"
DEFAULT_GLOBAL_MARGIN_PERCENT="80"

# Flow.cl REST API v3
FLOW_ENVIRONMENT="PRODUCTION"
FLOW_API_KEY="TU_FLOW_API_KEY"
FLOW_SECRET_KEY="TU_FLOW_SECRET_KEY"
FLOW_PAYMENT_METHOD="9"
```

### Comandos Disponibles

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar entorno de desarrollo (Express + Vite en puerto 3000)
npm run dev

# 3. Validar tipos TypeScript
npm run lint

# 4. Compilar frontend para producción (/dist)
npm run build

# 5. Ejecutar servidor en modo producción
NODE_ENV=production npm start
```

---

## 9. Checklist Antes de Abrir al Público (Producción)

1. **Configurar `SYSTEMFOLLOWS_API_KEY` real y saldo USD:** Sin esta clave el despachador opera en modo simulación (`SF-SIM-...`). Ingresarla en **Admin -> Ajustes & Tests** o en `.env`.
2. **Proteger rutas `/api/admin/*` con token Firebase Bearer en backend:** Actualmente el control de acceso Admin protege la vista UI y reglas Firestore; antes de exponer públicamente en dominio propio conviene exigir verificación de token `adminAuth.verifyIdToken()` en el router `/api/admin/*` de Express.
3. **Configurar Dominios Autorizados en Firebase Auth:** Si usas un dominio personalizado (ej. `potenciaredes.cl`), agrégalo en *Firebase Console -> Authentication -> Settings -> Authorized domains* para que Google Login funcione fuera de `.run.app`.
4. **Verificar Webhook Público de Flow:** Probar una compra real de `$500`–`$2.990 CLP` sobre la URL pública final (sin bloqueos privados de entorno de desarrollo) para confirmar la cadena completa: **Flow -> Webhook/Retorno -> Compra en SystemFollows -> Barra de Progreso en Vivo**.
