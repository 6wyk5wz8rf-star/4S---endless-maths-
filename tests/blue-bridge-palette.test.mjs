import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const PALETTE = ["#AF2E1B", "#CC6324", "#3B4B59", "#BFA07A", "#D9C3B0"];

const luminance = (hex) => {
  const channels = hex.slice(1).match(/.{2}/g).map((pair) => Number.parseInt(pair, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

test("pupil, teacher and installed surfaces use the exact Blue Bridge palette", async () => {
  const [globals, teacher, manifest, favicon, jotPad] = await Promise.all([
    read("../app/globals.css"),
    read("../app/teacher.css"),
    read("../public/manifest.webmanifest"),
    read("../public/favicon.svg"),
    read("../app/FluencyApp.tsx"),
  ]);

  for (const colour of PALETTE) {
    assert.match(globals, new RegExp(colour, "i"), `pupil tokens must include ${colour}`);
    assert.match(teacher, new RegExp(colour, "i"), `teacher tokens must include ${colour}`);
  }
  assert.equal(JSON.parse(manifest).theme_color, "#F5F1E8");
  assert.equal(JSON.parse(manifest).background_color, "#F5F1E8");
  assert.match(favicon, /#F5F1E8[\s\S]*#18243D[\s\S]*#CC6324/);
  assert.match(jotPad, /strokeStyle = "#18243D"/, "generated pupil marks must use the dominant indigo");
});

test("semantic palette pairings retain readable contrast", () => {
  assert.ok(contrast("#AF2E1B", "#FFFFFF") >= 4.5, "red error roles need readable white labels");
  assert.ok(contrast("#18243D", "#F5F1E8") >= 4.5, "indigo actions need readable off-white labels");
  assert.ok(contrast("#3B4B59", "#FFFFFF") >= 4.5, "slate actions need readable white labels");
  assert.ok(contrast("#3B4B59", "#D9C3B0") >= 4.5, "slate text needs readable blush surfaces");
  assert.ok(contrast("#CC6324", "#111111") >= 4.5, "orange states need dark labels");
  assert.ok(contrast("#A9501E", "#FFFFFF") >= 4.5, "the derived burnt-orange next action needs readable white labels");
});

test("ordinary surfaces stay light while one next action guides in burnt orange", async () => {
  const [globals, pupil, teacher] = await Promise.all([
    read("../app/globals.css"),
    read("../app/pupil-final.css"),
    read("../app/teacher.css"),
  ]);
  assert.match(globals, /--accent:\s*#18243D/i);
  assert.match(globals, /--ink:\s*#3B4B59/i);
  assert.match(globals, /--guide-action:\s*#A9501E/i);
  assert.match(globals, /--paper:\s*#F5F1E8/i);
  assert.match(teacher, /--teacher-accent:\s*#18243D/i);
  assert.match(teacher, /--teacher-ink:\s*#3B4B59/i);
  assert.match(teacher, /--teacher-guide-action:\s*#A9501E/i);
  assert.match(teacher, /\.teacher-primary-button\s*\{[^}]*background:\s*var\(--teacher-guide-action\)/s);
  assert.match(pupil, /\.setup-screen \.setup-actions > \.primary-button\s*\{[^}]*background:\s*var\(--guide-action\)/s);
  assert.match(pupil, /\.setup-screen \.axis input\[type="range"\]::-webkit-slider-thumb\s*\{[^}]*border:\s*3px solid var\(--guide-action\)/s);
  assert.doesNotMatch(pupil, /primary-button[^}]*background:\s*(?:#AF2E1B|var\(--palette-red\))/is);
  assert.match(teacher, /\.teacher-danger-zone button\s*\{[^}]*border:\s*1px solid var\(--teacher-red\)/s);
});

function effectiveDeclaration(stylesheets, selector, property) {
  let value = null;
  for (const stylesheet of stylesheets) {
    for (const match of stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!match[1].split(',').map((part) => part.trim()).includes(selector)) continue;
      for (const declaration of match[2].split(';')) {
        const colon = declaration.indexOf(':');
        if (colon < 0 || declaration.slice(0, colon).trim() !== property) continue;
        value = declaration.slice(colon + 1).trim();
      }
    }
  }
  return value;
}

test("the loaded cascade keeps the light guidance contract effective", async () => {
  const [globals, pupil, teacher] = await Promise.all([
    read("../app/globals.css"),
    read("../app/pupil-final.css"),
    read("../app/teacher.css"),
  ]);
  assert.equal(effectiveDeclaration([globals], ":root", "--ink"), "#3B4B59");
  assert.equal(effectiveDeclaration([globals], ":root", "--guide-action"), "#A9501E");
  assert.equal(effectiveDeclaration([globals, pupil], ".setup-screen .setup-actions > .primary-button", "background"), "var(--guide-action)");
  assert.equal(effectiveDeclaration([globals, pupil], ".setup-screen .setup-actions > .primary-button", "min-height"), "52px");
  assert.equal(effectiveDeclaration([globals, pupil], ".setup-screen .setup-actions > .primary-button", "width"), "auto");
  assert.equal(effectiveDeclaration([teacher], ".teacher-primary-button", "background"), "var(--teacher-guide-action)");
  assert.equal(effectiveDeclaration([teacher], '.teacher-topbar nav button[aria-current="page"]', "background"), "var(--teacher-guide-soft)");
});

test("a resumable session leaves Continue as the only filled next action", async () => {
  const [pupil, app, publishedCss, publishedApp] = await Promise.all([
    read("../app/pupil-final.css"),
    read("../app/FluencyApp.tsx"),
    read("../assets/index.css"),
    read("../assets/app.js"),
  ]);
  assert.match(
    app,
    /className=\{`primary-button\$\{visibleResumeSnapshot \? " new-practice-secondary" : ""\}`\}/,
    "the saved-state branch must explicitly quiet Start new practice",
  );
  assert.equal(
    effectiveDeclaration([pupil], ".setup-screen .setup-actions > .primary-button.new-practice-secondary", "background"),
    "var(--paper-raised)",
  );
  assert.equal(
    effectiveDeclaration([pupil], ".setup-screen .setup-actions > .primary-button.new-practice-secondary", "color"),
    "var(--ink)",
  );
  assert.equal(
    effectiveDeclaration([pupil], ".setup-screen .setup-actions > .primary-button.new-practice-secondary", "box-shadow"),
    "inset 3px 0 0 var(--palette-orange)",
  );
  assert.equal(
    effectiveDeclaration([pupil], ".setup-screen .setup-resume-choice > .primary-button", "background"),
    "var(--guide-action)",
  );
  assert.match(publishedCss, /\.setup-screen \.setup-actions>.primary-button\.new-practice-secondary\{[^}]*background:var\(--paper-raised\)/);
  assert.match(publishedApp, /new-practice-secondary/, "the published application must retain the saved-state branch");
});
