import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/routes/api.ts';
import { config } from './server/config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = config.port || 3000;

  // Middleware para JSON y Form URL Encoded (usado por Webpay y SMM Webhooks)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Registrar rutas de la API REST
  app.use('/api', apiRouter);

  // Transbank Webpay Plus Return Handler (soporta POST y GET enviados por Transbank)
  app.all(['/checkout/webpay-return', '/webpay-return'], (req, res) => {
    const token = req.body?.token_ws || req.query?.token_ws || req.body?.TBK_TOKEN || req.query?.TBK_TOKEN || '';
    const orderId = req.query?.orderId || req.body?.orderId || req.body?.buy_order || '';
    res.redirect(`/?webpay-return=true&token_ws=${encodeURIComponent(String(token))}&orderId=${encodeURIComponent(String(orderId))}`);
  });

  // Modo desarrollo con Vite Dev Middlewares
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Modo producción sirviendo archivos estáticos
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor PotenciaRedes activo en http://0.0.0.0:${PORT}`);
    console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
