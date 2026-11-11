# AGENTS.md — Permanent operating rules for this repository

Read this before doing any frontend work in **The Cabinet of Ten Wonders**.
These rules are binding for every agent working on this project (Arena.ai Agent
Mode and any other coding assistant).

## What this repository is

A static, zero-dependency site: ten self-contained exhibits plus a landing
page (`index.html`), shared styles (`assets/style.css`) and shared logic
(`assets/app.js`). There is no framework, no bundler and no npm dependencies
at runtime. `node build.js` copies the site into `dist/` for Vercel.

## 1. UI/UX Pro Max is the default design intelligence

The **UI/UX Pro Max** skill (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill,
v2.15.0) is installed **in this repository**, permanently:

| Location | Used by |
|---|---|
| `.agents/skills/` | Agent Skills standard (Codex, Antigravity, OpenClaw, Arena.ai Agent Mode and compatible agents) |
| `.claude/skills/` | Claude Code |

Installed with `uipro init --ai universal` and `uipro init --ai claude`
(`ui-ux-pro-max-cli@2.15.0`). Python 3 (stdlib only, offline) powers the search.

**Any task that touches UI — a page, component, layout, color, typography,
animation, accessibility, landing page, dashboard, visual review or UI bug —
MUST consult the skill BEFORE writing code.** Do not rely on generic taste or
memory.

### Mandatory workflow

1. **New page / new project / system-wide direction** → generate a design system:
   ```bash
   npm run design:system -- "<product type> <industry> <keywords>" --design-system -p "<Project Name>"
   ```
2. **Targeted concern** (a component, focus states, contrast, empty state…) →
   one explicit domain search (`style`, `color`, `typography`, `ux`, `icons`,
   `chart`, `landing`, `motion`):
   ```bash
   npm run design:system -- "<2–5 terms>" --domain ux
   ```
3. **Stack guidance** → load the stack rules (this repo is plain HTML/CSS, so
   the closest catalog entry is `html-tailwind`; use `react`/`nextjs`/`shadcn`
   when adding those stacks):
   ```bash
   npm run design:system -- "<concern>" --stack html-tailwind
   ```
4. **Verify before using.** Check the returned domain/category and top result.
   If the result is empty or off-topic, retry ONCE with a narrower rewrite or an
   explicit `--domain`/`--stack`. If it still fails, say so and use clearly
   labeled general guidance. **Never persist unverified output.**
5. Apply the result, then run the pre-delivery checklist below.

`npm run design:system` is a thin Node wrapper (`scripts/design-system.mjs`)
around `<skill>/scripts/search.py`; it finds `python3` or `python` on PATH and
passes all arguments through. The skill's full contract lives in
`.agents/skills/ui-ux-pro-max/SKILL.md`.

### Pre-delivery checklist (adapted from the skill)

- [ ] No emoji used as UI icons — inline SVG only (Phosphor/Lucide-style, `currentColor`)
- [ ] `cursor: pointer` on every clickable element
- [ ] Hover states smooth and subtle (150–300 ms)
- [ ] Text contrast ≥ 4.5:1 (AA); large text ≥ 3:1
- [ ] Visible `:focus-visible` ring on every interactive element (no bare `outline: none`)
- [ ] `prefers-reduced-motion` respected (no parallax/scrub, transitions ~0)
- [ ] Responsive at 375 / 768 / 1024 / 1440 px
- [ ] Keyboard operable; dialogs use `role="dialog"` + `aria-modal`; Escape closes; focus returns to trigger
- [ ] Images sized (width/height) to avoid CLS; hero uses `fetchpriority="high"`
- [ ] No layout shift, no overflow at 320 px

## 2. Project design system

`docs/design-system.md` is the canonical design system for this site, generated
from the skill and binding for all frontend work here (dark OLED-museum style,
brass-on-ink palette, Cormorant/Inter/JetBrains Mono triple stack). New work
extends it; don't invent a parallel palette or type scale.

## 3. Functionality is sacred

Visual changes must never sacrifice working behavior, accessibility, or data:

- The exhibits are self-contained files. Do not rewrite an exhibit to make it
  prettier; restyle surgically and only when asked.
- Keep every existing behavior (theatre open/close/Escape, deep links
  `#slug`, localStorage keys, fetch of `data/world.json`, the LOC counter).
- After any change run `npm run build` — it must print `build OK`.
- Sanity-check the landing page (cards render, theatre opens/closes, no console
  errors) before considering UI work done.

## 4. Stack & components

Plain HTML/CSS/JS today — keep it dependency-free for the static site. When a
task adds a React/Next.js app inside this repo, use **shadcn/ui** + the
`.agents/skills/ui-styling/` shadcn references, and Tailwind per
`docs/design-system.md`. No CSS framework for the existing static pages.

## 5. Git & delivery

- Work happens on branch `arena/8b56cbbc-ai1` only; push with
  `git push origin arena/8b56cbbc-ai1`.
- `dist/`, `node_modules/` are gitignored — never commit them.
- Commit `.agents/` and `.claude/` (the installed skill) as-is; do not edit
  skill files to "improve" them — update with `uipro update --ai universal` /
  `--ai claude` instead.
- Do not deploy (Vercel) unless the user explicitly asks.
