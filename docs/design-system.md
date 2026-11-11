# Design System — The Cabinet of Ten Wonders

Established 2026-11-11 using **UI/UX Pro Max v2.15.0** (installed in-repo).
This is the binding visual contract for the site — extend it, never fork it.

Skill provenance (queries executed 2026-11-11, outputs summarized here):

| Query | Command | Verdict used |
|---|---|---|
| Design system | `search.py "museum exhibition immersive gallery dark editorial" --design-system` | Layout pattern (scroll storytelling), delivery checklist adopted; light “Minimalism & Swiss” palette **rejected** — off-brief for a dark museum site |
| Style | `search.py "dark luxury" --domain style` | **Dark Mode (OLED)** + **Skeuomorphism** (grain, depth, brass) adopted |
| Typography | `search.py "editorial serif luxury heritage" --domain typography` | Serif + sans + mono triple stack confirmed (current Cormorant/Inter/JetBrains Mono kept) |
| Color | `search.py "dark mode premium" --domain color` | Luxury/premium dark directions (near-black + gold accent) confirmed brass/gold on ink |
| UX | `search.py "visible focus keyboard reduced motion contrast" --domain ux` | Focus-visible, reduced-motion, focus-not-obscured requirements adopted |

WCAG contrast ratios verified by computation (WCAG 2.x relative luminance) — see §3.

---

## 1. Visual style

**OLED Museum Dark.** A midnight cabinet of curiosities: near-black surfaces,
hairline warm borders, antique brass accents, editorial serif display type,
film grain + vignette for tactile depth. Specific lineage:

- *Dark Mode (OLED)* — deep blacks (`#0a0b0f` / `#0e1016`), eye-friendly,
  gold accents, minimal glow. Risk: low; requires 4.5:1 text, visible focus.
- *Skeuomorphism* — noise/grain texture overlay, realistic depth via layered
  shadows and a single light source from above, tactile press. Used with
  restraint: grain at 3.5% opacity, one brass radial per card on hover.
- *Scroll-Triggered Storytelling* — lobby → collection → epilogue narrative;
  staggered card reveal (IntersectionObserver, ≤120 ms per item). Reading
  order stays complete without JS; reduced-motion renders final state.

**Positioning:** not a startup landing page, not a SaaS dashboard. Quiet,
confident, gallery-grade. Whitespace is curated; ornament (☙ ❧, rules,
small caps) is deliberate and infrequent.

## 2. Color palette

All values are CSS custom properties in `assets/style.css` (`:root`).

| Token | Hex | Role | Contrast on `--ink` |
|---|---|---|---|
| `--ink` | `#0a0b0f` | Page background | — |
| `--ink-2` | `#0e1016` | Elevated background | — |
| `--panel` | `#12141c` | Card surface | — |
| `--panel-2` | `#171a24` | Card surface, hover | — |
| `--line` | `rgba(214,197,164,.14)` | Hairline border | decorative |
| `--line-2` | `rgba(214,197,164,.28)` | Hairline, stronger | decorative |
| `--brass-dim` | `#a98f5c` | Labels, eyebrows, rules (AA on ink) | 6.3:1 |
| `--brass` | `#c9a86a` | Primary accent, links, CTA text | 8.7:1 |
| `--brass-hi` | `#e8cf9a` | Highlighted accent, numerals | 12.9:1 |
| `--brass-faint` | `#fff6e2` | Sheen highlight stop | 16+:1 |
| `--paper` | `#efe9dd` | Primary text | 16.3:1 |
| `--paper-dim` | `#a8a294` | Secondary text | 7.7:1 |
| `--muted` | `#8f897c` | Tertiary text, meta (AA) | 5.7:1 |
| `--hot` | `#e8b37a` | "Worth your attention" tag | 10.5:1 |
| `--danger` | `#e35d5d` | Destructive/errors | ≥4.5:1 on ink |
| `--focus` | `#e8cf9a` | Focus-visible ring | 12.9:1 |

Selection: brass on near-black. `color-scheme: dark` is declared.

Elevation model: one light source (top). Shadow only as
`0 26px 60px -28px rgba(0,0,0,.9)` on hover; hairline borders do the rest.
Radius: 2–3 px surfaces, 100 px for pills only. No glassmorphism, no
multi-stop rainbow gradients, no neon.

## 3. Typography

Triple stack (skill: “Classic Elegant” / “Luxury Serif” direction — serif
display + clean sans body + mono labels):

| Role | Family | Notes |
|---|---|---|
| Display / headings | **Cormorant Garamond** 300–600 + italic | `h1` 46–110 px fluid, line-height .92, tracking −0.02em; `text-wrap: balance` |
| Body / UI | **Inter** 300–600 | 15–18 px, line-height 1.6–1.85 |
| Labels / numerals / tags | **JetBrains Mono** 400–600 | 9.5–11 px, uppercase, tracking .14–.42em; tabular numerals |

Google Fonts (single request, `display=swap`) with system serif/sans
fallbacks — offline still works. Scale: 10.5 eyebrow → 12.5 card body →
14.5 epilogue → 18 lede → 25 card title → 30 metric numeral → clamp()
hero. Never justify; `text-wrap: pretty` for body copy.

