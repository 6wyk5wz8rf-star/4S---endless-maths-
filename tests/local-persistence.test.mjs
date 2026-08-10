import assert from "node:assert/strict";
import test from "node:test";
import { readStoredJson, removeStoredKeys, resolveStorage, writeStoredJson } from "../lib/local-persistence.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("persistence round-trips zero, negative, decimal, fraction, Unicode and multiline values exactly", () => {
  const storage = memoryStorage();
  const value = { zero: 0, negative: -4, decimal: 0.125, fraction: "3/8", unicode: "□ × ÷ −", lines: "one\ntwo", long: "x".repeat(5_000) };
  assert.deepEqual(writeStoredJson(storage, "state", value), { ok: true, error: null });
  assert.deepEqual(readStoredJson(storage, "state", null).value, value);
});

test("missing and corrupt records recover without throwing or fabricating data", () => {
  const storage = memoryStorage({ corrupt: "{broken", legacy: JSON.stringify({ challenge: 42 }) });
  assert.deepEqual(readStoredJson(storage, "missing", { safe: true }), { ok: true, found: false, value: { safe: true }, key: null, error: null });
  assert.deepEqual(readStoredJson(storage, ["corrupt", "legacy"], { safe: true }), {
    ok: false,
    found: true,
    value: { safe: true },
    key: "corrupt",
    error: "InvalidJson",
    status: "corrupt-quarantined",
    quarantineKey: "__year4-fluency-corrupt__:corrupt",
    quarantineError: null,
  });
  assert.equal(storage.values.get("corrupt"), "{broken", "the original corrupt record must remain byte-for-byte intact");
  assert.equal(storage.values.get("__year4-fluency-corrupt__:corrupt"), "{broken", "a recovery copy must retain the exact raw record");
  assert.deepEqual(readStoredJson(storage, ["absent", "legacy"], null).value, { challenge: 42 });
});

test("corrupt records remain preserved even when quarantine storage is unavailable", () => {
  const storage = memoryStorage({ corrupt: "{still-broken" });
  storage.setItem = () => { throw Object.assign(new Error("full"), { name: "QuotaExceededError" }); };
  const result = readStoredJson(storage, "corrupt", { safe: true });
  assert.equal(result.status, "corrupt-preserved");
  assert.equal(result.quarantineKey, null);
  assert.equal(result.quarantineError, "QuotaExceededError");
  assert.equal(storage.values.get("corrupt"), "{still-broken");
});

test("storage denial and quota failure return honest failure results", () => {
  const deniedOwner = {};
  Object.defineProperty(deniedOwner, "localStorage", { get() { throw Object.assign(new Error("denied"), { name: "SecurityError" }); } });
  assert.equal(resolveStorage(deniedOwner), null);
  const deniedStorage = {
    getItem() { throw Object.assign(new Error("denied"), { name: "SecurityError" }); },
    setItem() { throw Object.assign(new Error("full"), { name: "QuotaExceededError" }); },
    removeItem() { throw Object.assign(new Error("denied"), { name: "SecurityError" }); },
  };
  assert.equal(readStoredJson(deniedStorage, "state", 7).error, "SecurityError");
  assert.deepEqual(writeStoredJson(deniedStorage, "state", {}), { ok: false, error: "QuotaExceededError" });
  const removal = removeStoredKeys(deniedStorage, ["one", "two"]);
  assert.equal(removal.ok, false);
  assert.deepEqual(removal.failed, ["one", "two"]);
});

test("multi-key removal is complete and reports partial failure without hiding it", () => {
  const storage = memoryStorage({ one: "1", two: "2" });
  const originalRemove = storage.removeItem;
  storage.removeItem = (key) => {
    if (key === "two") throw Object.assign(new Error("denied"), { name: "SecurityError" });
    originalRemove(key);
  };
  const result = removeStoredKeys(storage, ["one", "two"]);
  assert.deepEqual(result.removed, ["one"]);
  assert.deepEqual(result.failed, ["two"]);
  assert.equal(storage.values.has("one"), false);
  assert.equal(storage.values.has("two"), true);
});
