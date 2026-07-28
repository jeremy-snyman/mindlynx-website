export const prerender = false;

import type { APIRoute } from 'astro';
import { getAvailability } from '../../lib/availability';
import { clientIp, rateLimit } from '../../lib/companion';

// Public read of scoping-call availability: slot times and per-slot booking
// links only, no secrets. Consumed by the chat brain, the voice service and
// the form's slot chips.
export const GET: APIRoute = async ({ request, clientAddress }) => {
  const limited = rateLimit('emit', clientIp(request, clientAddress));
  if (!limited.ok) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfter) },
    });
  }
  const url = new URL(request.url);
  try {
    const slots = await getAvailability(
      url.searchParams.get('from') ?? undefined,
      url.searchParams.get('to') ?? undefined
    );
    return new Response(JSON.stringify({ ok: true, slots: slots.slice(0, 40) }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
  } catch (err: any) {
    const configured = !String(err?.message ?? '').includes('not configured');
    return new Response(JSON.stringify({ ok: false, configured }), {
      status: configured ? 502 : 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
