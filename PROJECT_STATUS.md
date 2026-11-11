# Estado del Proyecto — PotenciaRedes

## Resumen Ejecutivo
- **Nombre:** PotenciaRedes
- **Concepto:** Plataforma comercial SaaS de marketing digital y crecimiento para redes sociales en Chile y Latinoamérica.
- **Moneda:** CLP (Pesos Chilenos) con cotización de referencia USD/CLP configurable.
- **Zona Horaria:** America/Santiago.
- **Base de Datos & Auth:** Firebase Firestore y Firebase Auth aprovisionados exitosamente con reglas de seguridad estrictas (ABAC) desplegadas.
- **Backend:** Full-stack Node.js + Express + TypeScript montado con Vite dev middlewares en el puerto 3000.
- **Frontend:** React + TypeScript + Tailwind CSS con experiencia moderna, minimalista y responsive.

## Estado por Fases y Módulos

| Módulo / Fase | Estado | Descripción / Cobertura |
|---|---|---|
| **Fase 1: Fundación y Configuración** | COMPLETADO | Full-stack Express en puerto 3000, TypeScript, Firestore, Auth, RBAC (`CUSTOMER`, `ADMIN`, `SUPER_ADMIN`). Super Admin inicial: `rodrigogalvez@42labs.cl`. |
| **Fase 2: Catálogo en Dos Niveles** | COMPLETADO | Catálogo Técnico de Proveedores (`provider_services`) con normalización y catálogo Comercial (`commercial_services`) clasificado en 3 modalidades: Económico, Estándar y Premium. |
| **Fase 3: Sincronización Inteligente** | COMPLETADO | Motor de sincronización (`action=services`) con detección de altas, bajas temporales (`POSSIBLY_UNAVAILABLE`), desactivaciones (`INACTIVE`), variaciones de precio y límites. Trazabilidad completa en `changeHistory`. |
| **Fase 4: Comparador de Proveedores** | COMPLETADO | Algoritmo de detección de servicios equivalentes por plataforma, métrica y palabras clave. Asignación manual y automática al mejor precio/calidad. |
| **Fase 5: Control de Saldo & Umbrales** | COMPLETADO | Monitoreo continuo de saldo en mayorista con 4 niveles: Normal, Bajo ($30 USD), Crítico ($10 USD) e Insuficiente ($2 USD). Registro histórico y alertas automáticas. |
| **Fase 6: Resiliencia de Pedidos & Cola Persistente** | COMPLETADO | Manejo seguro de órdenes pagadas sin saldo mediante estado `PAID_WAITING_PROVIDER_BALANCE` y cola `job_queue` con reintentos exponenciales y dead-letter. Bloqueo de reintentos a ciegas en timeout (`REQUIRES_RECONCILIATION`). |
| **Fase 7: Centro de Notificaciones Admin** | COMPLETADO | Sistema de alertas categorizadas en 3 niveles (`CRITICAL`, `WARNING`, `INFO`) con deduplicación por entidad, persistencia en Firestore y panel de gestión. |
| **Fase 8: Pasarelas de Pago & Portal Cliente** | COMPLETADO | Integración completa con Transbank Webpay Plus y Webpay.cl Portal Directo (Empresa `186612` / Formulario `436254`) y Mercado Pago Chile en CLP. Tienda con filtros, badges de modalidad, confirmación directa y portal de cliente con seguimiento en vivo y solicitud de Refill. |
| **Fase 9: Panel de Administración Integral** | COMPLETADO | 8 sub-paneles: Resumen & Saldo, Pedidos, Cola de Procesamiento, Catálogo Comercial, Catálogo Técnico, Comparador de Proveedores, Notificaciones y Configuración. |
| **Fase 10: Suite de Verificación Automatizada** | COMPLETADO | Ejecutor automatizado de los 20 escenarios de resiliencia requeridos (`/api/admin/tests/run`). **Resultado: 20/20 escenarios aprobados (100% de éxito)**. |
| **Fase 11: Rastreo Público & Persistencia Global** | COMPLETADO | Endpoint `/api/orders/lookup` para rastreo inmediato de pedidos por ID o correo sin forzar inicio de sesión, preservación de órdenes en `localStorage` para invitados, y persistencia automática de configuraciones en Firestore (`settings/global`). |

## Credenciales y Variables de Entorno
Consulta el archivo `ENVIRONMENT.md` para las variables de entorno sin valores secretos. Para conectar SystemFollows a producción real, basta con ingresar la API Key en el panel administrativo o configurar `SYSTEMFOLLOWS_API_KEY`.

