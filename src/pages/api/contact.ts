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
  const interest = data.interest === 'albion' ? 'albion' : 'general';

  // Honeypot: bots fill the hidden "company" field — pretend success.
  if (String(data.company ?? '').trim() !== '') return json(200, { ok: true });

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'A name and a valid email are required.' });
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) return json(503, { error: 'Email is not configured yet.' });

  const resend = new Resend(apiKey);
  const to = import.meta.env.CONTACT_TO ?? 'hello@mindlynx.ai';
  const from = import.meta.env.CONTACT_FROM ?? 'MindLynx <onboarding@resend.dev>';

  const subject =
    interest === 'albion'
      ? `Albion waitlist — ${name}`
      : `MindLynx enquiry — ${name}`;

  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject,
    html: `
      <p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p>
      <p>About: ${interest === 'albion' ? 'Albion waitlist' : 'General enquiry'}</p>
      ${message ? `<p>${esc(message).replace(/\n/g, '<br>')}</p>` : '<p><em>No message.</em></p>'}
    `,
  });
  if (error) return json(502, { error: 'Could not send message.' });

  // Waitlist signups also land in the Resend audience; failure here is non-fatal.
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  if (interest === 'albion' && audienceId) {
    await resend.contacts
      .create({ email, firstName: name, unsubscribed: false, audienceId })
      .catch(() => {});
  }

  return json(200, { ok: true });
};
