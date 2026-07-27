---
target: the homepage
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
timestamp: 2026-07-27T06-17-03Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design review · B: detector + browser evidence), synthesised with parent verification of the API claim.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No active-section state on an 8,156px page; form success replaces the form with no announcement and no focus move (`activeElement` drops to `<body>`) |
| 2 | Match System / Real World | 3 | Copy is excellent and human, but nav is internal-poetic ("Why we build", "What we believe") and "Join the waitlist" lands on a generic contact form |
| 3 | User Control and Freedom | 2 | Escape does not close the mobile menu (verified); no back-to-top; after success there is no way to send again or review what was sent |
| 4 | Consistency and Standards | 3 | Rigorous internal rhythm; but three underline treatments for one semantic CTA, and identical styling for "leaves the site" vs "jumps in-page" |
| 5 | Error Prevention | 2 | Mechanically sound (required attrs, `type=email`, server allowlist, length caps) but unsignposted: required fields unmarked, "optional" lives only in a 2.49:1 placeholder |
| 6 | Recognition Rather Than Recall | 2 | No `aria-current`, no active section; the `interest` select is silently pre-set by links ~3,000px away with no confirmation |
| 7 | Flexibility and Efficiency | 2 | The `data-interest` accelerator is half-built — URL never changes, so `?interest=albion` cannot be shared, bookmarked or campaign-tagged |
| 8 | Aesthetic and Minimalist Design | 3 | Real restraint: one display face, one accent, four sizes. Deduction: three consecutive low-information bands and ~1,700px of photography carrying twelve words |
| 9 | Error Recovery | 2 | One generic string for 400 / 502 / 503 / network — `index.astro:343` discards the response body; recovery address is plain text, not a `mailto:` |
| 10 | Help and Documentation | 1 | "Operating system for work", "governed from the first action", "sovereign" introduced with zero elaboration path, no docs link, no product visual |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment: the words are MindLynx's; the design is a rental.** Swap the wordmark and this page works unchanged for a boutique law firm, a wealth manager or a whisky distillery. Earned: the copy (genuinely distinctive, British, free of AI-marketing tics), the base64 LQIP behind the hero, the `data-interest` funnel wiring, the ML monogram. Category-default: the 1fr/2.35fr label-left editorial grid, alternating cream/near-black bands, cream+ink+gold palette, fade-up-26px reveals, `translateY(-2px)` hovers — the 2021–24 "premium studio" template. The sharpest indictment: a company whose pitch is *agents and humans side by side, governed from the first action* and *sovereign models* has **not one interface moment demonstrating autonomy, governance, sovereignty or cost**.

**Deterministic scan:** `detect.mjs` on `src/pages/index.astro` — exit 0, **1 finding**: `em-dash-overuse` (warning, category `slop`, advisory). Independent recount confirms the trigger is real: 14 em-dashes across 3,137 characters of visible prose = 1 per 224 chars, over 2× the ~1-per-500 threshold. Three are paired parentheticals (a different device); ~11 form a repeating `statement — qualifier` cadence. **Real as measurement, stylistic as judgement.** No false positives; no other findings. Notably the detector found nothing the review missed — every material problem below came from human-grade review or browser measurement, not the scanner.

**Visual overlays:** not injected. Browser evidence was gathered by direct measurement instead, so no user-visible overlay exists in a browser tab.

## Overall Impression

This is a visually accomplished, operationally under-built page. The craft is concentrated almost entirely in the typography and the copy — both genuinely good — while the failures cluster precisely where the business goals live: the product differentiators are the least legible text on the page, the contact form is nearly invisible, and there is no evidence anywhere that MindLynx is a real company.

The single biggest opportunity: **the page asks for trust from a sceptical technical audience while providing zero proof.** Fix the evidence gap and the contrast, and this goes from handsome brochure to credible studio.

## What's Working

1. **The copy is the product.** For a pre-launch studio with nothing shippable to show, voice is the only differentiator, and this one is distinctive: "Intelligence that answers to no one else." / "say clearly what remains unfinished" / "A person reads every message." Consistent British English, zero AI-marketing cliché.
2. **Typographic restraint and rhythm.** One display face, one text face, one accent, four sizes, hairline rules, 01/02/03 numbering, `text-wrap: balance` on every display heading, −0.055em on the h1. The alternating ink/paper bands do the sectioning work most sites do with cards and shadows.
3. **Accessibility fundamentals are genuinely solid** where they were designed rather than defaulted: exactly one h1, no heading-level skips, no horizontal overflow at 320–1920px, zero console errors, and `prefers-reduced-motion` verified to actually disable the hero settle and all reveals (`getAnimations()` returns empty) — not just declared in CSS.

## Priority Issues

**[P0] There is zero evidence anywhere on the page that MindLynx is real.**
No founder name, no face, no date, no client, no number, no company registration, no Helix screenshot, no repo link — despite "open source" being a core claim in two of five products.
*Why it matters:* the audience is founders and technical leaders evaluating a domain registered days ago. Their first question is "is this a company or a landing page?" and the site answers with more prose. This suppresses **both** conversion goals — nobody hands an email to an unverifiable entity, and nobody clicks through to an unvouched product.
*Fix:* one proof band before the contact section — founder name, face, one-line bio; "MindLynx Ltd, registered in England No. …"; a live Helix screenshot or short silent loop; a GitHub link. If Albion has no public repo yet, say so with a date; the page's own value ("say clearly what remains unfinished") gives permission.
*Suggested command:* `/impeccable shape`

