import type { IncomingMessage, ServerResponse } from 'http';
import https from 'https';

// Simple in-memory cache for TTS audio chunks
const audioCache = new Map<string, Buffer>();

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

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    // Parse query params (works for both Express and Vercel/Node req)
    const url = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
    const text = (req.query?.q || url.searchParams.get('q') || '').trim();
    let lang = (req.query?.tl || url.searchParams.get('tl') || 'it').trim();
    const speed = (req.query?.ttsspeed || url.searchParams.get('ttsspeed') || '1.0').trim();

    if (!text) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Text parameter "q" is required.' }));
      return;
    }

    const detected = detectScriptLanguage(text);
    const languagesToTry = [lang];
    if (detected && detected !== lang) {
      languagesToTry.push(detected);
    }

    const cacheKey = `${lang}:${speed}:${text.toLowerCase()}`;
    if (audioCache.has(cacheKey)) {
      const cached = audioCache.get(cacheKey)!;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cached.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.end(cached);
      return;
    }

    let audioBuffer: Buffer | null = null;
    let lastError: any = null;

    for (const currentLang of languagesToTry) {
      const candidateUrls = [
        `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(currentLang)}&client=tw-ob&ttsspeed=${encodeURIComponent(speed)}&q=${encodeURIComponent(text)}`,
        `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(currentLang)}&client=gtx&ttsspeed=${encodeURIComponent(speed)}&q=${encodeURIComponent(text)}`,
        `https://translate.google.co.uk/translate_tts?ie=UTF-8&tl=${encodeURIComponent(currentLang)}&client=tw-ob&ttsspeed=${encodeURIComponent(speed)}&q=${encodeURIComponent(text)}`,
      ];

      for (const targetUrl of candidateUrls) {
        try {
          audioBuffer = await fetchHttpsBuffer(targetUrl);
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
      throw lastError || new Error('Could not fetch TTS audio from Google TTS');
    }

    if (audioCache.size > 500) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(audioBuffer);
  } catch (error: any) {
    console.error('TTS proxy error:', error?.message || error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Failed to generate audio from Google TTS',
        details: error?.message,
      })
    );
  }
}
