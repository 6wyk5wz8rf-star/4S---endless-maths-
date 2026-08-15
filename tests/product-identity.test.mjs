import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("4S Arithmetic is the single public product identity", async () => {
  const [index, sourceIndex, manifest, publicManifest, pupil, teacher, print, packageSource] = await Promise.all([
    read("../index.html"),
    read("../static-site/index.html"),
    read("../manifest.webmanifest"),
    read("../public/manifest.webmanifest"),
    read("../app/FluencyApp.tsx"),
    read("../app/TeacherTools.tsx"),
    read("../lib/classroom-print.mjs"),
    read("../package.json"),
  ]);

  assert.match(index, /<title>4S Arithmetic<\/title>/);
  assert.match(sourceIndex, /<title>4S Arithmetic<\/title>/);
  assert.deepEqual(JSON.parse(manifest), JSON.parse(publicManifest));
  assert.equal(JSON.parse(manifest).name, "4S Arithmetic");
  assert.equal(JSON.parse(manifest).short_name, "4S Arithmetic");
  assert.equal(JSON.parse(packageSource).name, "4s-arithmetic");
  assert.match(pupil, /className="wordmark"[^>]*><i[^>]*\/>4S Arithmetic/);
  assert.match(teacher, /4S Arithmetic <span>Teacher<\/span>/);
  assert.match(teacher, /title: "4S Arithmetic"/);
  assert.match(print, /input\.title \|\| "4S Arithmetic"/);

  const publicSources = `${index}\n${sourceIndex}\n${manifest}\n${pupil}\n${teacher}\n${print}`;
  for (const retiredName of ["Year 4 Fluency", "Make Fluency comfortable", "Mixed Fluency", "Fluency strip"]) {
    assert.doesNotMatch(publicSources, new RegExp(retiredName), `retired product copy must not remain: ${retiredName}`);
  }
});

test("the reimagined pupil layout keeps compatibility data while removing forced help scrolling", async () => {
  const [pupil, css, globals, publishedCss] = await Promise.all([
    read("../app/FluencyApp.tsx"),
    read("../app/pupil-final.css"),
    read("../app/globals.css"),
    read("../assets/index.css"),
  ]);

  assert.match(pupil, /const STORAGE_KEY = "year4-fluency-preferences-v3"/, "existing pupil data must remain readable");
  assert.match(pupil, /className="question-content"/);
  assert.match(pupil, /className="response-dock response-dock--choice"/);
  assert.doesNotMatch(pupil, /scrollIntoView/, "revealing help must not move the whole classroom canvas");
  assert.match(globals, /--palette-red:\s*#af2e1b/i);
  assert.match(globals, /--palette-orange:\s*#cc6324/i);
  assert.match(globals, /--palette-slate:\s*#3b4b59/i);
  assert.match(globals, /--palette-sand:\s*#bfa07a/i);
  assert.match(globals, /--palette-blush:\s*#d9c3b0/i);
  assert.match(globals, /--accent:\s*#18243d/i);
  assert.match(css, /\.practice-screen\s*\{[^}]*height:\s*100svh[^}]*overflow:\s*hidden/s);
  assert.match(css, /@media \(orientation: landscape\) and \(min-width: 800px\)\s*\{[\s\S]*?\.question-panel:has\(\.response-dock\)[^{]*\{[^}]*grid-template-columns:/s, "landscape practice must separate thinking and response at ordinary desktop and iPad heights");
  assert.doesNotMatch(css, /@media \(orientation: landscape\)[^{]*max-height:\s*900px/, "common 901–1080 px landscape displays must not fall back to the clipped vertical stack");
  assert.match(publishedCss, /@media \(orientation:landscape\) and \(width>=800px\)/, "the published GitHub Pages CSS must contain the unclipped landscape split");
  assert.doesNotMatch(publishedCss, /@media \(orientation:landscape\)[^{]*(?:height<=900px|max-height:900px)/, "the published CSS must not restore the old 900 px cutoff");
  assert.match(css, /\.setup-screen \.wordmark::after\s*\{[^}]*content:\s*"4S"/s, "the 320 px wordmark must retain the product identity");
});

test("Class view opens on the question and keeps every exit readable", async () => {
  const [pupil, globals] = await Promise.all([
    read("../app/FluencyApp.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(pupil, /if \(nextBoardMode\) setControlOpen\(false\)/, "the practice drawer must close before Class view is shown");
  assert.match(pupil, /boardMode && question\.type === "choice"/, "Class view must retain every answer choice");
  assert.match(pupil, /className="board-choice-grid" role="list" aria-label="Answer choices"/);
  assert.match(pupil, /className="pupil-sr-only">Choice \{index \+ 1\}: <\/span>/, "each visible option must retain its number and mathematical text in the accessibility tree");
  assert.doesNotMatch(pupil, /className=\{isRevealedAnswer[^\n]+role="listitem"\s+aria-label=/, "a list-item label must not mask the mathematical choice text");
  for (const match of globals.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selectors, declarations] = match;
    if (!/(?:header-text-button|session-pulse|control-drawer)/.test(selectors)) continue;
    const opacity = declarations.match(/opacity:\s*(0(?:\.\d+)?|1(?:\.0+)?)/)?.[1];
    if (opacity === undefined) continue;
    assert.ok(Number(opacity) >= 0.75, `essential Class/full-screen controls use unsafe opacity ${opacity}: ${selectors.trim()}`);
  }
});

test("teacher navigation keeps complete labels at 320 CSS pixels", async () => {
  const css = await read("../app/teacher.css");
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.teacher-topbar nav \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)[^}]*overflow: visible/s);
  assert.match(css, /\.teacher-topbar nav button \{[^}]*font-size: \.875rem[^}]*min-width: 0[^}]*padding-inline: 0/s);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.teacher-settings-layout > nav \{[^}]*grid-template-columns: 1fr[^}]*overflow: visible/s);
});

test("the restrained visual system uses one burnt accent and honest review states", async () => {
  const [pupilCss, teacherCss, teacher] = await Promise.all([
    read("../app/pupil-final.css"),
    read("../app/teacher.css"),
    read("../app/TeacherTools.tsx"),
  ]);

  assert.match(teacherCss, /--teacher-accent:\s*#18243d/i, "pupil and teacher surfaces must share the dominant indigo action role");
  assert.match(teacherCss, /--teacher-orange:\s*#cc6324/i);
  assert.match(pupilCss, /\.setup-screen \.setup-intro h1\s*\{[^}]*font-size:\s*clamp\(2\.45rem, 3\.4vw, 3\.15rem\)/s, "setup hierarchy must remain legible without a marketing-scale headline");
  assert.match(pupilCss, /\.summary-screen \.summary-actions \.primary-button\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(teacher, /No pupil profiles yet\./);
  assert.match(teacher, /Add pupil profiles\./);
  assert.match(teacher, /No matching profiles\./);
  assert.match(teacher, /No practice yet\./);
  assert.match(teacher, /activeProfiles\.length > 0 && <button type="button" className="teacher-text-button"/);
  assert.doesNotMatch(teacher, /aria-hidden="true">◐</);
});
