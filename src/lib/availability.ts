/* Calendly availability for the scoping-call flow. The site holds the token;
   consumers (the chat brain's tool loop, the voice service, the form's slot
   chips) only ever see slot times and per-slot booking links. */

const TOKEN = import.meta.env.CALENDLY_TOKEN ?? '';
const EVENT_TYPE = import.meta.env.CALENDLY_EVENT_TYPE ?? ''; // optional: full event-type URI

export type Slot = { start: string; label: string; schedulingUrl: string };

let eventTypeUri = EVENT_TYPE;
let cache: { key: string; at: number; slots: Slot[] } | null = null;

const api = (path: string) =>
  fetch(`https://api.calendly.com${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });

async function resolveUserUri(): Promise<string> {
  const me = await api('/users/me');
  if (me.ok) return (await me.json()).resource.uri;
  // A scoped PAT may lack users:read, but the token itself names its user.
  try {
    const claims = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64').toString());
    if (claims.user_uuid) return `https://api.calendly.com/users/${claims.user_uuid}`;
  } catch {}
  throw new Error(`calendly users/me ${me.status}`);
}

async function resolveEventType(): Promise<string> {
  if (eventTypeUri) return eventTypeUri;
  const userUri = await resolveUserUri();
  const et = await api(`/event_types?user=${encodeURIComponent(userUri)}&active=true`);
  if (!et.ok) throw new Error(`calendly event_types ${et.status}`);
  const types: any[] = (await et.json()).collection ?? [];
  if (!types.length) throw new Error('no active Calendly event types');
  // Prefer the 30-minute meeting; otherwise whatever is first.
  const pick = types.find((t) => /30/.test(t.slug ?? '') || /30/.test(t.name ?? '')) ?? types[0];
  eventTypeUri = pick.uri;
  return eventTypeUri;
}

const label = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/London',
  });

/** Bookable slots between from and to (Calendly caps a query at 7 days). */
export async function getAvailability(from?: string, to?: string): Promise<Slot[]> {
  if (!TOKEN) throw new Error('calendly token not configured');
  // Models sometimes send "Monday 08:00" instead of an ISO date; an
  // unparseable bound falls back to the default window rather than throwing.
  const soonest = new Date(Date.now() + 60 * 60_000);
  let start = from ? new Date(from) : soonest;
  if (isNaN(start.getTime()) || start < soonest) start = soonest;
  let end = to ? new Date(to) : new Date(start.getTime() + 7 * 86_400_000);
  if (isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > 7 * 86_400_000) {
    end = new Date(start.getTime() + 7 * 86_400_000);
  }
  const key = `${start.toISOString().slice(0, 13)}:${end.toISOString().slice(0, 13)}`;
  if (cache && cache.key === key && Date.now() - cache.at < 60_000) return cache.slots;

  const uri = await resolveEventType();
  const res = await api(
    `/event_type_available_times?event_type=${encodeURIComponent(uri)}` +
      `&start_time=${encodeURIComponent(start.toISOString())}` +
      `&end_time=${encodeURIComponent(end.toISOString())}`
  );
  if (!res.ok) throw new Error(`calendly available_times ${res.status}`);
  const times: any[] = (await res.json()).collection ?? [];
  const slots = times
    .filter((t) => t.status === 'available')
    .map((t) => ({ start: t.start_time, label: label(t.start_time), schedulingUrl: t.scheduling_url }));
  cache = { key, at: Date.now(), slots };
  return slots;
}
