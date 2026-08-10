# 4S Arithmetic ultimate release certification

This document is the functionality ledger, issue register and evidence record for the reimagined `4S Arithmetic` release candidate built from the current remote default branch.

## Source-of-truth baseline

- Repository: `6wyk5wz8rf-star/4S---endless-maths-`
- Remote default branch: `main`
- Default-branch baseline: `92161581c5957293d65e7682bad4a83a364797d3`
- Candidate branch: `release/4s-arithmetic-reimagined`
- Candidate commit/tree: assigned after the exact certified tree is committed
- Live application: `https://6wyk5wz8rf-star.github.io/4S---endless-maths-/`
- Active Pages deployment source observed at baseline: repository root on `release/build-3-rams-final`
- Active Pages source commit observed at candidate start: `92161581c5957293d65e7682bad4a83a364797d3`
- Live-baseline verification: the public application byte-matched the active Pages source before this redesign; post-merge hashes and the critical live workflow remain mandatory publication gates

## Functionality ledger

| Surface | Reachable capability and intended outcome | State or input contract |
| --- | --- | --- |
| Pupil setup | Choose Challenge, choose Help, Start | Both sliders retain independent `0-100` values; setup remains the default first-run route |
| Setup header | Choose an optional local profile, enter/exit Full screen, open Settings | Full screen is always labelled; Guest remains available; no hover-only route |
| Practice options | Select Mix, Focus, Quick Fire, Think or My Mix; optionally select a focus; use four quick starts | Advanced choices remain behind one labelled disclosure and cannot invalidate the selected challenge |
| Shared practice | Decode a configuration-only URL, inspect its summary, Begin or return to settings | No profile, name, evidence or note may appear in a shared URL |
| Pupil practice | Read one generated question, inspect any prompt visual, enter a numeric/decimal/fraction answer or choose an option, Check, retry and advance | Question, answer, scaffold, model and representation must agree; selected challenge remains authoritative |
| Mathematical generation | Generate questions across the complete family registry, including estimation, bonds, doubling/halving, sequences, fractions, decimals, comparison and error-spotting | The displayed prompt, exact answer, metadata, steps and visual model preserve the same mathematical meaning; an unknown is never exposed by its representation |
| Practice help | Reveal Hint, Picture, Steps and Worked example progressively; hide help; reveal Another way | Help changes structure exposure, never mathematical challenge; only valid stages appear |
| Practice utilities | Open Jot, undo/erase/clear temporary ink, adjust allowed practice settings, enter Class view, open Settings, Finish | Jotting remains temporary; locked teacher settings remain visible and honest; every temporary mode has an exit |
| Number entry | Touch keypad, hardware digits, decimal point, fraction separator, delete and Enter | Only answer-compatible keys appear; incomplete answers cannot be submitted; button focus must not block later hardware entry |
| Class view | Enter/exit Class view, use Full screen, reveal stages/answer, show a Worked example or Another way, create a Related question, Jot, show class prompts, move Next or Finish | Class questions do not create individual pupil evidence; exits remain labelled; keyboard shortcuts mirror controls |
| Keyboard shortcuts | Practice number entry; class-view Space, N, H, M, A, J, F and Escape | Shortcuts do not fire while typing or while a conflicting dialog is open |
| Session summary | Distinguish pupil practice, class practice and mixed use; practise/teach again or Finish | Summary evidence distinguishes first-try independent, retry, supported and modelled success without ranking |
| Pupil settings dialog | Larger maths, stronger contrast, reduced motion, larger buttons, fewer details, reset pupil settings | Modal focus is trapped and restored; reset clears the active engine, active-session record, learning/history records and their recovery copies so removed state cannot reappear |
| Profile picker | Search when needed, choose Guest or one active profile | Archived profiles are excluded; changing identity does not leak another pupil's unfinished state |
| Teacher access | Configure or enter a four-digit local code, or continue without one when first configuring | Code is explicitly local convenience, not account security; incorrect input is announced |
| Teacher Start | Choose whole-class/Guest, a group or one pupil; launch six built-in presets, saved presets or recent sessions | Group practice creates no individual evidence; presets preserve complete session configuration |
| Teacher Build | Configure focus/subskill, fixed/ranged challenge, support, length, mode, retrieval, strategy, connected sequence, near transfer, representation frequency, pupil permissions and reproducible seed | Every visible setting must affect engine behaviour or honest presentation; fixed/ranged challenge limits remain authoritative |
| Teacher Review | Filter profiles/evidence, inspect five evidence lenses, recommendations, misconception patterns and notes; launch follow-up | Evidence distinguishes supported from independent success and never claims mastery from inadequate samples |
| Teacher Settings | Accessibility, profile privacy, profiles/groups, teacher code, data management and version | Device-local limitations remain explicit; destructive actions require specific confirmation |
| Teacher dialogs | Add profiles, create group, save/edit preset, create practice link, preview print | Native modal semantics, labelled headings, focus containment/restoration and Escape/close operation; blank required profile and preset names cannot be submitted |
| Print | A4 or practice strip; 5/10/15/20/30 questions where supported; portrait/landscape; bounded title; name/date; colour/monochrome; answer sheet | Printed questions retain instructions, every answer choice and conservative versions of supported models; unknown markers stay concealed; no missing schema field is replaced with invented mathematics; orientation changes the real `@page`; question and answer sheets paginate separately; UI is absent from paper |
| Export/import | CSV summary, versioned evidence JSON, evidence import with explicit profile mapping | Imported content is schema-validated and capped at 5 MB; profile identity is never guessed; CSV cells beginning with spreadsheet formula characters, including after leading whitespace, are neutralised |
| Complete backup/restore | Export and restore classroom data plus preferences, learning state, generator history, unfinished practice and last summary; merge or replace | Replacement first offers a safety backup; complete application data is restored only in Replace mode; Merge preserves device-specific application state; legacy replacement resets omitted state instead of leaking current values; local teacher code and unrecognised/unsafe fields are excluded |
| Persistence | Preferences, learning state, generator history, classroom data, active session and last summary | First load is safe; storage denial/quota failure is reported honestly; corrupt bytes remain untouched and receive an exact quarantine copy where storage permits; Guest, one-pupil and group sessions restore typed answers, selected choices, feedback and help state |
| Multi-tab persistence | Reconcile classroom changes received through browser storage events | Profiles, groups, presets, sessions, notes, events, recent-session references and settings are unioned deterministically and idempotently instead of accepting a last-writer data loss |
| Service worker | Install the repository-scoped app shell, continue offline, announce a waiting update and activate it on request | A new version seeds its cache with reload semantics rather than stale HTTP-cache responses; only this application's superseded caches are removed; mixed-version assets are prevented |
| Accessibility semantics | Navigate setup, practice, summary, teacher tools, dialogs, number pad, mode choices and mathematical visuals with assistive technology and keyboard focus | Each screen has a main landmark; route/question changes receive deliberate focus; named groups use valid roles; fractions and meaningful visuals expose their values; dialogs are labelled and restore opener focus; empty Jot actions are honestly disabled |
| Responsive states | Phone, tablet, iPad portrait/landscape, laptop, desktop and classroom display; zoom, reduced motion and full screen | No clipped labels, overlap, hidden exits or essential controls below 44 CSS pixels; `Full screen`, `Settings` and `Pupil view` remain readable labels at narrow widths |

