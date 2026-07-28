export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const POST: APIRoute = async ({ request }) => {
  const json = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const name = String(data.name ?? '').trim().slice(0, 200);
  const email = String(data.email ?? '').trim().slice(0, 254);
  const message = String(data.message ?? '').trim().slice(0, 5000);
  const interest = ['albion', 'helix', 'partner', 'call', 'contributor'].includes(String(data.interest))
    ? String(data.interest)
    : 'general';
  const consented = data.consent === 'yes';
  const consentedAt = String(data.consentedAt ?? '').slice(0, 40);
  const pageUrl = String(data.pageUrl ?? '').slice(0, 300);
  const source = String(data.source ?? '').slice(0, 100);

  // Honeypot: bots fill the hidden "company" field, so pretend success.
  if (String(data.company ?? '').trim() !== '') return json(200, { ok: true });

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'A name and a valid email are required.' });
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) return json(503, { error: 'Email is not configured yet.' });

  const resend = new Resend(apiKey);
  // Until mindlynx.ai is verified in Resend, the onboarding sender can only
  // deliver to the account owner. Defaulting to hello@ made every production
  // submit 502 when CONTACT_TO was unset; fail safe to the deliverable inbox.
  const to = import.meta.env.CONTACT_TO ?? 'jsnyman@1digit.co.uk';
  const from = import.meta.env.CONTACT_FROM ?? 'MindLynx <onboarding@resend.dev>';

  const subject = {
    albion: `Albion waitlist · ${name}`,
    helix: `Helix waitlist · ${name}`,
    partner: `Partnership · ${name}`,
    call: `Call request · ${name}`,
    contributor: `Albion contributor · ${name}`,
    general: `MindLynx enquiry · ${name}`,
  }[interest]!;

  // UK GDPR consent record for the waitlist marketing lists. Kept in the
  // notification email so there is a durable, timestamped trail.
  const consentRecord = consented
    ? `<p style="color:#666;font-size:12px">Consent record: opted in to ${esc(interest)} list
       updates via an explicit unticked-by-default checkbox
       at ${esc(consentedAt || new Date().toISOString())} on ${esc(pageUrl || 'mindlynx.ai')}.</p>`
    : '';

  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject,
    html: `
      <p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p>
      <p>About: ${{ albion: 'Albion waitlist', helix: 'Helix waitlist', partner: 'Partnering on a product', call: 'A call with the team', contributor: 'The Albion contributor register', general: 'General enquiry' }[interest]}</p>
      ${message ? `<p>${esc(message).replace(/\n/g, '<br>')}</p>` : '<p><em>No message.</em></p>'}
      ${source ? `<p style="color:#666;font-size:12px">Source: ${esc(source)}</p>` : ''}
      ${consentRecord}
    `,
  });
  if (error) return json(502, { error: 'Could not send message.' });

  // Waitlist signups join the Resend audience only with explicit consent;
  // failure here is non-fatal.
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  if (interest === 'albion' && consented && audienceId) {
    await resend.contacts
      .create({ email, firstName: name, unsubscribed: false, audienceId })
      .catch(() => {});
  }

  return json(200, { ok: true });
};
