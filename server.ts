import express from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory cache for TTS audio chunks to minimize network requests and speed up repeated words
const audioCache = new Map<string, Buffer>();

// Favicon handler to avoid 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// API route to proxy Google / Android TTS
app.get('/api/tts', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  try {
    const text = (req.query.q as string || '').trim();
    const lang = (req.query.tl as string || 'it').trim();
    const speed = (req.query.ttsspeed as string || '1.0').trim();

    if (!text) {
      res.status(400).json({ error: 'Text parameter "q" is required.' });
      return;
    }

    const cacheKey = `${lang}:${speed}:${text.toLowerCase()}`;
    if (audioCache.has(cacheKey)) {
      const cached = audioCache.get(cacheKey)!;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cached.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached);
      return;
    }

    // Google Translate TTS URL
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&ttsspeed=${encodeURIComponent(speed)}&q=${encodeURIComponent(text)}`;

    const fetchRequest = (targetUrl: string): Promise<Buffer> => {
      return new Promise((resolve, reject) => {
        const req = https.get(
          targetUrl,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
              'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
              'Referer': 'https://translate.google.com/',
            },
            timeout: 10000,
          },
          (response) => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
              // Handle redirect
              return resolve(fetchRequest(response.headers.location));
            }

            if (response.statusCode !== 200) {
              return reject(new Error(`Google TTS responded with status: ${response.statusCode}`));
            }

            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', (err) => reject(err));
          }
        );

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Google TTS request timeout'));
        });
      });
    };

    const audioBuffer = await fetchRequest(googleTtsUrl);

    // Save in cache (limit cache size to 500 items)
    if (audioCache.size > 500) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(audioBuffer);
  } catch (error: any) {
    console.error('TTS proxy error:', error?.message || error);
    res.status(500).json({ error: 'Failed to generate audio from Google TTS', details: error?.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Configure Vite integration
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

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