## 4. Spacing & layout

- Base unit **4 px**. Scale: 4, 8, 12, 16, 24, 32, 44, 64, 96, 144 (≈12vh rhythm).
- Page shell: `max-width: 1180px`, gutters `28px` (18px ≤640 px).
- Section rhythm: hero 11vh → collection 12vh → epilogue 12vh; footer
  separated by hairline rule.
- Grid: `repeat(auto-fill, minmax(300px, 1fr))`, gap 22 px; single column ≤640 px.
- Breakpoints: **375 / 640 / 768 / 1024 / 1440**. Verify at all five.
- Hero image: intrinsic 1376×768, `fetchpriority="high"`, width/height set (no CLS), Ken Burns 40 s alternate (disabled with reduced motion).

## 5. Components

| Component | Contract |
|---|---|
| Exhibit card (`.card`) | `<a>` plate, `--panel` gradient, hairline `--line`, top row (index `02 / V` mono + tag pill), 54 px SVG glyph in brass, serif title, 2-line blurb, mono CTA that widens letter-spacing on hover. Hover: −5 px lift, border→`--line-2`, brass radial from top, glyph scale 1.11. Focus: `--focus` ring. `role="listitem"` inside `role="list"` grid. |
| Tag pill (`.card-tag`) | Mono uppercase 8.5 px, hairline border pill. `.hot` variant (`--hot`) only for money/privacy exhibits. |
| Scroll cue (`.scroll-cue`) | Pill button, mono uppercase; hover widens tracking + shifts arrow 3 px. |
| Theatre (`#theatre`) | Full-viewport `role="dialog" aria-modal="true"` overlay; 52 px blurred bar (back, serif title with mono numeral, popout icon-button); Escape closes; focus returns to the originating card. |
| Lobby metric | Serif numeral (tabular) over mono uppercase label. |
| Grain / vignette | Fixed overlays, `pointer-events: none`, `aria-hidden="true"`, grain 6 s steps(6) @ .035 opacity, disabled under reduced motion. |
| Iconography | Inline SVG, 1.5 px stroke, round caps/joins, `viewBox="0 0 24 24"`, `fill="none" stroke="currentColor"`, Phosphor/Lucide geometry. **No emoji as icons.** |

## 6. Motion

- Easing: `cubic-bezier(.16,1,.3,1)` (emphasized). Durations: hover 200–300 ms;
  card reveal .5 s with ≤120 ms stagger; sheen 9 s linear loop (display only).
- `prefers-reduced-motion: reduce` → all animations/transitions ≈ 0, grain off,
  Ken Burns off, observer reveal resolves instantly.
- Animate transform/opacity only. Never animate layout properties.

## 7. Accessibility (AA)

- Skip link first in DOM → `#collection`. Landmarks: `header/main/section/footer`.
- `:focus-visible` → `2px solid var(--focus)` + `3px` offset + soft glow; never
  removed without replacement. Theatre bar controls ≥ 32×32 px; primary targets ≥ 44 px tall.
- Contrast: all text ≥ 4.5:1 except large (≥3:1); `--muted` raised from `#6f6a60`
  (3.7:1, fail) to `#8f897c` (5.7:1); `--brass-dim` raised `#8d7448` (4.4:1) → `#a98f5c` (6.3:1).
- Dialog: `role="dialog"`, `aria-modal`, labelled by its title, Escape closes,
  focus restored to trigger on close. Iframe carries `title`.
- `aria-hidden` on decorative overlays; decorative glyphs marked `aria-hidden`.
- Motion: full `prefers-reduced-motion` support. `color-scheme: dark`.

## 8. Do / Don’t (from skill pre-delivery checklist)

**Do:** inline SVG icons · `cursor: pointer` on clickables · 150–300 ms hovers ·
4.5:1 contrast · visible focus · reduced-motion path · verify 375/768/1024/1440 ·
width/height on images · surgical edits only · `npm run build` after changes.

**Don’t:** emoji as icons · generic purple/blue gradients · radius ≫ 3 px on
surfaces · neon glow · cluttered ornament · `outline: none` unowned · motion
without a reduced path · rewrite exhibits for cosmetics · commit `dist/`.

## 9. Extending to React / Next.js / shadcn

If a future surface in this repo adopts React, follow `.agents/skills/ui-styling/`
(shadcn theming + Tailwind customization references) and map this palette to
shadcn CSS variables (`--background`, `--foreground`, `--primary`,
`--accent`, `--muted`, `--border`, `--ring: var(--focus)`). Keep Cormorant for
display, Inter for UI, JetBrains Mono for labels. Query the skill first:
`npm run design:system -- "<need>" --stack shadcn` / `--stack react`.

## 10. Change log

- 2026-11-11 — Skill installed (universal + claude), system verified,
  `#muted`/`#brass-dim` contrast raised to AA, SVG icon set replaced emoji
  glyphs, focus-visible/skip-link/dialog semantics added.
