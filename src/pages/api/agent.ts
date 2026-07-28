export const prerender = false;

import type { APIRoute } from 'astro';
import {
  ACTION_TOOL,
  CONTEXT_PACK,
  INTENTS,
  SITE_SUFFIX,
  TOOL_SUFFIX,
  clean,
  clientIp,
  rateLimit,
  redact,
  type Intent,
} from '../../lib/companion';

const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = import.meta.env.GEMINI_MODEL ?? 'gemini-3.5-flash';

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const GET: APIRoute = () =>
  json(200, {
    ok: true,
    agent: !!GEMINI_API_KEY,
    // Voice now runs on the Pipecat service; it needs the offer-signing secret.
    voice: !!import.meta.env.VOICE_OFFER_SECRET,
    calendly: import.meta.env.CALENDLY_URL || null,
  });

type Turn = { role?: string; content?: unknown };

function toGeminiContents(message: string, history: unknown) {
  const contents: { role: 'user' | 'model'; parts: [{ text: string }] }[] = [];
  for (const turn of (Array.isArray(history) ? (history as Turn[]).slice(-20) : [])) {
    if (!turn || typeof turn.content !== 'string') continue;
    const text = turn.content.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    contents.push({ role: turn.role === 'agent' ? 'model' : 'user', parts: [{ text: text.slice(0, 2000) }] });
  }
  while (contents.length && contents[0].role === 'model') contents.shift(); // Gemini must open with user
  const last = contents[contents.length - 1];
  if (!last || last.role !== 'user' || last.parts[0].text !== message) {
    contents.push({ role: 'user', parts: [{ text: message }] }); // page pushes message into history pre-POST; dedupe
  }
  return contents;
}

async function callGemini(message: string, history: unknown) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: CONTEXT_PACK + SITE_SUFFIX + TOOL_SUFFIX }] },
      contents: toGeminiContents(message, history),
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }, // the model thinks inside this budget; 500 left answers truncated
      tools: [ACTION_TOOL],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const parts: any[] = (await res.json()).candidates?.[0]?.content?.parts ?? [];
  let reply = parts.filter((p) => p.text).map((p) => p.text).join(' ').trim();
  const call = parts.find((p) => p.functionCall)?.functionCall;
  let action;
  if (call?.name === 'show_action_form') {
    const args = call.args || {};
    const intent = (INTENTS as readonly string[]).includes(args.intent) ? (args.intent as Intent) : 'send_info';
    action = {
      type: 'show_action_form',
      intent,
      name: clean(args.name, 200),
      email: clean(args.email, 254).toLowerCase(),
      topic: clean(args.topic, 300),
    };
    reply ||= 'Here is your form, pre-filled. Check the details, then press the button. The button press is yours to make, not mine.';
  }
  if (!reply) throw new Error('empty reply'); // safety block or similar
  return { reply, action };
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const limited = rateLimit('chat', ip);
  if (!limited.ok) {
    return json(429, { ok: false, error: 'Too many requests.' }, { 'Retry-After': String(limited.retryAfter) });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }
  if (!GEMINI_API_KEY) return json(503, { fallback: true });
  const message = clean(body.message, 2000);
  if (!message) return json(400, { ok: false, error: 'A message is required.' });
  try {
    const { reply, action } = await callGemini(message, body.history);
    const filtered = redact(reply);
    if (filtered.found.length) {
      console.warn('[companion] redacted:', filtered.found.join(','), 'ip:', ip);
    }
    return json(200, action ? { reply: filtered.text, action } : { reply: filtered.text });
  } catch {
    return json(503, { fallback: true }); // the widget shows a graceful outage line
  }
};
