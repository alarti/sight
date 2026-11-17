import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Trust first hop proxy (Cloud Run / reverse proxy) without allowing arbitrary X-Forwarded-For spoofing
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Strict HTTP Security Headers Middleware (SaMD / Clinical Grade)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()'
  );
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join('; ')
  );
  next();
});

app.use(express.json({ limit: '256kb' }));

const TTS_MAX_TEXT_LENGTH = 600;
const TTS_RATE_LIMIT_WINDOW_MS = 60_000;
const TTS_MAX_REQUESTS_PER_WINDOW = 30;
const TTS_MAX_TRACKED_IPS = 2_000;
const ttsRequestLog = new Map<string, number[]>();

// Periodic garbage collection of stale rate-limit entries to prevent memory exhaustion
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ttsRequestLog.entries()) {
    const active = timestamps.filter(ts => now - ts < TTS_RATE_LIMIT_WINDOW_MS);
    if (active.length === 0) {
      ttsRequestLog.delete(ip);
    } else {
      ttsRequestLog.set(ip, active);
    }
  }
}, TTS_RATE_LIMIT_WINDOW_MS);
cleanupTimer.unref?.();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const safeIp = String(ip || 'local').slice(0, 64);

  // Evict oldest tracked IP if map exceeds capacity (LRU bound)
  if (!ttsRequestLog.has(safeIp) && ttsRequestLog.size >= TTS_MAX_TRACKED_IPS) {
    const oldestKey = ttsRequestLog.keys().next().value;
    if (oldestKey) ttsRequestLog.delete(oldestKey);
  }

  const recent = (ttsRequestLog.get(safeIp) || []).filter(ts => now - ts < TTS_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= TTS_MAX_REQUESTS_PER_WINDOW) {
    ttsRequestLog.set(safeIp, recent);
    return true;
  }
  recent.push(now);
  ttsRequestLog.set(safeIp, recent);
  return false;
}

const VALID_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
const VALID_LANGUAGES = ['es', 'en'] as const;

/**
 * Sanitizes free-form style or timbre descriptors to prevent LLM Prompt Injection
 */
function sanitizeDescriptor(input: unknown, maxLen = 80): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[^\p{L}\p{N}\s,.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clampNumeric(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

// Shared Google Gen AI client for server-side neural speech synthesis
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    neuralTtsAvailable: !!process.env.GEMINI_API_KEY,
    securityPolicy: 'CSP+RateLimit+Sanitized',
  });
});

app.get('/api/tts/status', (_req, res) => {
  res.json({
    available: !!process.env.GEMINI_API_KEY,
    model: 'gemini-3.8-flash-lite-tts',
    voices: VALID_VOICES,
  });
});

/**
 * High-definition Neural AI Text-to-Speech (24kHz Studio Quality)
 * Generates human-grade conversational speech with breath, prosody, and natural warmth.
 * Protected against prompt injection and parameter tampering.
 */
app.post('/api/tts', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'local';
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Too many TTS synthesis requests. Please wait briefly.',
      fallback: true,
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const rawText = body.text;

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
  }

  // Strip control characters from spoken text
  const cleanText = rawText.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();

  if (cleanText.length > TTS_MAX_TEXT_LENGTH) {
    return res.status(400).json({
      error: `Text exceeds maximum allowed length of ${TTS_MAX_TEXT_LENGTH} characters.`,
      fallback: true,
    });
  }

  // Re-check client in case environment variable was injected dynamically
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  if (!aiClient || !process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server.',
      fallback: true,
    });
  }

  try {
    const language = VALID_LANGUAGES.includes(body.language) ? body.language : 'es';
    const f0 = Math.round(clampNumeric(body.fundamentalFreqHz, 65, 450, 150));
    const timbre = sanitizeDescriptor(body.detectedTimbre, 32) || (language === 'en' ? 'natural' : 'natural');
    const f1 = Math.round(clampNumeric(body.formants?.f1, 250, 1050, 650));
    const f2 = Math.round(clampNumeric(body.formants?.f2, 850, 2800, 1450));
    const safeRate = clampNumeric(body.speechRate, 0.5, 1.8, 0.95);
    const sanitizedStyle = sanitizeDescriptor(body.style, 100);

    // Pick closest gender and register base voice
    let chosenVoice: typeof VALID_VOICES[number] = 'Zephyr';
    let expectedBaseF0 = 160;
    if (f0 < 125) {
      chosenVoice = 'Fenrir'; // Deep bass/baritone
      expectedBaseF0 = 108;
    } else if (f0 < 155) {
      chosenVoice = 'Charon'; // Baritone / warm tenor
      expectedBaseF0 = 130;
    } else if (f0 > 175) {
      chosenVoice = 'Kore'; // High / female
      expectedBaseF0 = 210;
    } else {
      chosenVoice = VALID_VOICES.includes(body.voiceName) ? body.voiceName : 'Puck';
      expectedBaseF0 = 150;
    }

    const bioAcousticStyle = language === 'en'
      ? `Exact bio-acoustic voice clone of a user recording: speaker with fundamental frequency anchored at ${f0} Hz (${timbre} register), vocal tract resonances at F1=${f1}Hz and F2=${f2}Hz, relaxed, steady speaking cadence (${Math.round(safeRate * 100)}%). Speak with this specific user's vocal depth, warmth, and oral cavity resonance.`
      : `Clonado bio-acústico exacto de la voz grabada del usuario: hablante con tono fundamental anclado en ${f0} Hz (registro ${timbre}), resonancias de formantes en F1=${f1}Hz y F2=${f2}Hz, cadencia pausada y tranquila (${Math.round(safeRate * 100)}%). Habla con la profundidad vocal, calidez y resonancia faríngea específica de esta persona real.`;

    const finalStyle = sanitizedStyle ? `${sanitizedStyle}. ${bioAcousticStyle}` : bioAcousticStyle;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style: finalStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio returned by neural TTS engine.', fallback: true });
    }

    return res.json({
      audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
      format: 'audio/wav',
      voiceName: chosenVoice,
      baseF0: expectedBaseF0,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Neural speech generation failed.';
    console.error('Error in neural TTS endpoint:', errMsg);
    return res.status(500).json({
      error: 'Neural speech generation failed.',
      fallback: true,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' }
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

