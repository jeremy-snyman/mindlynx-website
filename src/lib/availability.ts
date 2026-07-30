/* Calendly availability for the scoping-call flow. The site holds the token;
   consumers (the chat brain's tool loop, the voice service, the form's slot
   chips) only ever see slot times and per-slot booking links. */

const TOKEN = import.meta.env.CALENDLY_TOKEN ?? '';
const EVENT_TYPE = import.meta.env.CALENDLY_EVENT_TYPE ?? ''; // optional: full event-type URI

export type Slot = { start: string; label: string; schedulingUrl: string };

let eventTypeUri = EVENT_TYPE;
/* The event type's configured location, passed through on every direct booking.
   Calendly's POST /invitees REQUIRES a top-level `location` matching the event
   type's configuration; omitted, every booking 400s with "Specified location
   kind is not configured for this event type" — which is why, until 2026-07-30,
   no booking had ever landed from any site. (The error names
   `event.location_configuration.kind`, but the field the API actually wants is
   top-level `location: {kind, location}` — proven against the live API.) */
let eventTypeLocation: { kind: string; location?: string } | null = null;
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
  if (eventTypeUri && eventTypeLocation) return eventTypeUri;
  if (eventTypeUri) {
    // A pinned event type still needs its location for direct booking.
    const one = await api(`/event_types/${eventTypeUri.split('/').pop()}`);
    if (one.ok) rememberLocation((await one.json()).resource);
    return eventTypeUri;
  }
  const userUri = await resolveUserUri();
  const et = await api(`/event_types?user=${encodeURIComponent(userUri)}&active=true`);
  if (!et.ok) throw new Error(`calendly event_types ${et.status}`);
  const types: any[] = (await et.json()).collection ?? [];
  if (!types.length) throw new Error('no active Calendly event types');
  // Prefer the 30-minute meeting; otherwise whatever is first.
  const pick = types.find((t) => /30/.test(t.slug ?? '') || /30/.test(t.name ?? '')) ?? types[0];
  eventTypeUri = pick.uri;
  rememberLocation(pick);
  return eventTypeUri;
}

function rememberLocation(eventType: any): void {
  const loc = eventType?.locations?.[0];
  if (loc?.kind) {
    eventTypeLocation = { kind: loc.kind, ...(loc.location ? { location: loc.location } : {}) };
  }
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

/** Book a slot directly via the Calendly API: the visitor never leaves the site.
    Requires the event type's location to be API-bookable (custom text, not an
    auto-generated conference link). */
export async function bookSlot(start: string, name: string, email: string) {
  if (!TOKEN) throw new Error('calendly token not configured');
  const uri = await resolveEventType();
  const res = await fetch('https://api.calendly.com/invitees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: uri,
      start_time: start,
      invitee: { name, email, timezone: 'Europe/London' },
      // Without this, Calendly refuses every direct booking — see above.
      ...(eventTypeLocation ? { location: eventTypeLocation } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`calendly book ${res.status}: ${(await res.text()).slice(0, 200)}`);
  cache = null; // the slot just left the diary
  return res.json();
}

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
