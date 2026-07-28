export const prerender = false;

import { createHmac } from 'node:crypto';
import type { APIRoute } from 'astro';
import { CONTEXT_PACK, SITE_SUFFIX, VOICE_SUFFIX, clientIp, rateLimit } from '../../lib/companion';

// Voice runs on the Helix Pipecat service (Deepgram STT -> Gemini -> Cartesia
// TTS over WebRTC). We mint a short-lived HMAC-signed payload carrying Vera's
// instructions and voice; the service refuses anything unsigned, so the prompt
// stays server-owned even though the offer endpoint is public.
const VOICE_OFFER_SECRET = import.meta.env.VOICE_OFFER_SECRET ?? '';
const VOICE_CONNECT_URL =
  import.meta.env.VOICE_CONNECT_URL ?? 'https://app.helix.work/pipecat/api/offer';
// Gemma: British female, distinct from Victoria (the in-product Helix voice).
const VERA_VOICE_ID = import.meta.env.VERA_VOICE_ID ?? '62ae83ad-4f6a-430b-af41-a9bede9286ca';

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const limited = rateLimit('voice', ip);
  if (!limited.ok) {
    return json(429, { ok: false, error: 'Too many requests.' }, { 'Retry-After': String(limited.retryAfter) });
  }
  if (!VOICE_OFFER_SECRET) return json(503, { ok: false, error: 'Voice is not configured.' });

  const payload = Buffer.from(
    JSON.stringify({
      instructions: CONTEXT_PACK + SITE_SUFFIX + VOICE_SUFFIX,
      voiceId: VERA_VOICE_ID,
      site: 'mindlynx.ai',
      keyterms: ['MindLynx', 'Helix', 'Albion', 'Cortex', 'Tachyon', 'Pulse', 'Vera'],
      exp: Math.floor(Date.now() / 1000) + 120,
    })
  )
    .toString('base64url');
  const sig = createHmac('sha256', VOICE_OFFER_SECRET).update(payload).digest('hex');

  return json(200, { connectUrl: VOICE_CONNECT_URL, website: { payload, sig } });
};
