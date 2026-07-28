export const prerender = false;

import type { APIRoute } from 'astro';
import { ACTION_TOOL, CONTEXT_PACK, SITE_SUFFIX, VOICE_SUFFIX, clientIp, rateLimit } from '../../lib/companion';

const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY ?? '';
const GEMINI_LIVE_MODEL = import.meta.env.GEMINI_LIVE_MODEL ?? 'gemini-3.1-flash-live-preview';
const GEMINI_VOICE = import.meta.env.GEMINI_VOICE ?? 'Aoede';

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

async function mintVoiceToken() {
  const { GoogleGenAI } = await import('@google/genai'); // only loaded when voice is used
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });
  const now = Date.now();
  // The mint locks model, system instruction, tools and temperature so a
  // hostile client cannot substitute its own.
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + 10 * 60_000).toISOString(), // hard server-side session kill
      newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(), // window to actually connect
      liveConnectConstraints: {
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: ['AUDIO'],
          temperature: 0.3,
          // Pin the voice. Without speechConfig the Live API may pick a
          // fresh voice per response, so Vera changed voice mid-conversation.
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } },
          systemInstruction: CONTEXT_PACK + SITE_SUFFIX + VOICE_SUFFIX,
          tools: [ACTION_TOOL],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
      httpOptions: { apiVersion: 'v1alpha' },
    },
  });
  return token.name;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const limited = rateLimit('voice', ip);
  if (!limited.ok) {
    return json(429, { ok: false, error: 'Too many requests.' }, { 'Retry-After': String(limited.retryAfter) });
  }
  if (!GEMINI_API_KEY) return json(503, { ok: false, error: 'Voice is not configured.' });
  try {
    const token = await mintVoiceToken();
    return json(200, { token, model: GEMINI_LIVE_MODEL });
  } catch (err: any) {
    console.error('voice token mint failed:', err?.message || err);
    return json(503, { ok: false, error: 'Voice is unavailable just now.' });
  }
};
