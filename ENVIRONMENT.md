# Variables de Entorno — PotenciaRedes

Este documento detalla todas las variables de entorno utilizadas por el backend y frontend de PotenciaRedes, su propósito, valores por defecto y modo de configuración seguro.

| Variable | Descripción | Valor por defecto / Ejemplo | Obligatorio |
|---|---|---|---|
| `PORT` | Puerto de ejecución del servidor Express | `3000` | Sí |
| `APP_URL` | URL base de la aplicación (Cloud Run) | `https://ais-dev-...run.app` | Sí |
| `ADMIN_EMAILS` | Lista separada por comas de correos con acceso Super Administrador | `rodrigogalvez@42labs.cl` | Sí |
| `SYSTEMFOLLOWS_API_URL` | Endpoint de la API v2 de SystemFollows | `https://systemfollows.com/api/v2` | Sí |
| `SYSTEMFOLLOWS_API_KEY` | Clave API secreta de SystemFollows | Configurada en panel o Secret Manager | Sí en prod |
| `DEFAULT_USD_CLP_RATE` | Cotización base de dólar a peso chileno | `950` | Sí |
| `DEFAULT_GLOBAL_MARGIN_PERCENT` | Margen porcentual comercial por defecto sobre costo | `80` | Sí |
| `WEBPAY_MODE` | Modalidad de Webpay (`PORTAL_CL` o `REST_API`) | `PORTAL_CL` | Sí |
| `WEBPAY_PORTAL_FORM_ID` | Identificador de formulario en Webpay.cl | `436254` | Sí (en modo portal) |
| `WEBPAY_PORTAL_COMPANY_ID` | Código de empresa asignado en Webpay.cl | `186612` | Sí (en modo portal) |
| `WEBPAY_PORTAL_ACTION` | URL de acción del formulario Webpay.cl | `https://www.webpay.cl/backpub/external/form-pay` | Sí (en modo portal) |
| `WEBPAY_ENVIRONMENT` | Ambiente de Webpay Plus (`INTEGRATION` o `PRODUCTION`) | `PRODUCTION` | Sí |
| `WEBPAY_COMMERCE_CODE` | Código de comercio provisto por Transbank | Código oficial de prueba / producción | Opcional en modo portal |
| `WEBPAY_API_KEY` | Clave secreta provista por Transbank | Clave oficial de prueba / producción | Opcional en modo portal |
| `MERCADOPAGO_ENVIRONMENT` | Ambiente Mercado Pago (`TEST` o `PRODUCTION`) | `TEST` | Sí |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token de Mercado Pago | Credencial de integración / prod | Sí en prod |
| `MERCADOPAGO_PUBLIC_KEY` | Public Key para checkout y frontend | Credencial de prueba / prod | Opcional |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secreto para validación de firma en webhooks | Secreto generado en panel MP | Opcional |

> **Nota de Seguridad:** Ninguna clave secreta debe ser compartida en el cliente React ni prefijada con `VITE_`. Todas las llamadas hacia SystemFollows, Webpay y Mercado Pago se ejecutan exclusivamente en el backend Node.js / Express con autenticación estricta.
