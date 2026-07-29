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

  const html = `
      <p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p>
      <p>About: ${{ albion: 'Albion waitlist', helix: 'Helix waitlist', partner: 'Partnering on a product', call: 'A call with the team', contributor: 'The Albion contributor register', general: 'General enquiry' }[interest]}</p>
      ${message ? `<p>${esc(message).replace(/\n/g, '<br>')}</p>` : '<p><em>No message.</em></p>'}
      ${source ? `<p style="color:#666;font-size:12px">Source: ${esc(source)}</p>` : ''}
      ${consentRecord}
    `;
  let { error } = await resend.emails.send({ from, to, replyTo: email, subject, html });
  if (error) {
    // Until mindlynx.ai is verified in Resend, any env pointing from/to at
    // that domain makes every send fail. A visitor's message must never be
    // dropped over configuration: retry once with the pair Resend always
    // accepts for this account.
    console.warn('[contact] send failed via configured from/to, retrying with safe pair:', error?.message);
    ({ error } = await resend.emails.send({
      from: 'MindLynx <onboarding@resend.dev>',
      to: 'jsnyman@1digit.co.uk',
      replyTo: email,
      subject,
      html,
    }));
  }
  if (error) return json(502, { error: 'Could not send message.' });

  // Waitlist signups join the Resend audience only with explicit consent;
  // failure here is non-fatal.
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  if (interest === 'albion' && consented && audienceId) {
    await resend.contacts
      .create({ email, firstName: name, unsubscribed: false, audienceId })
      .catch(() => {});
  }

  // Best-effort acknowledgement to the visitor. Deliverable only once
  // mindlynx.ai is verified in Resend; until then it fails quietly and the
  // submission itself is unaffected.
  const ackFrom = import.meta.env.CONTACT_ACK_FROM ?? 'MindLynx <hello@mindlynx.ai>';
  const ack = {
    albion: {
      subject: "You're on the Albion waitlist",
      line: 'You are on the Albion waitlist. What people tell us here shapes which sector edition gets built first, so you will hear from us the moment there is news.',
    },
    helix: {
      subject: "You're on the Helix waiting list",
      line: 'You are on the Helix waiting list. You will hear from us the moment there is news.',
    },
    contributor: {
      subject: "You're on the Albion contributor register",
      line: 'You are on the Albion contributor register. When your sector opens, we come back to you with the terms in plain English.',
    },
    call: {
      subject: 'Your scoping call request',
      line: 'Your scoping call request is with the team. If a time was not already booked on screen, we will reply with times shortly.',
    },
    partner: {
      subject: 'Your design partner conversation',
      line: 'Thank you. The team will come back to you to set up the conversation properly.',
    },
    general: {
      subject: "We've got your message",
      line: 'Thanks for getting in touch. Someone from the team will come back to you properly.',
    },
  }[interest]!;
  const unsubNote = consented
    ? '<p style="color:#666;font-size:12px">You opted in to email updates for this list. You can unsubscribe or withdraw at any time.</p>'
    : '';
  await resend.emails
    .send({
      from: ackFrom,
      to: email,
      subject: ack.subject,
      html: `<p>Hello ${esc(name.split(' ')[0])},</p><p>${ack.line}</p><p>The MindLynx team</p>${unsubNote}`,
    })
    .catch(() => {});

  return json(200, { ok: true });
};
