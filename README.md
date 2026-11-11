# The Cabinet of Ten Wonders

Ten working pieces of software, designed and built in a single sitting by Arena.ai's
Agent Mode. No mockups, no screenshots, no placeholders — every exhibit runs, in your
browser, offline, with zero dependencies.

**Open `index.html`** to walk the collection.

---

## The ten

| # | Exhibit | What it actually does | Why it's here |
|---|---------|-----------------------|---------------|
| I | [The Working Orrery](exhibits/10-orrery/index.html) | Solves Kepler's equation each frame for eight planets from real J2000 orbital elements. Time scrubs ±150 years. | Because the solar system is the most beautiful clock we have. |
| II | [True Size](exhibits/03-truesize/index.html) | 174 real country polygons, decoded from Natural Earth. Drag any country to the equator and its Mercator footprint collapses to true scale. | Every flat map lies. This one shows you by how much. |
| III | [The Dark Forest](exhibits/07-darkforest/index.html) | 4,000 civilisations born at random points over 5 billion years, expanding, hiding, hunting. Two hypotheses, two different endings. | Because a simulation that disagrees with itself is telling you something. |
| IV | [Life Seed](exhibits/04-lifeseed/index.html) | A creature with a genome, an energy budget, a heartbeat, a vestibular system, a memory and a temperament. It flinches when startled. | Because "alive" is a behaviour, not an animation. |
| V | [Nepal in the Palm](exhibits/01-nepal/index.html) | A Devanagari abugida engine (type Roman, get नेपाली), the real Bikram Sambat calendar for BS 2000–2090, and a living Himalaya drawn to Nepal's local time. | Because the person who asked lives in Kathmandu. |
| VI | [The Cartographer's Secret](exhibits/06-cartographer/index.html) | Draw a country from memory; it is scored against the real border by Monte-Carlo IoU and Hausdorff distance, with your history kept on your own device. | Because most of us can name forty countries and draw four. |
| VII | [Rosetta](exhibits/05-decoder/index.html) | 56 languages × 20 concepts = 1,120 real translations. Unsupervised single-linkage clustering on phonetic edit distance rediscovers the language families — 100% purity on the groups it forms. | Because the machine worked out family trees it was never taught. |
| VIII | [The Leak Detector](exhibits/02-leak/index.html) | Paste a CV or a caption and it names what a stranger can infer — and assembles the stalker profile for you to see. 100% local. | Because the most valuable thing you own is what you give away for free. |
| IX | [The Alchemist's Meter](exhibits/08-meter/index.html) | Turns any job description into a defensible price, a schedule, and a sendable proposal with the number on line four. Calibrated to real Nepali market rates. | Because underpricing is the most common way good freelancers fail. |
| X | [The Cabinet Archive](exhibits/09-cabinet/index.html) | The collection auditing itself: fetches all ten files, scans them with a real string-aware HTML/JS parser, compiles every script, and reports failures in red. | Because the tenth wonder should be proof the other nine are real. |

## What "no dependencies" means here

- No build step, no bundler, no package manager, no `node_modules`.
- No API keys, no network requests at runtime.
- Every exhibit is a self-contained file (Nepal and the Archive carry one local `.js`).
- Copy the folder anywhere and it still works. In thirty years it will still work.

The only optional external resource is Google Fonts; every page falls back to system
serif/sans stacks without it.

## Verified

The Archive's scanner was run over all ten exhibits during development:

```
total 419,633 bytes · 4,621 lines
ALL INTACT: true
```

## Design system — UI/UX Pro Max

Every frontend surface in this repository is built and reviewed with
[**UI/UX Pro Max**](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
(v2.15.0), installed permanently in-repo:

- `.agents/skills/` — Agent Skills standard (Arena.ai Agent Mode, Codex,
  Antigravity and compatible agents)
- `.claude/skills/` — Claude Code

The canonical design system produced from it is
[`docs/design-system.md`](docs/design-system.md) (OLED museum-dark, brass on
ink, Cormorant / Inter / JetBrains Mono). `AGENTS.md` makes consulting the
skill mandatory for all future UI work. Query it directly:

```bash
npm run design:system -- "saas dashboard" --design-system   # new direction
npm run design:system -- "focus visible keyboard" --domain ux
```

Update the installed skill with `uipro update --ai universal` and
`uipro update --ai claude`. The runtime site stays dependency-free; the skill
is development tooling and is not copied into `dist/`.

## Built with

Natural Earth 110m country boundaries (public domain) · Bikram Sambat month table
(BS 2000–2090) · IAU J2000 orbital elements · the Monte-Carlo IoU, Web Mercator,
Kepler's equation, normalised edit distance and single-linkage clustering, implemented
from scratch · [UI/UX Pro Max v2.15.0](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) as the design intelligence for every frontend surface (`.agents/skills/`, `.claude/skills/`, `docs/design-system.md`).

---

*Built by Arena.ai · Agent Mode · 10 November 2026*
