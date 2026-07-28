export const prerender = false;

import type { APIRoute } from 'astro';
import { getAvailability } from '../../lib/availability';
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
// With an Anthropic key present, Claude is the brain; Gemini stays the fallback.
const ANTHROPIC_API_KEY = import.meta.env.ANTHROPIC_API_KEY ?? '';
const CLAUDE_MODEL = import.meta.env.CLAUDE_MODEL ?? 'claude-opus-5';

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const GET: APIRoute = () =>
  json(200, {
    ok: true,
    agent: !!(ANTHROPIC_API_KEY || GEMINI_API_KEY),
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

async function geminiParts(contents: unknown[]): Promise<any[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text:
            CONTEXT_PACK + SITE_SUFFIX + TOOL_SUFFIX +
            `\n\nToday is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })}.`,
        }],
      },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }, // the model thinks inside this budget; 500 left answers truncated
      tools: [ACTION_TOOL],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  return (await res.json()).candidates?.[0]?.content?.parts ?? [];
}

// The one server-executed tool: look up real slots, hand them back, let the
// model offer them. One round only; a second lookup waits for the next turn.
async function availabilityResult(args: any): Promise<object> {
  try {
    const slots = await getAvailability(args?.from, args?.to);
    return slots.length
      ? {
          slots: slots.slice(0, 12).map((s) => s.label),
          note: 'offer the visitor two or three of these in your reply and let them choose; only render the form once they have picked or declined to',
        }
      : { slots: [], note: 'nothing bookable in that window; ask for their preference in words' };
  } catch {
    return { error: 'availability lookup is unavailable; ask for their preference in words' };
  }
}

async function callGemini(message: string, history: unknown) {
  const contents: any[] = toGeminiContents(message, history);
  let parts = await geminiParts(contents);
  let call = parts.find((p) => p.functionCall)?.functionCall;
  if (call?.name === 'check_availability') {
    const response = await availabilityResult(call.args);
    // Echo the model turn back VERBATIM: Gemini 3.x signs its function calls
    // (thoughtSignature) and rejects a replay that drops the signature.
    contents.push({ role: 'model', parts });
    contents.push({ role: 'user', parts: [{ functionResponse: { name: 'check_availability', response } }] });
    parts = await geminiParts(contents);
    call = parts.find((p) => p.functionCall)?.functionCall;
  }
  let reply = parts.filter((p) => p.text).map((p) => p.text).join(' ').trim();
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
      preferredTime: clean(args.preferredTime, 120),
    };
    reply ||= 'Here is your form, pre-filled. Check the details, then press the button. The button press is yours to make, not mine.';
  }
  if (!reply) throw new Error('empty reply'); // safety block or similar
  return { reply, action };
}

/* ---------------- Claude path (the default brain when a key is present) ---------------- */

// Anthropic tools use lowercase JSON Schema types; convert the shared
// declarations rather than maintaining a second copy.
const toClaudeSchema = (p: any): any => {
  if (Array.isArray(p)) return p.map(toClaudeSchema);
  if (p && typeof p === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(p)) out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : toClaudeSchema(v);
    return out;
  }
  return p;
};
const CLAUDE_TOOLS = (ACTION_TOOL.functionDeclarations as any[]).map((f) => ({
  name: f.name,
  description: f.description,
  input_schema: toClaudeSchema(f.parameters),
}));

function toClaudeMessages(message: string, history: unknown) {
  const messages: { role: 'user' | 'assistant'; content: any }[] = [];
  for (const turn of (Array.isArray(history) ? (history as Turn[]).slice(-20) : [])) {
    if (!turn || typeof turn.content !== 'string') continue;
    const text = turn.content.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    const role = turn.role === 'agent' ? 'assistant' : 'user';
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content += '\n' + text.slice(0, 2000); // roles must alternate
    else messages.push({ role, content: text.slice(0, 2000) });
  }
  while (messages.length && messages[0].role === 'assistant') messages.shift(); // must open with user
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || last.content !== message) {
    messages.push({ role: 'user', content: message }); // page pushes message into history pre-POST; dedupe
  }
  return messages;
}

async function claudeCreate(messages: any[]): Promise<any> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      // No temperature: Opus 5 thinks by default and rejects one. Determinism
      // here comes from the pack, not the sampler.
      max_tokens: 2048,
      // The pack is static and cached; the date rides in its own uncached block
      // so "next Monday" can become a real ISO date without breaking the cache.
      system: [
        { type: 'text', text: CONTEXT_PACK + SITE_SUFFIX + TOOL_SUFFIX, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })}.` },
      ],
      tools: CLAUDE_TOOLS,
      messages,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`claude ${res.status}`);
  return res.json();
}

async function callClaude(message: string, history: unknown) {
  const messages = toClaudeMessages(message, history);
  let data = await claudeCreate(messages);
  let toolUse = (data.content ?? []).find((b: any) => b.type === 'tool_use');
  // The model may correct its window and look again; give it a few rounds.
  for (let round = 0; round < 3 && toolUse?.name === 'check_availability'; round++) {
    const response = await availabilityResult(toolUse.input);
    messages.push({ role: 'assistant', content: data.content });
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(response) }],
    });
    data = await claudeCreate(messages);
    toolUse = (data.content ?? []).find((b: any) => b.type === 'tool_use');
  }
  let reply = (data.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join(' ')
    .trim();
  let action;
  if (toolUse?.name === 'show_action_form') {
    const args = toolUse.input || {};
    const intent = (INTENTS as readonly string[]).includes(args.intent) ? (args.intent as Intent) : 'send_info';
    action = {
      type: 'show_action_form',
      intent,
      name: clean(args.name, 200),
      email: clean(args.email, 254).toLowerCase(),
      topic: clean(args.topic, 300),
      preferredTime: clean(args.preferredTime, 120),
    };
    reply ||= 'Here is your form, pre-filled. Check the details, then press the button. The button press is yours to make, not mine.';
  }
  if (!reply) throw new Error('empty reply');
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
  if (!ANTHROPIC_API_KEY && !GEMINI_API_KEY) return json(503, { fallback: true });
  const message = clean(body.message, 2000);
  if (!message) return json(400, { ok: false, error: 'A message is required.' });
  try {
    const { reply, action } = ANTHROPIC_API_KEY
      ? await callClaude(message, body.history)
      : await callGemini(message, body.history);
    const filtered = redact(reply);
    if (filtered.found.length) {
      console.warn('[companion] redacted:', filtered.found.join(','), 'ip:', ip);
    }
    return json(200, action ? { reply: filtered.text, action } : { reply: filtered.text });
  } catch {
    return json(503, { fallback: true }); // the widget shows a graceful outage line
  }
};
