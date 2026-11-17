import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

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
  });
});

app.get('/api/tts/status', (_req, res) => {
  res.json({
    available: !!process.env.GEMINI_API_KEY,
    model: 'gemini-3.8-flash-lite-tts',
    voices: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'],
  });
});

/**
 * High-definition Neural AI Text-to-Speech (24kHz Studio Quality)
 * Generates human-grade conversational speech with breath, prosody, and natural warmth.
 */
app.post('/api/tts', async (req, res) => {
  const { 
    text, 
    language = 'es', 
    voiceName, 
    style,
    fundamentalFreqHz,
    detectedTimbre,
    formants,
    speechRate,
  } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
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
    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const f0 = fundamentalFreqHz ? Math.round(fundamentalFreqHz) : 150;
    const timbre = detectedTimbre || 'natural';
    const f1 = formants?.f1 || 650;
    const f2 = formants?.f2 || 1450;

    // Pick closest gender and register base voice
    let chosenVoice = 'Zephyr';
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
      chosenVoice = voiceName && validVoices.includes(voiceName) ? voiceName : 'Puck';
      expectedBaseF0 = 150;
    }

    const bioAcousticStyle = language === 'en'
      ? `Exact bio-acoustic voice clone of a user recording: speaker with fundamental frequency anchored at ${f0} Hz (${timbre} register), vocal tract resonances at F1=${f1}Hz and F2=${f2}Hz, relaxed, steady speaking cadence (${Math.round((speechRate || 0.95)*100)}%). Speak with this specific user's vocal depth, warmth, and oral cavity resonance.`
      : `Clonado bio-acústico exacto de la voz grabada del usuario: hablante con tono fundamental anclado en ${f0} Hz (registro ${timbre}), resonancias de formantes en F1=${f1}Hz y F2=${f2}Hz, cadencia pausada y tranquila (${Math.round((speechRate || 0.95)*100)}%). Habla con la profundidad vocal, calidez y resonancia faríngea específica de esta persona real.`;

    const finalStyle = style ? `${style}. ${bioAcousticStyle}` : bioAcousticStyle;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
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
  } catch (err: any) {
    console.error('Error in neural TTS endpoint:', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Neural speech generation failed.',
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
