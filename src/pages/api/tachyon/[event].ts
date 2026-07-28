export const prerender = false;

import type { APIRoute } from 'astro';
import { clientIp, rateLimit } from '../../../lib/companion';

// First-party analytics proxy: the browser posts to our own origin and the
// server forwards to the Tachyon ingress, so the ingress domain never
// appears in client code or the network log.
const INGRESS = 'https://tachyon-dev.seillen.com/tachyon';

export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  const event = String(params.event ?? '');
  if (!/^[A-Za-z]{1,40}$/.test(event)) {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }
  const limited = rateLimit('emit', clientIp(request, clientAddress));
  if (!limited.ok) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfter) },
    });
  }
  let body: string;
  try {
    body = await request.text();
    if (body.length > 64 * 1024) return new Response(JSON.stringify({ ok: false }), { status: 413 });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }
  try {
    const res = await fetch(`${INGRESS}/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://mindlynx.ai' },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 502 });
  }
};
