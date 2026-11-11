# ARANYA — Himalayan Single-Origin Coffee

A premium, fully-working single-page site for a (fictional) specialty roastery in
Gulmi, Nepal — designed and engineered with the **UI/UX Pro Max** skill
(v2.15.0) as design intelligence: Feature-Rich Showcase pattern, warm OLED dark,
antique-gold palette, Cormorant Garamond / Montserrat / JetBrains Mono triple stack.

Zero runtime dependencies. Static files, deployable anywhere.

## What works (all client-side, persisted in localStorage)

- Product catalogue with live **NPR ⇄ USD** toggle, bag-size selection, roast meters, cup scores
- Basket drawer with quantity steppers, removal, delivery logic (free over Rs 2,500), reservation flow with order references
- **Brew calculator** — method-specific recipes (V60 / AeroPress / French Press / Espresso), live dose → water/yield, temperature, time, grind, ratio meter
- **The Sunday Club** — tier selection, validated join form, member numbers
- FAQ accordion, testimonials, newsletter capture, deep-bookmarked sections
- Full keyboard support: skip link, visible focus rings, Escape closes drawers,
  `prefers-reduced-motion` respected throughout

## Design system

Generated before any UI was written:

```bash
npm run design:system -- "coffee roastery luxury e-commerce single origin" --design-system -p "ARANYA"
npm run design:system -- "premium ecommerce hero storytelling conversion checkout" --domain landing
```

"Liquid Glass" (Apple-style chrome) and the light Swiss palette from the raw
`--design-system` output were evaluated and rejected as off-brief for a heritage
mountain roastery per the skill's verify-and-retry contract; dark luxury +
skeuomorphic texture was adopted instead (see `docs` in the parent repo's
`design-system` entry).

## Disclaimer

ARANYA is a **concept roastery** — a design & engineering study. The coffees,
farm stats, cup scores and contact details are fictional; the craft is real.
Imagery is AI-generated.

## Deploy

Static — Vercel/Netlify/any host. No build step.
