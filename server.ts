import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import ttsHandler from './api/tts.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// In development, AI Studio Nginx proxies from 8080 to 3000, so dev server must listen on 3000.
// In standalone production, use PORT or 3000.
const portArgIndex = process.argv.indexOf('--port');
const portFromArg = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : null;
const PORT = portFromArg || (isProduction && process.env.PORT ? Number(process.env.PORT) : 3000);

// Serve public static assets (including favicon)
const publicPath = path.resolve(__dirname, 'public');
app.use(express.static(publicPath));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.resolve(publicPath, 'favicon.ico'), (err) => {
    if (err) res.status(204).end();
  });
});

// Use unified TTS handler (shared with Vercel serverless function)
app.all('/api/tts', (req, res) => ttsHandler(req, res));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Configure Vite integration
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (production=${isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
