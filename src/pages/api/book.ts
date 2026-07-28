export const prerender = false;

import type { APIRoute } from 'astro';
import { bookSlot } from '../../lib/availability';
import { clean, clientIp, rateLimit } from '../../lib/companion';

// In-site booking for a chosen slot: the human picked a real time in the chat
// form and pressed the button, so the calendar entry is theirs to make; the
// companion never calls this.
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const limited = rateLimit('book', clientIp(request, clientAddress));
  if (!limited.ok) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfter) },
    });
  }
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }
  const start = new Date(String(data.start ?? ''));
  const name = clean(data.name, 200);
  const email = clean(data.email, 254).toLowerCase();
  const soon = Date.now() - 60_000;
  const horizon = Date.now() + 60 * 86_400_000;
  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    isNaN(start.getTime()) ||
    start.getTime() < soon ||
    start.getTime() > horizon
  ) {
    return new Response(JSON.stringify({ ok: false, error: 'A name, a valid email and a real slot are required.' }), { status: 400 });
  }
  try {
    await bookSlot(start.toISOString(), name, email);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.warn('[book] failed:', err?.message);
    return new Response(JSON.stringify({ ok: false }), { status: 502 });
  }
};