Supported mathematical visuals inventoried in the question contract: place value, base ten, array, partition, equal groups, counters, ten frame, bead string, part-whole, multiplication rectangle, fraction strip, bar model, hundred grid, number line, relationship and worked example.

## Baseline issue register

The repair state below reflects the final pre-publication source and rendered gates. Publication identifiers remain pending until this tested tree is committed and merged.

| Severity | Finding | Release state |
| --- | --- | --- |
| P1 | The public product identity was fragmented across “Year 4”, “Fluency” and browser/PWA metadata instead of one clear name | Repaired: all public product surfaces, exports and default print titles use `4S Arithmetic`; legacy internal storage/cache identifiers remain unchanged for compatibility |
| P1 | An undefined font variable invalidated the screen font stack, causing a hard-to-read browser serif fallback | Repaired at the typography source; rendered setup, practice and teacher surfaces use the intended system sans stack |
| P1 | Tablet/laptop practice stacked the question, help and response vertically, then forced scrolling that separated the calculation from the keypad | Repaired with one question-content/response-dock composition; 1024×768 and 1180×820 complete every help stage without page scrolling |
| P1 | The reported `14 × 7 + 58` item displayed an unrelated 7–14 number line and a generic worked model | Repaired: the picture and steps now preserve `14 × 7 = 98 → 98 + 58 = □`, and the worked example completes the active calculation as 156 |
| P1 | Class view dimmed essential exits/status, could carry an open setup drawer over the equation, omitted answer choices, and clipped the revealed numeric action row at 1920×1080 | Repaired; independent numeric/choice stage and reveal matrices at phone, tablet, desktop and classroom-display sizes passed with all labelled exits/actions reachable |
| P2 | Large-screen setup spacing left Practice options and Teacher tools below the fold despite ample width | Repaired; the complete setup surface fits 1024×768, 1180×820, 1366×768, 1440×900 and 1920×1080 without page scrolling |
| P1 | Estimation models could display unrelated arithmetic instead of the active question's estimation steps | Repaired; deterministic mathematics corpus passed |
| P1 | Twenty-bond ten-frames did not preserve the complete known addend, and double/half models either omitted the known whole or risked labelling the answer | Repaired; deterministic mathematics corpus passed |
| P1 | Missing-whole fraction bars and sequence number lines could expose the value the pupil was meant to supply | Repaired; deterministic mathematics corpus passed |
| P1 | Tens/ones recall wording, equivalent-to-half metadata, decimal models, near-round product comparisons and worked-error corrections could disagree with the generated mathematical contract | Repaired; deterministic mathematics corpus passed |
| P1 | Print preview dropped all answer choices from generated multiple-choice questions | Repaired; source and rendered preview passed |
| P1 | Guided choice questions could lose their choice contract, and missing-fraction representations could expose the value the pupil was meant to supply | Repaired; deterministic source cases and rendered question-sheet inspection passed |
| P1 | Printed number lines could reveal the hidden answer, while group, multiplication-rectangle and place-value transformations could fabricate defaults or omit source semantics | Repaired; source and rendered preview passed |
| P1 | Several supported live visual families lacked a conservative printable view model | Repaired; source and rendered preview passed |
| P1 | The orientation selector changed preview geometry without emitting the corresponding browser `@page` size | Repaired; A4 portrait/landscape dimensions verified |
| P1 | Fluency-strip answers could be clipped within a fixed 99 mm sheet; answer content and long/dense questions lacked safe pagination and wrapping contracts | Repaired; final portrait, landscape and strip PDFs passed rendered inspection |
| P1 | Direct local-storage reads/writes/removals could throw under denial or quota exhaustion without honest user feedback | Repaired; denial and corrupt-state browser cases passed |
| P1 | Active-session persistence excluded Guest/group sessions and failed to restore typed answers, selected choices, feedback, misconception and progressive-help state | Repaired; Guest exact-resume browser case and source suite passed |
| P1 | Reset removed stored keys without clearing the active engine or active-session/recovery records, allowing supposedly cleared state to return | Repaired; source suite passed |
| P1 | Concurrent tabs used last-writer-wins classroom persistence and could discard durable profiles, groups, presets, sessions, notes or evidence | Repaired; deterministic/idempotent merge test passed |
| P1 | “Complete backup” omitted preferences, learning/adaptation state, generator history, active practice and the last summary; legacy Replace could retain state absent from the backup | Repaired; complete/legacy restore tests passed |
| P1 | Corrupt JSON fell back silently without preserving an exact recovery record, and storage failure paths were not distinguishable from successful saves | Repaired; exact quarantine and warning browser cases passed |
| P1 | A newly versioned service-worker cache could be seeded from stale HTTP-cache entries, producing a mixed application shell | Repaired; worker contract and offline controlled reload passed |
| P1 | CSV export allowed leading `=`, `+`, `-` or `@` content to be interpreted as a spreadsheet formula | Repaired; source suite passed |
| P1 | SPA screen/question transitions and native dialogs did not provide a complete focus-movement and opener-restoration contract for keyboard and assistive-technology use | Repaired; rendered focus checks and Axe scan passed |
| P2 | Generic containers carried names without supporting roles, mathematical fractions/visuals exposed incomplete alternatives, and setup/practice/summary lacked one explicit focusable main landmark each | Repaired; source contract and Axe scan passed |
| P2 | Quiet text, empty-answer cues and interface borders had weak contrast; disabled controls relied on low opacity | Repaired; contrast contract and rendered inspection passed |
| P2 | Narrow layouts replaced readable `Settings`/`Full screen` actions with cryptic symbols or suppressed the teacher exit label | Repaired; 320 CSS-pixel and responsive checks passed |
| P2 | Jot Undo/Clear appeared actionable when no stroke existed, and profile/preset forms accepted or appeared to accept blank submissions | Repaired; disabled/validation browser checks passed |
| P2 | Import paths had no explicit file-size bound and print titles had no practical length bound | Repaired; source and rendered title checks passed |
| P2 | Historical style generations competed in the cascade; the authoritative pupil layer contained a second late override pass | Repaired; CSS release contract passed |
| P1 | Exact-height A4 sheets combined with the final question/answer boundary emitted an unintended phantom/partial landscape page | Repaired at the pagination root: A4 sheets no longer use exact height and answer separation is applied deterministically; all final PDF pages passed |
| P1 | The A4 question-to-answer page break remained active with answers disabled, producing a blank final page | Repaired with an explicit answer-sheet pagination state; the answers-off artifact is exactly three nonblank question pages |
| P2 | Production JavaScript bundle exceeds Vite's 500 kB advisory threshold | Non-blocking debt: 526.44 kB uncompressed / 150.86 kB gzip; functional, performance and production-build gates passed |

