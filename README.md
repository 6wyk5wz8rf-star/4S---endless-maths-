# Year 4 Fluency

[Open the currently published application](https://6wyk5wz8rf-star.github.io/4S---endless-maths-/)

Year 4 Fluency is a calm, browser-based mathematical practice environment for pupils and classrooms. Challenge controls the mathematics. Support independently controls how much mathematical structure is exposed.

The pupil surface remains deliberately small: choose Challenge, choose Support, then Begin. Build 3 adds a separate teacher layer for launching, targeting, reviewing, sharing and printing practice without placing classroom administration in front of pupils.

## Product structure

### Pupil practice

- 95 procedural generator families and more than 300 mathematical structures
- a continuous foundation-to-deep-Year-4 challenge model
- independent, requested, adaptive, guided and modelled support
- Mix, Focus, Quick Fire, Think and My Mix modes
- connected facts, equivalence, derived facts, retrieval spacing and interleaving
- generated number lines, arrays, groups, place-value, fraction and decimal models
- calm retry behaviour, mathematical hints and model-to-near-transfer sequences
- large touch number pad, keyboard entry, optional jotting and quiet session summaries

### Classroom tools

- six restrained starting presets and recent/saved sessions
- a custom session builder with fixed or ranged challenge, support, mode, length and pupil-control permissions
- optional device-local pupil profiles and lightweight groups; Guest remains available
- smartboard questions with staged Hint, Model, Another way, Related question and Reveal controls
- printable A4 practice pages, fluency strips and aligned answer sheets
- reproducible practice links that encode settings and seed, never pupil data
- exact local session resume, including seeded RNG, scheduled retrieval, support and adaptation state
- local evidence separated into accuracy, independence, stability, retrieval and transfer
- transparent evidence states and no more than three evidence-backed recommendations
- CSV summaries, versioned JSON evidence transfer and complete local backups

There are no accounts, rankings, advertisements, external analytics or pupil-data APIs.

## Development

Requires Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

Useful checks:

```sh
npm run typecheck
npm test
npm run audit:math
npm run audit:release
npm run check
```

`npm run audit:release` generates 21,000 digital questions across 21 challenge points and all five modes. It also audits support ladders, challenge ranges, print packs, evidence retention and a 500-question long session.

## Architecture

- `lib/fluency-engine.mjs` owns seeded generation, validation, challenge, retrieval, interleaving and adaptive selection.
- `lib/fluency-build2-families.mjs` contains the expanded mathematical relationship and strategy families.
- `lib/classroom-mastery.mjs` owns classroom schema migration, profiles, presets, evidence, recommendations, import/export and backup logic.
- `lib/classroom-print.mjs` converts the same generated mathematics into printable equivalents.
- `app/FluencyApp.tsx` composes the pupil, profile, smartboard and classroom flows.
- `app/TeacherTools.tsx` contains the separate four-destination teacher interface.
- `scripts/audit-fluency.mjs` and `scripts/audit-build3.mjs` are development-only content harnesses; they are not linked from the product.

Question generation, representation, scaffold, evaluation and feedback remain separate. A generated item carries its family, strand, subskill, difficulty, answer rules, representations, scaffold ladder, relationships and misconception metadata rather than placing mathematical behaviour in UI components.

## Challenge and Support

Challenge is a continuous `0–100` mathematical demand value. Magnitude is only one factor: generators also account for boundary crossing, operation structure, missing information, inverses, abstraction, strategy visibility, working-memory demand, equivalence and transfer. Teacher sessions may use a fixed point or an authoritative range; adaptation never moves outside that range.

Support is separate. It progresses from independent practice through prompts, representations, guided steps and worked models. Repeated success can fade suggested support. Repeated difficulty can make the next useful scaffold more available without lowering Challenge.

## Local data, privacy and retention

The application uses browser `localStorage` for preferences, recent generator history, learning state, optional classroom profiles, saved presets, session summaries and evidence. Data remains on that browser profile unless a teacher deliberately exports it.

- profiles are optional and require only a display label or alias
- the four-digit teacher code prevents accidental local access; it is not account security
- evidence exports omit access codes, jotting and unrelated device information
- practice links contain configuration only, never profile IDs, names or results
- detailed evidence is deduplicated and capped at 4,000 events overall and 1,500 per profile
- malformed older records are migrated or ignored without preventing the app from opening
- replacement restore creates a download backup first where the browser permits it

There is no automatic sync between classroom devices. Evidence from another device must be exported, previewed, explicitly mapped to local profiles, then merged. Similar names are never guessed to be the same pupil.

## Offline and GitHub Pages deployment

The production build uses relative asset paths and a repository-scoped service worker, so it can run inside a GitHub Pages project path rather than only at a domain root. After the first successful load, the app shell and all essential local assets are cached for offline use.

```sh
npm run export:github
```

This command creates the browser build and copies `index.html`, `assets/`, the manifest, icon and service worker into the repository root. GitHub Pages should publish that root from the configured Pages branch. JavaScript runs entirely in the browser; Node.js is only used for development and build verification.

The service worker does not interrupt an active session. When a newer cached build is waiting, the application offers **Update now** or **Later**.

## Browser constraints

- handwriting uses Pointer Events and works best in a modern Safari, Chromium or Firefox browser
- full-screen behaviour depends on the browser and may be restricted on iPadOS
- browser print controls final printer margins and scaling; the built-in preview supplies A4-safe layout and print-specific styles
- clearing site data, private browsing expiry or institutional browser policies can remove local profiles and evidence, so teachers should export backups when the data matters
- a successful local build does not publish the repository; deployment still requires an authorised commit/push and GitHub Pages completion

## Release verification

Automated release checks cover TypeScript, 51 unit/integration tests, a production build, the mathematical continuum, 21,000 Build 3 samples, seeded print packs, evidence import/deduplication, storage migration, exact session snapshots and long-session generation. Physical iPad, printer, VoiceOver and production GitHub Pages checks must be recorded separately when they are actually performed; the repository does not claim those checks from automated tests alone.