**[P1] Every product differentiator is set at 1.81:1 contrast.**
Gold `#d6ad68` on paper `#f2eee5` = **1.81:1**; on paper-deep `#e4ddcf` = **1.55:1** (independently recomputed). This governs every light-band `.section-label` ("WHY WE BUILD", "WHAT WE DO", "COMING NEXT", "BUILDING IN THE OPEN"), `.product-number`, and worst of all `.product-tags` — where Helix's and Albion's actual selling points live, at 11.8px uppercase with 0.15em tracking. Fails WCAG 1.4.3 by roughly 3×. Nine failing text nodes total; `.partner-card .section-label` also fails at 3.57:1.
*Why it matters:* the four phrases that distinguish these products from every other AI company are the four least readable strings on the site.
*Fix:* the gold works on ink (9.08:1) and only on ink. On paper use a deep bronze (~`#8a6420`, ≈4.6:1) for these labels, or drop the accent on light bands entirely. Do not tint the paper.
*Suggested command:* `/impeccable colorize`

**[P1] The contact form is functionally invisible and its required/optional model is unstated.**
Input underlines are `rgba(247,241,229,0.17)` = **1.58:1** against ink, below the 3:1 WCAG 1.4.11 floor for control boundaries — in the full-page render the Name and Email fields read as empty black space. `.field input:focus { outline: none }` (0,2,0) overrides the global `:focus-visible` gold ring (0,1,0), verified in-browser: **all four form controls show `outline: none` on keyboard focus** while the submit button correctly keeps its ring. Required fields are unmarked; "optional" for Message exists only in a 2.49:1 placeholder that vanishes on first keystroke.
*Why it matters:* the primary conversion goal is rendered as the least visible element on the page, and it is the one part of the site that is hard to use by keyboard.
*Fix:* raise the underline to ≈`rgba(247,241,229,0.42)` (~3.3:1); scope the outline reset to `:focus:not(:focus-visible)`; move "(optional)" into the Message `<label>`; state which fields are required.
*Suggested command:* `/impeccable harden`

**[P1] No privacy statement, and Albion submissions silently join a marketing audience.**
No privacy policy, consent line or legal link anywhere; the footer carries only "MindLynx Ltd · London". Meanwhile `src/pages/api/contact.ts:64–69` adds `interest === 'albion'` submissions to a Resend audience with `unsubscribed: false`.
*Why it matters:* a UK company adding UK/EU users to a marketing list with no stated lawful basis is UK GDPR exposure, and a trust problem with exactly the audience that checks.
*Fix:* one line under Send ("We'll only use this to reply.") — or, if the waitlist does add them to a list, say that instead. Plus a `/privacy` page linked in the footer.
*Suggested command:* `/impeccable harden`

**[P1] If the inline script fails, everything below the hero is blank — including the form.**
All 15 `.reveal` blocks are `opacity: 0` until the IntersectionObserver runs; verified with JavaScript disabled, the page renders as hero-only. There is no `<noscript>` fallback.
*Why it matters:* any script error, blocked module, or aggressive privacy extension turns a nine-section site into a single screen with no contact path. The reduced-motion query rescues that specific user, not this failure mode.
*Fix:* default `.reveal` to visible and let the script *add* an `is-animatable` class before observing, so absence of JS degrades to a static page rather than a blank one.
*Suggested command:* `/impeccable harden`

**[P2] Both hero CTAs point away from conversion; the real conversion links are 24px tall.**
"Why we build" (gold primary) and "See what we build" are both in-page jumps — the highest-attention moment offers no conversion path. Measured at 390px: `helix.work →` 88×**24**px, `Join the waitlist →` 128×**24**px, `Start the conversation →` 188×**28**px, `hello@mindlynx.ai` 128×**25**px, brand 124×**31**px, nav links **33**px — all below the 44px minimum. `a[href="https://helix.work"]` carries `rel="noopener"` with **no `target`**, so conversion goal #2 navigates away in the same tab and the `rel` does nothing.
*Fix:* make the hero primary "See what we build" and secondary "Talk to us"; `target="_blank" rel="noopener noreferrer"` on helix.work; 44px min tap height on inline CTAs below 820px.
*Suggested command:* `/impeccable adapt`

**[P2] The typography is unloaded — most of the audience sees a different brand.**
`document.fonts` is empty; there is no `@font-face` and no webfont in the repo. `--serif` resolves Iowan Old Style (macOS only) → Palatino Linotype (Windows) → Georgia. `--sans` requests Inter, installed almost nowhere, falling to the system UI face. On Android Chrome and most Linux the identity renders in Noto Serif with −0.055em tracking tuned for a face the user does not have.
*Fix:* self-host one variable serif (Newsreader / Fraunces / Source Serif 4) and one sans, `font-display: swap`, Latin subset — ~80KB on a page already shipping 466KB of JPEG.
*Suggested command:* `/impeccable typeset`