## Release evidence — latest consolidated gate

Release status: **PASS — all pre-publication gates passed on the frozen source after the final Class-view repair.** Commit, remote publication, merge, deployment and live verification remain separate mandatory gates.

### Source and corpus

- Working branch: `release/4s-arithmetic-reimagined`
- Candidate ancestry: `92161581c5957293d65e7682bad4a83a364797d3`; exact containing release commit: pending publication
- Pull request: pending publication
- Merge/default-branch commit: pending publication
- TypeScript check: pass
- Production build: pass
- Source tests: **110/110 passed after the final source change**
- Mathematics audit: `npm run audit:math -- --count 20` passed
- Release audit: **21,000 digital questions; 95 families; 9 strands; 21,000 representations; 150 print questions; 4,000 retained evidence records; 500-question sustained session**
- Production dependency audit: **0 vulnerabilities** (`npm audit --omit=dev`)
- Final production bundle: application JavaScript **526.44 kB / 150.86 kB gzip**; CSS **137.55 kB / 23.66 kB gzip**. The JavaScript chunk-size warning is recorded as non-blocking P2 debt.

### Rendered browser, responsive and accessibility evidence

- Engine: Sparticuz Chromium through Puppeteer against the local production build
- Standard responsive/human-factors matrix: **25/25 rendered states passed; 0 overflow, clipping, target-size or dialog-boundary failures**
- Coverage: setup and practice at 320×568, 390×844, 430×932, 768×1024, 820×1180, 1024×768, 1180×820, 1366×768, 1440×900 and 1920×1080; 720×450 at 2× scale for 200% zoom; plus rotation, settings-dialog and narrow profile states
- Full-screen exit remained visible; orientation change preserved the active question; setup and question transitions received the intended focus; blank profile creation remained disabled; the narrow profile control retained its accessible name
- Independent expanded matrix: **240 rendered screenshots** across eight required viewports, covering numeric and choice pupil stages 0–4; numeric and choice Class stages 0–4 plus answer reveal; setup, settings, summary and all teacher destinations. The exact reported 1920×1080 numeric reveal had no horizontal/vertical scroll and no clipped or off-viewport action.
- Automated accessibility: **126 independent Axe A/AA scans plus 9 standard scans; 0 violations**. Focused accessibility-tree inspection preserved the complete four-choice mathematical names and announced only the revealed correct choice as `correct answer`.
- Representative screenshots: `/tmp/4s-independent-audit/*` and `/tmp/year4-release-evidence/*`

