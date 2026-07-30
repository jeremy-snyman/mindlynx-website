/* Shared pieces of the Vera companion. The knowledge and behaviour live in
   src/content/companion-pack.md (Jeremy's v1.0 companion script); this file
   only wires it. Single Render instance by design: the rate limiter is an
   in-memory map. */

import PACK from '../content/companion-pack.md?raw';
import SITES from '../content/companion-sites.md?raw';
import ALBION_BANK from '../content/albion-bank.md?raw';

// Parts A to D go to the model. Part E is implementation reference and must
// stay out of Vera's context (it names the filter tokens and site-copy gaps).
// The sites reference is separate from Jeremy's authored script: a condensed,
// faithful snapshot of what the three sites publish (including the privacy
// policies), refreshed here whenever the site copy changes.
export const CONTEXT_PACK = PACK.split('\n# Part E')[0] + '\n\n' + SITES + '\n\n' + ALBION_BANK;

// Part E "site variable": selects emphasis and default next step, not knowledge.
export const SITE_SUFFIX = `

SITE

You are on mindlynx.ai. Lead with why we build it, the four offerings and the consulting side, and mirror this site's published wording. Your default next step here is a conversation: a scoping call, or simply taking their details so the team comes back to them. The waitlists and the contributor register are there for anyone who asks about Helix or Albion.`;

export const INTENTS = [
  'helix_waitlist',
  'albion_waitlist',
  'albion_contributor',
  'scoping_call',
  'design_partner',
  'send_info',
] as const;
export type Intent = (typeof INTENTS)[number];

