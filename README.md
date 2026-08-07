# Year 4 Fluency

[Open Year 4 Fluency](https://6wyk5wz8rf-star.github.io/4S---endless-maths-/)

A calm, endless mathematical fluency environment for Year 4 children. Challenge controls the mathematics. Support independently controls how much of the mathematical structure is exposed.

Build 2 adds a deeper fluency intelligence layer while preserving the same quiet pupil experience:

- 95 procedural generator families and more than 300 mathematical structures
- connected facts, equivalence, derived facts and efficient strategy choices
- spaced retrieval, interleaving and adaptation inside the selected challenge band
- local, gradual mastery signals with confidence decay
- Mix, Focus, Quick Fire, Think and optional My Mix practice
- number lines, arrays, groups, place value, fraction and decimal models
- model → near-transfer scaffold sequences
- temporary touch jotting and a restrained smartboard mode
- responsive, keyboard, touch, screen-reader and reduced-motion support
- no pupil account, login, server or tracking

The repository root contains a complete static browser build. GitHub Pages can therefore open the app directly without asking a teacher or pupil to install anything. JavaScript runs in the browser; Node.js is only part of the automated development and test workflow.

## Development

```sh
npm ci
npm test
npm run audit:math
npm run export:github
```

`npm run export:github` rebuilds the static app and synchronises it to the repository root. GitHub Pages publishes that browser-ready root from the repository's Pages source branch.
