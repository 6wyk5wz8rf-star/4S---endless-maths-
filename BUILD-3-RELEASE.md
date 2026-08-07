# Build 3 release report

## Implemented

- Rebuilt the pupil setup, practice and summary layouts around substantially larger mathematics, answer controls, sliders and touch targets.
- Added the separate Start, Build, Review and Settings teacher area.
- Added six classroom presets, custom and ranged sessions, saved/recent sessions, profile and group management, smartboard teaching controls, practice links and reproducible seeds.
- Added device-local evidence with five distinct lenses, cautious evidence states, misconception thresholds and at most three transparent recommendations.
- Added print practice, answer sheets, CSV summaries, versioned evidence transfer and complete backup/restore workflows.
- Added schema migration, capped event retention, safe service-worker updates and GitHub Pages-relative paths.

## Weaknesses repaired

- Removed the pupil screen's wide split layout and excessive dead space.
- Increased mathematics, numerals, keypad controls, slider handles and important labels at iPad and smartboard sizes.
- Replaced the clickable logo and unexplained ellipsis with explicit **Finish** and **Settings** controls; labels now state what every header action does.
- Labelled the optional **Mode** and **Quick start** areas directly, simplified the setup instruction to match the two controls, and changed the keypad backspace to the familiar delete symbol.
- Removed the primary-button drop shadow and the boxed summary cards. Session evidence now reads as one quiet, ruled row rather than a dashboard of floating panels.
- Kept the Teacher entry discoverable at narrow widths while removing nonessential footer copy, and raised remaining mathematical-model labels to a practical iPad reading size.
- Removed nonessential pupil question metadata and added content-aware equation sizing, so short calculations dominate while longer comparisons and mathematical statements remain balanced and readable.
- Added a short-landscape response layout so the Check action remains visible without shrinking the keypad.
- Added a deterministic generator-family sweep so narrow Quick Fire and Focus sessions cannot exhaust their valid variations while still suppressing immediate duplicates.
- Kept teacher-set challenge ranges authoritative during adaptive selection.
- Made teacher subskill, retrieval, strategy, connected-sequence, near-transfer, adaptation and representation controls alter the underlying engine rather than acting as decorative settings.
- Made same-sequence sessions independent of response patterns and added JSON-safe engine snapshots so interrupted practice resumes from the exact generator, retrieval and adaptation state.
- Corrected descending-sequence models so a negative step is never rendered as a number-line endpoint.

## Automated verification completed

- TypeScript compilation: passed.
- Unit/integration suite: 51 passed.
- Build 3 audit: 21,000 digital questions across 21 challenge values and five modes; 95 families and nine strands encountered.
- Print audit: 150 seeded questions with aligned answers and printable substitutions.
- Evidence audit: 4,500 synthetic events compacted to the configured 4,000-event cap; duplicate-safe import and profile mapping covered by tests.
- Long-session audit: 500 consecutive questions generated without exhaustion; measured generation time is printed by the audit command.
- Production Vite build: verified by `npm run check` before release hand-off.

## Final Rams-style interaction audit

Every pupil-facing element was reviewed against purpose, immediacy and honesty. The resulting setup remains Challenge, Support and Begin; optional modes and presets are visibly named but subordinate. Practice keeps the equation as the visual centre, uses explicit actions rather than icon riddles, and reveals adjustment, support and classroom controls only where they are useful. Decorative shadows, nested cards, duplicated metadata and hidden action semantics were removed. The teacher layer remains separate and uses the same four destinations: Start, Build, Review and Settings.

## Checks requiring a real deployment or physical device

- Production GitHub Pages availability, cache update and offline relaunch after Build 3 is published.
- Physical iPad portrait/landscape and iPadOS full-screen behaviour.
- VoiceOver and other assistive-technology certification.
- Actual A4 printer output and printer-driver scaling.
- Visibility from the back of a real classroom.

These items remain explicit release checks; they are not represented as completed by local automated tests.