/* ---------------- rate limiter (in-memory sliding window) ---------------- */
const LIMITS = {
  chat: { max: 20, windowMs: 60_000 },
  voice: { max: 5, windowMs: 600_000 },
  emit: { max: 60, windowMs: 60_000 },
  book: { max: 3, windowMs: 600_000 },
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

/* ---------------- transcript filter (guardrails backstop, per Part E) ----------------
   Names Vera must never say, plus currency figures and percentages: she has
   no approved number of either kind, so any that appears is an invention. */
const FORBIDDEN = ['justin', 'seillen', 'ionos', 'tui', 'zoopla', 'ohme', 'eca'];
const FORBIDDEN_RE = new RegExp(`\\b(${FORBIDDEN.join('|')})\\b`, 'gi');
const MONEY_RE = /[£$€]\s?\d[\d,.]*\s?(?:million|billion|k|m|bn)?/gi;
const PERCENT_RE = /\d[\d,.]*\s?(?:%|percent|per cent)/gi;

/**
 * Vera never uses an em dash. Models reach for them constantly, and asking in
 * the prompt only mostly works, so the prompt rule has this backstop behind it,
 * the same belt-and-braces as the forbidden-names filter above. A comma is the
 * substitution that is always grammatical where an em dash was doing the work.
 *
 * EM DASH ONLY. An en dash is the right character in a range, and rewriting it
 * turned "10–20" into "10, 20".
 */
export function deslop(text: string) {
  return String(text)
    .replace(/\s*—\s*/g, ', ') // em dash, spaced or not, becomes a comma
    .replace(/,\s*,/g, ',') // never double up on an existing comma
    .replace(/,\s*([.!?;:])/g, '$1') // and never leave ", ." behind
    .replace(/\s+,/g, ',');
}

export function redact(text: string) {
  const found: string[] = [];
  let out = String(text).replace(FORBIDDEN_RE, (m) => {
    found.push(m.toLowerCase());
    return 'a topic for a proper conversation';
  });
  out = out.replace(MONEY_RE, (m) => {
    found.push(m);
    return 'a figure for a proper conversation';
  });
  out = out.replace(PERCENT_RE, (m) => {
    found.push(m);
    return 'a figure for a proper conversation';
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
      'The intent says what the form does: helix_waitlist joins the Helix waiting list, ' +
      'albion_waitlist joins the Albion waitlist, albion_contributor joins the Albion contributor ' +
      'register, scoping_call asks the team to arrange a scoping call, design_partner starts a ' +
      'design partner conversation, send_info takes their details for any other follow-up or ' +
      'handover so the team comes back to them. If the visitor asks to change or correct a ' +
      'detail, call this tool again with the corrected values and a fresh form replaces the old ' +
      'one. Render-only: the visitor reviews the form and presses submit themselves.',
    parameters: {
      type: 'OBJECT',
      properties: {
        intent: { type: 'STRING', enum: [...INTENTS], description: 'What the visitor wants to do' },
        name: { type: 'STRING', description: 'Visitor name as given' },
        email: { type: 'STRING', description: 'Visitor email as given' },
        topic: {
          type: 'STRING',
          description:
            'Short context from the conversation: what the call or conversation is about, what to ' +
            'send, or for the contributor register their sector and expertise.',
        },
        preferredTime: {
          type: 'STRING',
          description:
            'For scoping_call: when the visitor said they would like the call, in their own ' +
            'words. Empty if they gave no preference.',
        },
        preferredDate: {
          type: 'STRING',
          description:
            'For scoping_call: the day the visitor most recently agreed, strictly YYYY-MM-DD ' +
            "computed fresh from today's date every time. Never reuse a day from earlier in the " +
            'conversation once the visitor has changed it. The on-screen calendar opens on this day.',
        },
      },
      required: ['intent', 'name', 'email'],
    },
  },
  {
    name: 'check_availability',
    description:
      'Look up the real bookable times for a scoping call. Call it when the visitor wants a ' +
      'call and timing comes up, before proposing any times. Returns human-readable slots in ' +
      'London time. Never invent a time that this tool did not return.',
    parameters: {
      type: 'OBJECT',
      properties: {
        from: {
          type: 'STRING',
          description:
            'ISO date lower bound, strictly YYYY-MM-DD, computed from today\'s date (e.g. "next Monday" ' +
            'means the following Monday\'s actual date). Omit for the coming week. Never a weekday name.',
        },
        to: { type: 'STRING', description: 'ISO date upper bound, strictly YYYY-MM-DD, at most 7 days after from.' },
      },
      required: [],
    },
  }],
};

export const TOOL_SUFFIX = `

WIRING

- Reply in plain conversational text. No markdown syntax, no HTML.
- The page has already delivered your A4 opening line before the visitor's first message. Do not introduce yourself again; pick the conversation up from their reply.
- Call the show_action_form tool only once the visitor has actually given both name and email, per A8. Pass a short topic from the conversation so the follow-up is not cold.
- For a scoping call, always use check_availability before putting the form up: if they named a time, look around it and offer the nearest two or three real slots; if they did not, offer two or three options. Their pick becomes preferredTime. If the lookup fails, just take their preference in their own words.
- After the tool call, the form is on their screen. They press the button; never claim anything was submitted.
- Never narrate your mechanics. No talk of tools, templates, functions or calling anything; simply put the form up and tell them it is on their screen.
- Never use an em dash. Commas, full stops and parentheses do that work. British spelling in every word, always: organise, recognise, colour, apologise.`;

export const VOICE_SUFFIX = `

WIRING, VOICE

- Part A12 governs everything you say aloud.
- You open the session: one short greeting in the shape of A4, then wait.
- Call the show_action_form tool only once the visitor has actually spoken both a name and an email, per A8. Then tell them the form is on their screen and the button press is theirs to make. Never claim anything was submitted.
- For a scoping call, always use check_availability before putting the form up, and offer at most two or three real options out loud, briefly; their pick becomes preferredTime. If the lookup fails, just take their preference in their own words.
- Never narrate your mechanics. No talk of tools, templates, forms you "have" or calling anything; simply put the form up and tell them it is on their screen.
- Never use an em dash, spoken or written. British spelling in every word, always.`;
