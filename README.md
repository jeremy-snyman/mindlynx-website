# MindLynx website

One-page company site for MindLynx, built with Astro. Static output plus a single
serverless endpoint (`/api/contact`) that sends contact-form messages via
[Resend](https://resend.com) and adds Albion-waitlist signups to a Resend audience.

## Develop

```sh
npm install
npm run dev
```

## Email setup

1. Create a Resend API key and copy `.env.example` to `.env`.
2. Verify the `mindlynx.ai` domain in Resend, then change `CONTACT_FROM` to a
   `@mindlynx.ai` sender. Until then the default `onboarding@resend.dev` sender works
   for testing (delivers only to your own Resend account email).
3. Optional: create an "Albion waitlist" audience and set `RESEND_AUDIENCE_ID`.

Without `RESEND_API_KEY` the endpoint returns 503 and the form shows its
fallback message pointing at hello@mindlynx.ai.

## Deploy

Uses the Node adapter (`@astrojs/node`, standalone), so it runs anywhere Node
runs. On Render: build command `npm install && npm run build`, start command
`npm start`, and set the env vars from `.env.example` in the dashboard. For
Vercel instead, swap the adapter back to `@astrojs/vercel`.

## Images

`public/images/hero.jpg` and `interlude.jpg` are exported from the originals in
`design/` (`hero-kayak-final.png`, `beach_1.png`). Re-export from there if they
ever need reprocessing.
