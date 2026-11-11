import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  adminEmails: (process.env.ADMIN_EMAILS || 'rodrigogalvez@42labs.cl')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),
  
  // SystemFollows SMM API
  systemFollows: {
    apiUrl: process.env.SYSTEMFOLLOWS_API_URL || 'https://systemfollows.com/api/v2',
    apiKey: process.env.SYSTEMFOLLOWS_API_KEY || '',
  },

  // Pricing & Currency
  pricing: {
    defaultUsdClpRate: parseFloat(process.env.DEFAULT_USD_CLP_RATE || '950'),
    defaultGlobalMarginPercent: parseFloat(process.env.DEFAULT_GLOBAL_MARGIN_PERCENT || '80'),
    minProfitCLP: 500, // Margen mínimo por orden en CLP
  },

  // Transbank Webpay Plus & Webpay.cl Portal
  webpay: {
    environment: (process.env.WEBPAY_ENVIRONMENT || 'INTEGRATION') as 'PRODUCTION' | 'INTEGRATION',
    commerceCode: process.env.WEBPAY_COMMERCE_CODE || '597055555532', // Código oficial Transbank Integración
    apiKey: process.env.WEBPAY_API_KEY || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C', // Llave oficial Transbank Integración (64 hex)
    mode: (process.env.WEBPAY_MODE || 'REST_API') as 'PORTAL_CL' | 'REST_API',
    portalFormId: process.env.WEBPAY_PORTAL_FORM_ID || '436254',
    portalCompanyId: process.env.WEBPAY_PORTAL_COMPANY_ID || '186612',
    portalActionUrl: process.env.WEBPAY_PORTAL_ACTION || 'https://www.webpay.cl/backpub/external/form-pay',
  },

  // Mercado Pago
  mercadopago: {
    environment: process.env.MERCADOPAGO_ENVIRONMENT || 'TEST',
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET || '',
  }
};
