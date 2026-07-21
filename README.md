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

Built for Vercel (`@astrojs/vercel` adapter): import the repo in Vercel, set the
env vars from `.env.example`, done. Swap the adapter in `astro.config.mjs` to
deploy elsewhere.

## Images

`public/images/hero.jpg` is exported from the original source in
`design/hero-kayak-final.png`. `interlude.jpg` is still an interim asset recovered
from the design file (bottom region reconstructed) — replace with the original
seaside image, or regenerate hi-res with Higgsfield, when available.
