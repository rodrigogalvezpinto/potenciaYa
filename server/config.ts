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

  // Flow.cl (API REST v3 — Única pasarela de pago habilitada)
  flow: {
    environment: (process.env.FLOW_ENVIRONMENT || 'PRODUCTION') as 'PRODUCTION' | 'SANDBOX',
    apiKey: process.env.FLOW_API_KEY || '',
    secretKey: process.env.FLOW_SECRET_KEY || '',
    paymentMethod: parseInt(process.env.FLOW_PAYMENT_METHOD || '9', 10),
  },
};

