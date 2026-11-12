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
| `FLOW_ENVIRONMENT` | Ambiente Flow.cl (`PRODUCTION` o `SANDBOX`) | `PRODUCTION` | Sí |
| `FLOW_API_KEY` | API Key provista por Flow.cl | Configurada en `.env` o Secret Manager | Sí para pagos Flow |
| `FLOW_SECRET_KEY` | Secret Key HMAC-SHA256 de Flow.cl | Configurada en `.env` o Secret Manager | Sí para pagos Flow |
| `FLOW_PAYMENT_METHOD` | Código de medios habilitados (`9` = todos los medios) | `9` | Opcional |

> **Nota de Seguridad:** Ninguna clave secreta debe ser compartida en el cliente React ni prefijada con `VITE_`. Todas las llamadas hacia SystemFollows y Flow.cl se ejecutan exclusivamente en el backend Node.js / Express con autenticación y firma HMAC-SHA256 estricta.
