/* Shared pieces of the Vera companion, ported from helix-website/server.mjs.
   Single Render instance by design: the rate limiter is an in-memory map. */

import PACK from '../content/companion-pack.md?raw';

export const CONTEXT_PACK = PACK;

export const INTENTS = ['helix_waitlist', 'albion_waitlist', 'send_info', 'book_call'] as const;
export type Intent = (typeof INTENTS)[number];

/* ---------------- rate limiter (in-memory sliding window) ---------------- */
const LIMITS = {
  chat: { max: 20, windowMs: 60_000 },
  voice: { max: 5, windowMs: 600_000 },
} as const;
const hits = new Map<string, number[]>();
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of hits) {
    const fresh = times.filter((t) => now - t < 600_000);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}, 300_000).unref?.();

export function rateLimit(routeClass: keyof typeof LIMITS, ip: string) {
  const { max, windowMs } = LIMITS[routeClass];
  const key = `${routeClass}:${ip}`;
  const now = Date.now();
  const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= max) {
    return { ok: false, retryAfter: Math.max(Math.ceil((times[0] + windowMs - now) / 1000), 1) };
  }
  times.push(now);
  hits.set(key, times);
  return { ok: true, retryAfter: 0 };
}

export function clientIp(request: Request, fallback: string) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return fallback || 'unknown';
}

/* ---------------- validation ---------------- */
export function clean(value: unknown, max: number) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/* ---------------- transcript filter (guardrails backstop) ---------------- */
const FORBIDDEN = ['justin', 'seillen', 'ionos', 'tui', 'zoopla', 'ohme', 'eca'];
const FORBIDDEN_RE = new RegExp(`\\b(${FORBIDDEN.join('|')})\\b`, 'gi');

export function redact(text: string) {
  const found: string[] = [];
  const out = String(text).replace(FORBIDDEN_RE, (m) => {
    found.push(m.toLowerCase());
    return 'a topic for a proper conversation';
  });
  return { text: out, found };
}

/* ---------------- the one tool: render-only, the human presses submit ---------------- */
export const ACTION_TOOL = {
  functionDeclarations: [{
    name: 'show_action_form',
    description:
      'Render a pre-filled action form in the chat. Call ONLY after the visitor has explicitly ' +
      'stated both their name and their email address in this conversation. Never call it with a ' +
      'guessed, assumed or example value; if you do not have a real email yet, ask for it instead. ' +
      'The intent says what the form does: helix_waitlist and albion_waitlist join that waiting ' +
      'list, send_info asks the team to email information, book_call asks the team to arrange a ' +
      'call. If the visitor asks to change or correct a detail, call this tool again with the ' +
      'corrected values and a fresh form replaces the old one. Render-only: the visitor reviews ' +
      'the form and presses submit themselves.',
    parameters: {
      type: 'OBJECT',
      properties: {
        intent: { type: 'STRING', enum: [...INTENTS], description: 'What the visitor wants to do' },
        name: { type: 'STRING', description: 'Visitor name as given' },
        email: { type: 'STRING', description: 'Visitor email as given' },
        topic: { type: 'STRING', description: 'For send_info: what they want information about. For book_call: what the call is about.' },
      },
      required: ['intent', 'name', 'email'],
    },
  }],
};

export const TOOL_SUFFIX = `

OUTPUT RULES

- Reply in plain conversational text. No markdown, no HTML, no bullet lists unless asked.
- Keep replies to a few sentences.
- The page has already greeted the visitor in your voice: it introduced you as Vera and asked whether you may call them by their first name and what it is. Do not repeat that introduction. If their first message reads as a bare name or an answer to that question, thank them, use the name from then on, and invite their first question.
- Action details are collected one per turn: ask for the full name, wait for the reply, then ask for the email, wait for the reply. If the visitor gives several details in one message, accept them all without re-asking.
- Call the show_action_form tool only once the visitor has actually given both name and email. Never fill it with a guessed or example value.
- Never claim to have submitted anything. The visitor presses the button themselves.`;

export const VOICE_SUFFIX = `

VOICE RULES

- You are speaking aloud in a real-time conversation. Short sentences, natural rhythm, one thought at a time.
- This is a conversation, not a presentation. Say one thing, then hand the turn back, and hand it back with a short question or invitation so the visitor always knows it is their turn. Never end your turn on a dead stop unless they are saying goodbye.
- Open with a single short greeting: welcome them, ask whether you may call them by their first name and what it is, then wait. Do not describe MindLynx or the products until they ask something.
- When they give you their name, thank them warmly and immediately ask how you can help, for example what they would like to know about MindLynx.
- Ask before you explain. Prefer a short answer followed by a question over a long answer.
- No lists, no headings, no formatting of any kind.
- Action details are collected one per turn: ask for the full name, wait for the answer, then ask for the email, and wait again. Never ask for two details in one breath. If the visitor offers several details in one go, accept them all without re-asking.
- Call the show_action_form tool only once the visitor has actually spoken both a name and an email. Never fill it with a guessed or example value; if the email is missing, ask for it.
- After the tool call, tell them the form is on their screen and the button press is theirs to make.
- Never claim to have submitted anything.`;
