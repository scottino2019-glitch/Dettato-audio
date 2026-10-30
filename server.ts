import express from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// In development, AI Studio Nginx proxies from 8080 to 3000, so dev server must listen on 3000.
// In standalone production, use PORT or 3000.
const portArgIndex = process.argv.indexOf('--port');
const portFromArg = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : null;
const PORT = portFromArg || (isProduction && process.env.PORT ? Number(process.env.PORT) : 3000);

// In-memory cache for TTS audio chunks to minimize network requests and speed up repeated words
const audioCache = new Map<string, Buffer>();

// Serve public static assets (including favicon)
const publicPath = path.resolve(__dirname, 'public');
app.use(express.static(publicPath));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.resolve(publicPath, 'favicon.ico'), (err) => {
    if (err) res.status(204).end();
  });
});

/**
 * Detect script language if text contains non-Latin scripts (e.g. Chinese, Japanese, Cyrillic, Arabic)
 */
function detectScriptLanguage(text: string): string | null {
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh-CN';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0370-\u03ff]/.test(text)) return 'el';
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  return null;
}

// Single HTTPS request helper with redirect support
function fetchHttpsBuffer(targetUrl: string, maxRedirects = 3): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const req = https.get(
      targetUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
          Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
          Referer: 'https://translate.google.com/',
        },
        timeout: 10000,
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          let redirectUrl = response.headers.location;
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(targetUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          return resolve(fetchHttpsBuffer(redirectUrl, maxRedirects - 1));
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
}

// API route to proxy Google / Android TTS
app.get('/api/tts', async (req, res) => {
  try {
    const text = ((req.query.q as string) || '').trim();
    let lang = ((req.query.tl as string) || 'it').trim();
    const speed = ((req.query.ttsspeed as string) || '1.0').trim();

    if (!text) {
      res.status(400).json({ error: 'Text parameter "q" is required.' });
      return;
    }

    // Auto-detect script language if there's a strong mismatch (e.g. Chinese characters with 'it' language)
    const detected = detectScriptLanguage(text);
    const languagesToTry = [lang];
    if (detected && detected !== lang) {
      languagesToTry.push(detected);
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

    let audioBuffer: Buffer | null = null;
    let lastError: any = null;

    // Try primary language and endpoints, then fallback if needed
    for (const currentLang of languagesToTry) {
      const candidateUrls = [
        `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(currentLang)}&client=tw-ob&ttsspeed=${encodeURIComponent(speed)}&q=${encodeURIComponent(text)}`,
        `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(currentLang)}&client=gtx&ttsspeed=${encodeURIComponent(speed)}&q=${encodeURIComponent(text)}`,
        `https://translate.google.co.uk/translate_tts?ie=UTF-8&tl=${encodeURIComponent(currentLang)}&client=tw-ob&ttsspeed=${encodeURIComponent(speed)}&q=${encodeURIComponent(text)}`,
      ];

      for (const url of candidateUrls) {
        try {
          audioBuffer = await fetchHttpsBuffer(url);
          if (audioBuffer && audioBuffer.length > 0) {
            break;
          }
        } catch (err) {
          lastError = err;
        }
      }

      if (audioBuffer && audioBuffer.length > 0) {
        break;
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw lastError || new Error('Could not fetch TTS audio from any Google TTS endpoint');
    }

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
    res.status(500).json({
      error: 'Failed to generate audio from Google TTS',
      details: error?.message,
    });
  }
});

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
