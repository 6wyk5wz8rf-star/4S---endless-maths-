function errorName(error) {
  if (error && typeof error === "object" && "name" in error) return String(error.name || "StorageError");
  return "StorageError";
}

const CORRUPT_RECORD_PREFIX = "__year4-fluency-corrupt__:";

export function corruptRecordKey(key) {
  return `${CORRUPT_RECORD_PREFIX}${String(key)}`;
}

function preserveCorruptRecord(storage, key, raw) {
  const quarantineKey = corruptRecordKey(key);
  try {
    // Keep the original key untouched so recovery tooling can still inspect it,
    // and retain a second exact copy before the application falls back safely.
    storage.setItem(quarantineKey, raw);
    return { status: "corrupt-quarantined", quarantineKey, quarantineError: null };
  } catch (error) {
    return { status: "corrupt-preserved", quarantineKey: null, quarantineError: errorName(error) };
  }
}

export function resolveStorage(owner = globalThis) {
  try {
    const storage = owner?.localStorage;
    return storage && typeof storage.getItem === "function" ? storage : null;
  } catch {
    return null;
  }
}

export function readStoredJson(storage, keys, fallback = null) {
  const candidates = Array.isArray(keys) ? keys : [keys];
  if (!storage) return { ok: false, found: false, value: fallback, key: null, error: "StorageUnavailable" };
  for (const key of candidates.map(String)) {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch (error) {
      return { ok: false, found: false, value: fallback, key, error: errorName(error) };
    }
    if (raw === null) continue;
    try {
      return { ok: true, found: true, value: JSON.parse(raw), key, error: null };
    } catch {
      return {
        ok: false,
        found: true,
        value: fallback,
        key,
        error: "InvalidJson",
        ...preserveCorruptRecord(storage, key, raw),
      };
    }
  }
  return { ok: true, found: false, value: fallback, key: null, error: null };
}

export function writeStoredJson(storage, key, value) {
  if (!storage) return { ok: false, error: "StorageUnavailable" };
  try {
    storage.setItem(String(key), JSON.stringify(value));
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: errorName(error) };
  }
}

export function removeStoredKeys(storage, keys) {
  if (!storage) return { ok: false, removed: [], failed: Array.isArray(keys) ? keys.map(String) : [String(keys)], error: "StorageUnavailable" };
  const candidates = Array.isArray(keys) ? keys.map(String) : [String(keys)];
  const removed = [];
  const failed = [];
  let lastError = null;
  for (const key of candidates) {
    try {
      storage.removeItem(key);
      removed.push(key);
    } catch (error) {
      failed.push(key);
      lastError = errorName(error);
    }
  }
  return { ok: failed.length === 0, removed, failed, error: lastError };
}