**[P2] CSS specificity leak: the interlude label renders 4× its intended size.**
`.interlude-strap p` (0-1-1) beats `.section-label` (0-1-0), so `<p class="section-label">MindLynx</p>` renders at **48.96px Iowan serif with −1.47px tracking**, where the same class is 12.16px Inter with +2.07px tracking everywhere else. It is also the cause of the one text-over-photo contrast failure (2.85:1 median against a 3:1 large-text threshold, 64.9% of the backdrop below 3:1).
*Fix:* scope to `.interlude-strap p:not(.section-label)`, or give the strapline its own class.
*Suggested command:* `/impeccable polish`

## Persona Red Flags

**Jordan (confused first-timer).** Presses the gold button because it is gold and lands on a manifesto. Three screens in, still cannot answer "what do they sell?" Reaches Helix, reads "an operating system for work" — abstract — and the three words that would ground it (`SAFE AUTONOMY · GOVERNED BY DEFAULT`) skip past at 1.81:1. Taps `helix.work →` and is navigated off-site in the same tab; the session ends with no way back but the browser button. At the form, the 1.58:1 underlines mean four labels appear to float in black — Jordan must click to discover inputs exist.

**Riley (deliberate stress tester — the exact ICP, and the persona this page loses).** Cmd+F for a name, a number, a repo: nothing. Submits empty → native browser bubble, `aria-invalid` never set. Kills the network → "Something went wrong…" where the address is plain text, not a `mailto:`, and the same string appears for 400, 502, 503 and network drop because the response body is discarded. Clicks "Join the waitlist", sees it pre-selected — good — but nothing says the link changed it, and "Start the conversation" flips it silently. Looks for a privacy policy before typing an email, finds none, does not submit.

**Casey (distracted, one-handed, slow connection).** Downloads 466KB of JPEG with no `srcset`, no WebP/AVIF; the interlude loads eagerly whether reached or not and has no LQIP, so it pops grey. Scrolls 8,156px — 9.7 screens — past two full-screen photos to reach the form. The hamburger is 44×44 (exactly at threshold) in the top-right, the hardest one-handed reach; once open **Escape does not close it** and nav links are 33px. Inline CTAs at 24–28px sit inside body copy, so the thumb hits the paragraph. `.scroll-cue` is `display:none` below 820px, removing the only cue that anything exists below a 100svh hero. After a slow POST the form is replaced by a 342×125 grey box with no focus move — Casey may tap Send on a form that no longer exists.

## Minor Observations

- `role="img"` + descriptive `aria-label` on the hero and interlude makes screen readers announce the photo description *before* the h1. These are decorative mood images; `aria-hidden="true"` is correct.
- No skip link; no `aria-current` on nav.
- At 320px the h1's second line (`your&nbsp;time.`, unbreakable) runs to x=315.2 in a 320px viewport — the right gutter collapses from 24px to 4.8px. Clears at 390px.
- `hero.jpg` is 1672×941 — roughly 1.7× upscaled on the retina displays this audience uses.
- Mobile hero buttons wrap to two rows at unequal widths (184px / ~176px), reading as unresolved.
- The eyebrow wraps after "BRITAIN" on mobile, orphaning "BUILDING IN THE OPEN".
- No `scroll-margin-top`; anchors work only because sections carry 100–150px top padding.
- "Founders Accelerator" and "Have a product in mind?" are the same offer described twice, ~200px apart.
- The hero says "Building in Britain" while both photographs are demonstrably not Britain (a fjord and a tropical beach) — a credibility crack for a brand making sovereignty a pillar.
- `og.jpg` exists but there is no `og:image:width`/`height`, no `og:site_name`, no `twitter:site`.
- Seven h3s sit at one level under "How we give it back." because the "Coming next" and "Partner with us" group labels are `<p>`, not headings — the outline flattens four visual groups into one run.

## Questions to Consider

1. **The thesis is "agents and humans side by side, governed from the first action" — and not one interaction on this page has an agent do anything. What if the contact form *were* Helix?** Type a plain sentence, watch an agent parse it into name/interest/message, then show the governance step: "This will email hello@mindlynx.ai. Approve?" The proof problem and the "what is Helix" problem close simultaneously.
2. **Who is the person behind MindLynx, and why is their name not on this page?** For a pre-launch studio the founder *is* the proof.
3. **If Albion is open source, where is the repo — and if there isn't one yet, why doesn't the page say "first weights, Q4"?**
4. **Two full-bleed photographs cost ~1,700px of scroll and carry twelve words. What replaces them if the rule is "every full-screen moment shows the product or a person who built it"?**
5. **Helix is live. Why does a visitor leave without seeing a single pixel of it?**
6. **Both hero buttons scroll down. If you were allowed one button above the fold, which is it?**
7. **The interest select is pre-set by links 3,000px away but the URL never changes.** What is `mindlynx.ai/?about=albion` worth as a shareable, campaign-taggable link?
