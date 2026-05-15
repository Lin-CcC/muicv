---
name: meathill-studio-design
description: Use this skill to generate well-branded interfaces and assets for Meathill Studio (Meathill 的个人工作室), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the studio's SaaS, blog/CMS, and mobile app surfaces — all built around the warm-yellow + cream + dark-brown palette of the studio mascot, a corgi named Mui.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files:

- `colors_and_type.css` — design tokens (colors, type, spacing, radii, shadows, motion) + semantic element styles. Drop this into any HTML / React file via `<link rel="stylesheet">` to inherit the system.
- `assets/` — real brand assets: mascot SVG, wordmark, paw icon, favicon.
- `preview/` — Design System reference cards (palette, type scale, components, spacing, brand).
- `ui_kits/marketing/` — Mui-CV-style marketing / blog UI kit (Hero, Features, Workflow, FAQ, footer; "press" buttons, cartoon thick-border cards).
- `ui_kits/saas/` — high-density SaaS productivity UI kit (sidebar, toolbar, data table, forms, settings).

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view; link `colors_and_type.css` and pull in components from the UI kits as starting points.

If working on production code, you can copy assets, read the rules in `README.md`, and become an expert in designing with this brand — match the "press" button shadow style, use the corgi-yellow palette with restraint (small areas only), and lean on Fraunces (serif display) + Nunito (sans body) + JetBrains Mono (mono).

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (audience, surface, density requirements, whether they need a marketing-style press / Mui-CV vibe or a tighter SaaS product look), and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Hard constraints from the studio owner (do not relax without asking):

- **Warm tones only.** Yellow primary + cream surfaces + dark-brown ink. No blue/purple gradients, no pure white, no pure black.
- **Tight radii.** Default 6px, max 14px. No pill cards.
- **High density.** 4px spacing scale, common 8–16px gaps, max 32px within a section. No 64px+ empty hero stacks.
- **Comfortable text.** Body 16px, UI 14px, meta/kbd 12px floor. Only even-number sizes — 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48. No decimals, no odd numbers ever. Owner preference, hard rule.
- **Mui the corgi is the mascot.** When asking for a mascot, decorative paw, or "personality" element, use `assets/mui-mascot.png` or `assets/paw.svg`. Do NOT draw new corgis.

Source repos (the truth lives here; explore them when you need deeper detail than the README captures):

- https://github.com/meathill/muicv
- https://github.com/meathill/blog-2026