### Persistence, recovery, offline and runtime evidence

- Guest unfinished response round-trip: saved `1`, restored `1`, exact match; Continue was reachable after reload
- Corrupt storage: the exact raw value `{broken` remained quarantined, the recovery warning appeared and the application stayed usable
- Storage denial: an honest non-destructive warning appeared and practice remained usable
- Multi-tab reconciliation, complete backup/replace, legacy restore, reset and exact boundary-value round trips passed in the 110-test source suite
- Offline: service worker controlled the production page; a network-disabled reload completed and the application remained visible and usable
- Runtime/network: **0 console errors; 0 page errors; 0 failed required requests**
- Final local production performance sample: Largest Contentful Paint **44 ms**, Cumulative Layout Shift **0**, DOMContentLoaded/load **24.1 ms**, with **844 ms** total harness observation time

### Print and PDF evidence

- Browser print structure: 30 questions, including 15 multiple-choice questions; one separate answer sheet; guided choices and missing-fraction answers remained concealed on question sheets; no title overflow; print-only page style cleaned up after generation
- Practice strip: both five-question sheets had equal client/scroll height with no overflow in screen and print media
- Pagination root repair: A4 sheets no longer impose an exact content height; the question-to-answer break is applied only when an answer sheet exists, and the answers-off question sheet suppresses trailing fragmented whitespace
- A4 portrait: 4 pages at 595.92×841.92 pt; rendered-page inspection passed
- A4 landscape: 5 pages at 841.92×595.92 pt; rendered-page inspection passed
- Strip artifact: 2 A4 carrier pages; rendered-page inspection passed
- Answers-off A4 portrait: 3 question-only pages at 595.92×841.92 pt; no blank page or answer sheet
- All **14 final PDF pages** were rendered at **150 dpi** and inspected after the final source change: every page was nonblank, with no overlap, clipping, orphaned content or unintended answer exposure; the one scaled preview ambiguity was confirmed legible at 300 dpi
- Evidence artifacts: `/tmp/year4-release-evidence/print-a4-portrait.pdf`, `/tmp/year4-release-evidence/print-a4-landscape.pdf`, `/tmp/year4-release-evidence/print-strip.pdf`, `/tmp/year4-release-evidence/print-a4-no-answers.pdf` and rendered page images beneath `/tmp/year4-release-evidence/`

### Publication and live verification

- Current live Pages source observed at candidate start: `release/build-3-rams-final` at `92161581c5957293d65e7682bad4a83a364797d3`
- Candidate release commit, pull request, merge SHA and production asset checksums: pending publication
- Candidate live smoke test and cache-bypassing link: pending publication
