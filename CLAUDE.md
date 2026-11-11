# CLAUDE.md

Read and follow **[AGENTS.md](./AGENTS.md)** in full — it is the binding
instruction file for this repository.

Short version: **UI/UX Pro Max is the mandatory design intelligence for this
project.** It is installed in-repo at `.claude/skills/ui-ux-pro-max/` (and the
Agent Skills mirror at `.agents/skills/ui-ux-pro-max/`). Before any UI work,
run:

```bash
npm run design:system -- "<2-5 term query>" --design-system   # new page/direction
npm run design:system -- "<concern>" --domain ux               # targeted concern
npm run design:system -- "<concern>" --stack html-tailwind     # stack guidance
```

The canonical project design system is [docs/design-system.md](./docs/design-system.md).
Never sacrifice functionality for visuals; `npm run build` must print `build OK`.
