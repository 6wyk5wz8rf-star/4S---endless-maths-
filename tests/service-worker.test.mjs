import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT_SW = new URL("../sw.js", import.meta.url);
const PUBLIC_SW = new URL("../public/sw.js", import.meta.url);

test("published and source service workers share the same versioned cache contract", async () => {
  const [rootSource, publicSource] = await Promise.all([
    readFile(ROOT_SW, "utf8"),
    readFile(PUBLIC_SW, "utf8"),
  ]);
  assert.equal(rootSource, publicSource, "the checked-in GitHub Pages worker must match the build source");
  assert.match(publicSource, /release-4s-v7/);
  assert.match(publicSource, /new Request\(url, \{ cache: "reload" \}\)/, "a new cache must not be seeded from a stale HTTP cache");
  assert.match(publicSource, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/, "activation may only remove this application's old caches");
  assert.match(publicSource, /request\.mode === "navigate"[\s\S]*fetch\(request\)/, "navigation must try the network before falling back offline");
});
