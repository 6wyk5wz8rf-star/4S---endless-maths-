# Year 4 Fluency

A calm, endless arithmetic and mathematical fluency environment for Year 4
children. Challenge controls the mathematics; Support independently controls
how much mathematical structure is exposed.

## Build 1

The Infinite Practice Engine includes:

- a continuous foundation-to-deep-challenge progression
- 50 reusable mathematical question families
- seeded, validated and repetition-aware generation
- independent, prompted, guided, stepped and modelled scaffolding
- numerical, decimal, fraction and multiple-choice answer systems
- calm feedback and adaptive scaffold fading
- local preferences and session summaries with no pupil account
- responsive, touch, keyboard, screen-reader and reduced-motion support
- offline caching and an installable web app manifest

Build 1 deliberately focuses on the mathematical engine and core practice
interaction. Teacher dashboards, assignments and Build 2 modes are not
included.

## Run locally

Requires Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

Open the local URL shown by Vite.

## Verify

```bash
npm run check
```

The automated audit validates all generator families, reproducible randomness,
division and fraction constraints, support adaptation, duplicate suppression,
difficulty progression, 2,200 challenge-level samples and a 5,000-question
endurance session.

## Architecture

- `lib/fluency-engine.mjs` — generation, validation, difficulty, scaffolds and
  seeded session sequencing
- `app/FluencyApp.tsx` — interaction, evaluation, feedback, persistence and
  accessible input
- `app/globals.css` — responsive classroom interface
- `tests/fluency-engine.test.mjs` — mathematical and endurance audits
- `static-site/` — Vite entry point for the deployable application

The GitHub Actions workflow tests the engine, builds the static app and deploys
`pages-dist` to GitHub Pages when changes reach `main`.

## Live preview

[Open Year 4 Fluency](https://year-4-fluency.willmorgandiary.chatgpt.site)
