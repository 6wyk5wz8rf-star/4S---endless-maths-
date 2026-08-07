/**
 * Year 4 Fluency classroom data and evidence core.
 *
 * This module is deliberately free of browser APIs. UI code owns persistence and
 * file handling; this file owns validation, migration, evidence and safe merges.
 */

export const CLASSROOM_SCHEMA_VERSION = 3;
export const CLASSROOM_PACKAGE_TYPE = "year-4-fluency-classroom-backup";
export const EVIDENCE_PACKAGE_TYPE = "year-4-fluency-evidence";
export const DEFAULT_EVENT_CAP = 4_000;
export const DEFAULT_PROFILE_EVENT_CAP = 1_500;

const MODES = new Set(["mix", "focus", "quick", "think", "my-mix"]);
const SUPPORT_MODES = new Set(["independent", "available", "adaptive", "guided", "modelled"]);
const LENGTH_KINDS = new Set(["questions", "minutes", "open"]);
const GROUP_TYPES = new Set(["class", "table", "focus", "temporary"]);
const NOTE_SUBJECTS = new Set(["profile", "group", "session"]);
const PUPIL_CONTROL_STATES = new Set(["unlocked", "limited", "locked"]);
const PROFILE_PRIVACY = new Set(["full", "first-initial", "initials", "alias"]);
const EVIDENCE_STATES = new Set([
  "Not yet seen",
  "Beginning",
  "Building",
  "Secure recently",
  "Ready for retrieval",
  "Support still useful",
]);

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

function cleanText(value, fallback = "", max = 120) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const result = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return result.slice(0, max) || fallback;
}

function cleanId(value, fallback = "") {
  const result = cleanText(value, "", 100).replace(/[^a-zA-Z0-9_.:-]/g, "-");
  return result || fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function isoDate(value, fallback = null) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function uniqueStrings(values, max = 100) {
  return [...new Set(asArray(values).map((value) => cleanText(value, "", 100)).filter(Boolean))].slice(0, max);
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function fallbackId(prefix, value, index = 0) {
  return `${prefix}-${hashText(`${value}|${index}`)}`;
}

function uniqueById(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function normaliseChallenge(value) {
  if (value && typeof value === "object") {
    if (value.kind === "range" || value.min !== undefined || value.max !== undefined) {
      const min = clamp(Math.round(finiteNumber(value.min, value.value ?? 50)), 0, 100);
      const max = clamp(Math.round(finiteNumber(value.max, min)), min, 100);
      return { kind: min === max ? "fixed" : "range", min, max, value: Math.round((min + max) / 2) };
    }
    const point = clamp(Math.round(finiteNumber(value.value, 50)), 0, 100);
    return { kind: "fixed", min: point, max: point, value: point };
  }
  const point = clamp(Math.round(finiteNumber(value, 50)), 0, 100);
  return { kind: "fixed", min: point, max: point, value: point };
}

function normaliseSupport(value) {
  const source = asObject(value);
  const numeric = typeof value === "number" ? value : source.value;
  const amount = clamp(Math.round(finiteNumber(numeric, 25)), 0, 100);
  let mode = cleanText(source.mode, "", 30).toLowerCase();
  if (!SUPPORT_MODES.has(mode)) {
    mode = amount <= 2 ? "independent" : amount < 35 ? "available" : amount < 68 ? "adaptive" : amount < 88 ? "guided" : "modelled";
  }
  return { mode, value: amount };
}

function normaliseLength(value) {
  const source = asObject(value);
  let kind = cleanText(source.kind, typeof value === "number" ? "questions" : "open", 20).toLowerCase();
  if (!LENGTH_KINDS.has(kind)) kind = "open";
  if (kind === "open") return { kind: "open", value: null };
  const maximum = kind === "minutes" ? 120 : 500;
  return { kind, value: clamp(Math.round(finiteNumber(source.value ?? value, kind === "minutes" ? 10 : 10)), 1, maximum) };
}

function normalisePupilControl(value) {
  const source = typeof value === "string" ? { state: value } : asObject(value);
  let state = cleanText(source.state, "unlocked", 20).toLowerCase();
  if (!PUPIL_CONTROL_STATES.has(state)) state = "unlocked";
  const min = clamp(Math.round(finiteNumber(source.min, 0)), 0, 100);
  const max = clamp(Math.round(finiteNumber(source.max, 100)), min, 100);
  return { state, min, max };
}

/** Return only the configuration fields that can safely appear in a practice link. */
export function normalisePracticeConfig(value = {}) {
  const source = asObject(value);
  let mode = cleanText(source.mode, "mix", 20).toLowerCase();
  if (!MODES.has(mode)) mode = "mix";
  const focus = cleanText(source.focus, "mixed", 60).toLowerCase();
  const representationFrequency = clamp(finiteNumber(source.representationFrequency, 0.35), 0, 1);
  const seedMode = source.seedMode === "same" ? "same" : "fresh";
  const seed = seedMode === "same" ? cleanText(source.seed, "", 100) || "year-4-fluency" : null;
  return {
    mode,
    focus,
    strands: uniqueStrings(source.strands, 12).map((item) => item.toLowerCase()),
    subskills: uniqueStrings(source.subskills, 40),
    challenge: normaliseChallenge(source.challenge ?? source.challengeValue),
    support: normaliseSupport(source.support ?? source.supportValue),
    adaptation: {
      withinBand: source.adaptation?.withinBand !== false,
      supportFading: source.adaptation?.supportFading !== false,
      retrievalWeight: clamp(finiteNumber(source.adaptation?.retrievalWeight, 0.25), 0, 1),
      connectedSequences: source.adaptation?.connectedSequences !== false,
      nearTransfer: source.adaptation?.nearTransfer !== false,
    },
    length: normaliseLength(source.length),
    representationFrequency,
    permittedFamilies: uniqueStrings(source.permittedFamilies, 150),
    excludedFamilies: uniqueStrings(source.excludedFamilies, 150),
    includeStrategyQuestions: source.includeStrategyQuestions !== false,
    includeWordedQuestions: boolean(source.includeWordedQuestions, false),
    seedMode,
    seed,
    pupilControls: {
      challenge: normalisePupilControl(source.pupilControls?.challenge),
      support: normalisePupilControl(source.pupilControls?.support),
      mode: normalisePupilControl(source.pupilControls?.mode),
      focus: normalisePupilControl(source.pupilControls?.focus),
    },
  };
}

const preset = (id, name, note, config) => ({
  id,
  name,
  note,
  builtIn: true,
  createdAt: null,
  updatedAt: null,
  config: normalisePracticeConfig(config),
});

export const DEFAULT_CLASSROOM_PRESETS = Object.freeze([
  preset("morning-warm-up", "Morning Warm-Up", "Retrieval, relationships and an accessible Year 4 start.", {
    mode: "mix", focus: "mixed", strands: ["number", "place value", "addition", "subtraction", "multiplication", "division"],
    challenge: { kind: "range", min: 34, max: 56 }, support: { mode: "adaptive", value: 38 }, length: { kind: "questions", value: 10 }, representationFrequency: 0.25,
  }),
  preset("year-4-core", "Year 4 Core", "Broad arithmetic and place-value fluency.", {
    mode: "mix", focus: "mixed", strands: ["place value", "addition", "subtraction", "multiplication", "division", "fractions", "decimals"],
    challenge: { kind: "range", min: 46, max: 68 }, support: { mode: "adaptive", value: 32 }, length: { kind: "questions", value: 15 }, representationFrequency: 0.3,
  }),
  preset("foundations", "Foundations", "Essential prerequisite knowledge, presented with dignity.", {
    mode: "mix", focus: "mixed", strands: ["number", "addition", "subtraction", "multiplication", "division", "place value"],
    challenge: { kind: "range", min: 8, max: 34 }, support: { mode: "adaptive", value: 52 }, length: { kind: "questions", value: 10 }, representationFrequency: 0.48,
  }),
  preset("tables-and-division", "Tables and Division", "Facts, inverses, derivation and fact families.", {
    mode: "focus", focus: "tables", strands: ["multiplication", "division"], subskills: ["recall facts", "derived facts", "fact families", "related division"],
    challenge: { kind: "range", min: 32, max: 66 }, support: { mode: "available", value: 26 }, length: { kind: "questions", value: 15 }, representationFrequency: 0.28,
  }),
  preset("fractions-and-decimals", "Fractions and Decimals", "Year 4 fraction and decimal relationships.", {
    mode: "focus", focus: "fractions and decimals", strands: ["fractions", "decimals"],
    challenge: { kind: "range", min: 45, max: 72 }, support: { mode: "adaptive", value: 44 }, length: { kind: "questions", value: 10 }, representationFrequency: 0.55,
  }),
  preset("deep-challenge", "Deep Challenge", "Structure, equivalence and efficient high-level fluency.", {
    mode: "think", focus: "mixed", strands: ["mixed", "equivalence", "multiplication", "division", "addition", "subtraction"],
    challenge: { kind: "range", min: 78, max: 96 }, support: { mode: "available", value: 22 }, length: { kind: "questions", value: 10 }, representationFrequency: 0.25,
  }),
]);

export function normaliseProfile(value, index = 0) {
  const source = asObject(value);
  const label = cleanText(source.label ?? source.displayName ?? source.name, `Pupil ${index + 1}`, 60);
  const id = cleanId(source.id ?? source.profileId, fallbackId("profile", label, index));
  return {
    id,
    label,
    initials: cleanText(source.initials, label.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase(), 4),
    alias: cleanText(source.alias, "", 60),
    symbol: cleanText(source.symbol, ["circle", "square", "triangle", "diamond"][index % 4], 30),
    groupIds: uniqueStrings(source.groupIds ?? source.classGroupIds, 30).map((item) => cleanId(item)).filter(Boolean),
    archived: boolean(source.archived, false),
    createdAt: isoDate(source.createdAt, null),
    updatedAt: isoDate(source.updatedAt, null),
  };
}

export function normaliseGroup(value, index = 0) {
  const source = asObject(value);
  const name = cleanText(source.name, `Group ${index + 1}`, 60);
  const type = GROUP_TYPES.has(source.type) ? source.type : "class";
  return {
    id: cleanId(source.id, fallbackId("group", name, index)),
    name,
    type,
    profileIds: uniqueStrings(source.profileIds, 100).map((item) => cleanId(item)).filter(Boolean),
    createdAt: isoDate(source.createdAt, null),
    updatedAt: isoDate(source.updatedAt, null),
  };
}

export function normalisePreset(value, index = 0) {
  const source = asObject(value);
  const name = cleanText(source.name ?? source.label, `Preset ${index + 1}`, 80);
  return {
    id: cleanId(source.id, fallbackId("preset", name, index)),
    name,
    note: cleanText(source.note, "", 240),
    builtIn: boolean(source.builtIn, false),
    createdAt: isoDate(source.createdAt, null),
    updatedAt: isoDate(source.updatedAt, null),
    config: normalisePracticeConfig(source.config ?? source),
  };
}

export function normaliseSession(value, index = 0) {
  const source = asObject(value);
  const id = cleanId(source.id ?? source.sessionId, fallbackId("session", source.startedAt ?? source.seed ?? "session", index));
  const status = ["active", "complete", "dismissed"].includes(source.status) ? source.status : source.completedAt ? "complete" : "active";
  return {
    id,
    profileIds: uniqueStrings(source.profileIds ?? (source.profileId ? [source.profileId] : []), 100).map((item) => cleanId(item)).filter(Boolean),
    title: cleanText(source.title, "Practice", 100),
    status,
    config: normalisePracticeConfig(source.config ?? source),
    position: Math.max(0, Math.round(finiteNumber(source.position, 0))),
    startedAt: isoDate(source.startedAt ?? source.timestamp, null),
    updatedAt: isoDate(source.updatedAt, null),
    completedAt: isoDate(source.completedAt, null),
    responses: asArray(source.responses).slice(-500).map((response) => ({
      eventId: cleanId(response?.eventId ?? response?.id),
      itemId: cleanId(response?.itemId),
      finalCorrect: boolean(response?.finalCorrect ?? response?.correct, false),
    })).filter((response) => response.eventId || response.itemId),
    adaptationState: asObject(source.adaptationState),
  };
}

export function normaliseNote(value, index = 0) {
  const source = asObject(value);
  const subjectType = NOTE_SUBJECTS.has(source.subjectType) ? source.subjectType : "session";
  const subjectId = cleanId(source.subjectId);
  const text = cleanText(source.text, "", 1_000);
  return {
    id: cleanId(source.id, fallbackId("note", `${subjectType}:${subjectId}:${text}`, index)),
    subjectType,
    subjectId,
    text,
    createdAt: isoDate(source.createdAt, null),
    updatedAt: isoDate(source.updatedAt, null),
  };
}

export function normaliseEvent(value, index = 0) {
  const source = asObject(value);
  const timestamp = isoDate(source.timestamp ?? source.completedAt, null);
  const profileId = cleanId(source.profileId, "guest");
  const family = cleanText(source.family ?? source.generatorFamily, "unknown", 100).toLowerCase();
  const subskill = cleanText(source.subskill, family, 100).toLowerCase();
  const strand = cleanText(source.strand, "mixed", 60).toLowerCase();
  const supportUsed = clamp(Math.round(finiteNumber(source.supportUsed, source.modelUsed ? 100 : 0)), 0, 100);
  const attempts = clamp(Math.round(finiteNumber(source.attempts, source.firstResponseCorrect === false ? 2 : 1)), 1, 20);
  const eventIdSource = `${profileId}|${source.sessionId ?? ""}|${timestamp ?? ""}|${family}|${subskill}|${source.questionSignature ?? source.itemId ?? index}`;
  const challengeValue = source.questionDifficulty ?? source.difficulty;
  let selectedChallengeBand = source.selectedChallengeBand;
  if (Array.isArray(selectedChallengeBand)) selectedChallengeBand = { min: selectedChallengeBand[0], max: selectedChallengeBand[1] };
  selectedChallengeBand = normaliseChallenge(selectedChallengeBand ?? source.selectedChallenge ?? challengeValue);
  return {
    id: cleanId(source.id ?? source.eventId, fallbackId("event", eventIdSource, index)),
    profileId,
    sessionId: cleanId(source.sessionId, "unspecified"),
    timestamp,
    family,
    strand,
    subskill,
    questionDifficulty: clamp(finiteNumber(challengeValue, 50), 0, 100),
    selectedChallengeBand: { min: selectedChallengeBand.min, max: selectedChallengeBand.max },
    supportAvailable: clamp(Math.round(finiteNumber(source.supportAvailable, 0)), 0, 100),
    supportUsed,
    representationShown: cleanText(source.representationShown ?? source.representation, "", 80).toLowerCase(),
    attempts,
    firstResponseCorrect: boolean(source.firstResponseCorrect ?? source.firstTry, attempts === 1 && Boolean(source.finalCorrect ?? source.correct)),
    finalCorrect: boolean(source.finalCorrect ?? source.correct, false),
    misconceptionCode: cleanText(source.misconceptionCode, "", 100).toLowerCase(),
    relatedSequencePosition: Math.max(0, Math.round(finiteNumber(source.relatedSequencePosition, 0))),
    connectionKind: cleanText(source.connectionKind, "", 60).toLowerCase(),
    transfer: boolean(source.transfer, ["near-transfer", "transfer", "related-transfer"].includes(source.connectionKind)),
    questionSignature: cleanText(source.questionSignature ?? source.itemId, `${family}:${subskill}:${index}`, 240),
    sessionSeed: cleanText(source.sessionSeed ?? source.seed, "", 100),
    responseMs: source.responseMs === undefined ? null : clamp(Math.round(finiteNumber(source.responseMs, 0)), 0, 3_600_000),
  };
}

export function normaliseEvents(values, options = {}) {
  const cap = clamp(Math.round(finiteNumber(options.cap, DEFAULT_EVENT_CAP)), 1, 100_000);
  const profileCap = clamp(Math.round(finiteNumber(options.profileCap, DEFAULT_PROFILE_EVENT_CAP)), 1, cap);
  const normalised = uniqueById(asArray(values).map((event, index) => normaliseEvent(event, index)));
  normalised.sort((left, right) => (Date.parse(left.timestamp ?? 0) || 0) - (Date.parse(right.timestamp ?? 0) || 0));
  const perProfile = new Map();
  const keptReversed = [];
  for (let index = normalised.length - 1; index >= 0 && keptReversed.length < cap; index -= 1) {
    const event = normalised[index];
    const count = perProfile.get(event.profileId) ?? 0;
    if (count >= profileCap) continue;
    perProfile.set(event.profileId, count + 1);
    keptReversed.push(event);
  }
  return keptReversed.reverse();
}

function normaliseSettings(value = {}, legacy = {}) {
  const source = asObject(value);
  let privacy = cleanText(source.profilePrivacy, "full", 30).toLowerCase();
  if (!PROFILE_PRIVACY.has(privacy)) privacy = "full";
  return {
    lastChallenge: clamp(Math.round(finiteNumber(source.lastChallenge ?? legacy.challenge, 52)), 0, 100),
    lastSupport: clamp(Math.round(finiteNumber(source.lastSupport ?? legacy.support, 25)), 0, 100),
    largerText: boolean(source.largerText, false),
    highContrast: boolean(source.highContrast, false),
    reducedMotion: boolean(source.reducedMotion, false),
    simplifiedDensity: boolean(source.simplifiedDensity, false),
    largerTouchControls: boolean(source.largerTouchControls, false),
    sound: boolean(source.sound, false),
    noTimedPressure: source.noTimedPressure !== false,
    screenReaderOptimised: boolean(source.screenReaderOptimised, false),
    profilePrivacy: privacy,
    teacherAccessConfigured: boolean(source.teacherAccessConfigured, false),
    teacherPinHash: cleanText(source.teacherPinHash, "", 200),
  };
}

export function createClassroomState(options = {}) {
  const now = isoDate(options.now, null);
  return {
    schemaVersion: CLASSROOM_SCHEMA_VERSION,
    applicationVersion: cleanText(options.applicationVersion, "3", 40),
    profiles: [],
    groups: [],
    presets: clone(DEFAULT_CLASSROOM_PRESETS),
    sessions: [],
    recentSessionIds: [],
    notes: [],
    events: [],
    settings: normaliseSettings(options.settings),
    meta: { createdAt: now, updatedAt: now, lastCompactedAt: null },
  };
}

/** Migrate missing, Build 1/2, partial or v3 data without throwing. */
export function migrateClassroomState(value, options = {}) {
  const source = asObject(value);
  const legacy = asObject(source.preferences ?? source.fluencyPreferences ?? source);
  const defaults = createClassroomState(options);
  const suppliedPresets = asArray(source.presets).map(normalisePreset);
  const builtInIds = new Set(DEFAULT_CLASSROOM_PRESETS.map((item) => item.id));
  const customPresets = suppliedPresets.filter((item) => !builtInIds.has(item.id) && !item.builtIn);
  const profiles = uniqueById(asArray(source.profiles).map(normaliseProfile));
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const groups = uniqueById(asArray(source.groups).map(normaliseGroup)).map((group) => ({
    ...group,
    profileIds: group.profileIds.filter((id) => profileIds.has(id)),
  }));
  const groupIds = new Set(groups.map((group) => group.id));
  for (const profile of profiles) profile.groupIds = profile.groupIds.filter((id) => groupIds.has(id));
  return {
    schemaVersion: CLASSROOM_SCHEMA_VERSION,
    applicationVersion: cleanText(source.applicationVersion, defaults.applicationVersion, 40),
    profiles,
    groups,
    presets: [...clone(DEFAULT_CLASSROOM_PRESETS), ...customPresets],
    sessions: uniqueById(asArray(source.sessions ?? source.recentSessions).map(normaliseSession)).slice(-200),
    recentSessionIds: uniqueStrings(source.recentSessionIds, 12).map((item) => cleanId(item)),
    notes: uniqueById(asArray(source.notes).map(normaliseNote)).filter((note) => note.text).slice(-2_000),
    events: normaliseEvents(source.events ?? source.questionEvents, options),
    settings: normaliseSettings(source.settings, legacy),
    meta: {
      createdAt: isoDate(source.meta?.createdAt, defaults.meta.createdAt),
      updatedAt: isoDate(source.meta?.updatedAt, defaults.meta.updatedAt),
      lastCompactedAt: isoDate(source.meta?.lastCompactedAt, null),
    },
  };
}

function upsert(state, key, value, normaliser) {
  const migrated = migrateClassroomState(state);
  const item = normaliser(value);
  const items = migrated[key].filter((candidate) => candidate.id !== item.id);
  return { ...migrated, [key]: [...items, item] };
}

export const upsertProfile = (state, value) => upsert(state, "profiles", value, normaliseProfile);
export const upsertGroup = (state, value) => upsert(state, "groups", value, normaliseGroup);
export const upsertPreset = (state, value) => upsert(state, "presets", { ...value, builtIn: false }, normalisePreset);
export const upsertSession = (state, value) => upsert(state, "sessions", value, normaliseSession);
export const upsertNote = (state, value) => upsert(state, "notes", value, normaliseNote);

export function appendEvents(state, values, options = {}) {
  const migrated = migrateClassroomState(state, options);
  const events = normaliseEvents([...migrated.events, ...asArray(values)], options);
  return { ...migrated, events };
}

function skillKey(event) {
  return `${event.strand}::${event.subskill}`;
}

function weightForRecency(timestamp, nowMs) {
  const time = Date.parse(timestamp ?? "");
  if (!Number.isFinite(time)) return 0.55;
  const days = Math.max(0, (nowMs - time) / 86_400_000);
  return 0.45 + 0.55 * Math.exp(-days / 42);
}

function weightedRatio(items, predicate, nowMs) {
  let numerator = 0;
  let denominator = 0;
  for (const item of items) {
    const weight = weightForRecency(item.timestamp, nowMs);
    denominator += weight;
    if (predicate(item)) numerator += weight;
  }
  return denominator ? numerator / denominator : 0;
}

function countRetrievalSuccesses(events) {
  const bySignature = new Map();
  let opportunities = 0;
  let successes = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const previous = bySignature.get(event.questionSignature) ?? [];
    const currentTime = Date.parse(event.timestamp ?? "");
    const hadGap = previous.some((entry) => {
      const previousTime = Date.parse(entry.timestamp ?? "");
      return (Number.isFinite(currentTime) && Number.isFinite(previousTime) && currentTime - previousTime >= 30 * 60_000)
        || entry.sessionId !== event.sessionId
        || index - entry.index >= 8;
    });
    if (hadGap) {
      opportunities += 1;
      if (event.finalCorrect && event.firstResponseCorrect && event.supportUsed === 0) successes += 1;
    }
    previous.push({ ...event, index });
    bySignature.set(event.questionSignature, previous.slice(-3));
  }
  return { opportunities, successes, score: opportunities ? successes / opportunities : 0 };
}

function evidenceForSkill(events, nowMs) {
  if (!events.length) {
    return {
      state: "Not yet seen", strength: "Limited evidence", overall: 0,
      lenses: { accuracy: 0, independence: 0, stability: 0, retrieval: 0, transfer: 0 },
      sampleCount: 0, variationCount: 0, sessionCount: 0, supportCount: 0, modelCount: 0,
      lastPractised: null, retrievalDue: false, misconception: null,
    };
  }
  const ordered = [...events].sort((a, b) => (Date.parse(a.timestamp ?? 0) || 0) - (Date.parse(b.timestamp ?? 0) || 0));
  const accuracy = weightedRatio(ordered, (event) => event.finalCorrect, nowMs);
  const independence = weightedRatio(ordered, (event) => event.finalCorrect && event.firstResponseCorrect && event.supportUsed === 0, nowMs);
  const signatures = new Set(ordered.map((event) => event.questionSignature));
  const successfulSignatures = new Set(ordered.filter((event) => event.finalCorrect).map((event) => event.questionSignature));
  const sessions = new Set(ordered.map((event) => event.sessionId));
  const stabilityCoverage = Math.min(1, signatures.size / 5);
  const stabilityConsistency = signatures.size ? successfulSignatures.size / signatures.size : 0;
  const stability = stabilityCoverage * 0.45 + stabilityConsistency * 0.55;
  const retrieval = countRetrievalSuccesses(ordered);
  // A sequence position identifies ordering, not transfer by itself. The pupil
  // app's engine session index is also carried in this field for older records,
  // so treating any value above one as transfer would make nearly every later
  // question in a session look like successful transfer.
  const transferEvents = ordered.filter((event) => event.transfer || event.connectionKind.includes("transfer") || event.connectionKind === "connection");
  const transfer = transferEvents.length
    ? weightedRatio(transferEvents, (event) => event.finalCorrect && event.firstResponseCorrect, nowMs)
    : 0;
  const overall = clamp(accuracy * 0.27 + independence * 0.27 + stability * 0.2 + retrieval.score * 0.14 + transfer * 0.12, 0, 1);
  const supportCount = ordered.filter((event) => event.finalCorrect && (event.supportUsed > 0 || !event.firstResponseCorrect)).length;
  const modelCount = ordered.filter((event) => event.supportUsed >= 75).length;
  const lastPractised = ordered.at(-1).timestamp;
  const daysSince = Number.isFinite(Date.parse(lastPractised)) ? Math.max(0, (nowMs - Date.parse(lastPractised)) / 86_400_000) : 0;
  const recentlySecure = ordered.length >= 6 && signatures.size >= 4 && accuracy >= 0.82 && independence >= 0.67 && stability >= 0.72;
  const retrievalDue = recentlySecure && daysSince >= 7;
  let state = "Building";
  if (retrievalDue) state = "Ready for retrieval";
  else if (ordered.length >= 4 && supportCount >= Math.ceil(ordered.length * 0.5) && independence < 0.55 && accuracy >= 0.55) state = "Support still useful";
  else if (recentlySecure) state = "Secure recently";
  else if (ordered.length < 3 || accuracy < 0.45) state = "Beginning";
  const strength = ordered.length >= 12 && signatures.size >= 6 && sessions.size >= 3
    ? "Strong evidence"
    : ordered.length >= 5 && signatures.size >= 3
      ? "Growing evidence"
      : "Limited evidence";
  const misconceptionCounts = new Map();
  for (const event of ordered) {
    if (!event.misconceptionCode || event.finalCorrect && event.firstResponseCorrect) continue;
    misconceptionCounts.set(event.misconceptionCode, (misconceptionCounts.get(event.misconceptionCode) ?? 0) + 1);
  }
  const misconceptionEntry = [...misconceptionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const misconception = misconceptionEntry?.[1] >= 2 ? { code: misconceptionEntry[0], count: misconceptionEntry[1] } : null;
  return {
    state,
    strength,
    overall,
    lenses: { accuracy, independence, stability, retrieval: retrieval.score, transfer },
    sampleCount: ordered.length,
    variationCount: signatures.size,
    sessionCount: sessions.size,
    supportCount,
    modelCount,
    lastPractised,
    retrievalDue,
    misconception,
  };
}

/** Calculate the five evidence lenses for one already-selected skill. */
export function calculateSkillEvidence(values, options = {}) {
  const events = normaliseEvents(values, { cap: options.cap ?? 100_000, profileCap: options.profileCap ?? 100_000 });
  const nowMs = new Date(options.now ?? Date.now()).getTime();
  return evidenceForSkill(events, Number.isFinite(nowMs) ? nowMs : Date.now());
}

/** Calculate evidence by profile and strand/subskill. */
export function calculateEvidence(values, options = {}) {
  const events = normaliseEvents(values, { cap: options.cap ?? 100_000, profileCap: options.profileCap ?? 100_000 });
  const nowMs = new Date(options.now ?? Date.now()).getTime();
  const profiles = Object.create(null);
  for (const event of events) {
    if (!profiles[event.profileId]) profiles[event.profileId] = {};
    const key = skillKey(event);
    if (!profiles[event.profileId][key]) profiles[event.profileId][key] = [];
    profiles[event.profileId][key].push(event);
  }
  const result = Object.create(null);
  for (const [profileId, skills] of Object.entries(profiles)) {
    result[profileId] = {};
    for (const [key, skillEvents] of Object.entries(skills)) {
      const [strand, subskill] = key.split("::");
      result[profileId][key] = { profileId, key, strand, subskill, ...evidenceForSkill(skillEvents, nowMs) };
    }
  }
  return result;
}

function titleCase(value) {
  return cleanText(value).replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

/** Return no more than three clear, evidence-backed teacher suggestions. */
export function buildRecommendations(profileEvidence, options = {}) {
  const skills = Array.isArray(profileEvidence) ? profileEvidence : Object.values(asObject(profileEvidence));
  const candidates = [];
  for (const evidence of skills) {
    if (!evidence || !EVIDENCE_STATES.has(evidence.state) || evidence.state === "Not yet seen") continue;
    const label = titleCase(evidence.subskill || evidence.strand || "this skill");
    let priority = 10;
    let reason = "Recent evidence suggests another varied practice opportunity would be useful.";
    let support = { mode: "adaptive", value: 42 };
    if (evidence.state === "Support still useful") {
      priority = 100 + (1 - evidence.lenses.independence) * 20;
      reason = `${evidence.supportCount} of ${evidence.sampleCount} successful responses used a hint, representation or model.`;
      support = { mode: "adaptive", value: 58 };
    } else if (evidence.state === "Ready for retrieval") {
      priority = 90 + evidence.overall * 10;
      reason = `Previously secure across ${evidence.variationCount} variations; enough time has passed for useful retrieval.`;
      support = { mode: "available", value: 20 };
    } else if (evidence.state === "Beginning") {
      priority = 80 + (1 - evidence.lenses.accuracy) * 10;
      reason = `Current evidence is limited: ${evidence.sampleCount} responses across ${evidence.variationCount} variation${evidence.variationCount === 1 ? "" : "s"}.`;
      support = { mode: "guided", value: 68 };
    } else if (evidence.state === "Building") {
      priority = 60 + (1 - evidence.overall) * 15;
      reason = `Success is developing across ${evidence.variationCount} variations; another connected session can strengthen stability.`;
    } else if (evidence.state === "Secure recently") {
      priority = 25;
      reason = `Secure recently across ${evidence.variationCount} variations; keep it lightly interleaved.`;
      support = { mode: "available", value: 16 };
    }
    if (evidence.misconception) {
      priority += 12;
      reason += ` The response pattern may indicate ${evidence.misconception.code.replaceAll("-", " ")}.`;
    }
    const challengeBySkill = asObject(options.challengeBySkill);
    const requestedChallenge = Object.prototype.hasOwnProperty.call(challengeBySkill, evidence.key)
      ? challengeBySkill[evidence.key]
      : options.defaultChallenge;
    const baseChallenge = clamp(Math.round(finiteNumber(requestedChallenge, 52)), 0, 100);
    candidates.push({
      id: `recommend-${cleanId(evidence.key)}`,
      skill: label,
      strand: evidence.strand,
      subskill: evidence.subskill,
      evidenceState: evidence.state,
      evidenceStrength: evidence.strength,
      reason,
      suggestedChallengeBand: { min: clamp(baseChallenge - 8, 0, 100), max: clamp(baseChallenge + 8, 0, 100) },
      suggestedSupport: support,
      actionLabel: "Practise this",
      config: normalisePracticeConfig({
        mode: "focus",
        focus: evidence.strand,
        strands: [evidence.strand],
        subskills: [evidence.subskill],
        challenge: { kind: "range", min: clamp(baseChallenge - 8, 0, 100), max: clamp(baseChallenge + 8, 0, 100) },
        support,
        length: { kind: "questions", value: 10 },
      }),
      priority,
    });
  }
  return candidates.sort((left, right) => right.priority - left.priority || left.skill.localeCompare(right.skill)).slice(0, 3).map(({ priority: _priority, ...item }) => item);
}

/** Encode only whitelisted practice configuration. Safe after ? or # on GitHub Pages. */
export function encodePracticeConfig(config) {
  const payload = JSON.stringify({ v: CLASSROOM_SCHEMA_VERSION, config: normalisePracticeConfig(config) });
  return `y4f=${encodeURIComponent(payload)}`;
}

export function decodePracticeConfig(value) {
  try {
    const text = cleanText(value, "", 30_000);
    let token = text;
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(text)) {
      const url = new URL(text);
      token = url.searchParams.has("y4f") ? url.search : url.hash;
    } else if (text.includes("?") && text.slice(text.indexOf("?") + 1).includes("y4f=")) {
      token = text.slice(text.indexOf("?") + 1).split("#", 1)[0];
    } else if (text.includes("#")) {
      token = text.slice(text.indexOf("#") + 1);
    }
    const params = new URLSearchParams(token.replace(/^[?#]/, ""));
    const encoded = params.get("y4f") ?? (token.startsWith("y4f=") ? token.slice(4) : token);
    const parsed = JSON.parse(decodeURIComponent(encoded));
    if (parsed?.v !== CLASSROOM_SCHEMA_VERSION || !parsed?.config) return { valid: false, error: "Unsupported practice-link version." };
    return { valid: true, config: normalisePracticeConfig(parsed.config) };
  } catch {
    return { valid: false, error: "This practice link is not valid." };
  }
}

function exportProfile(profile, includeLabels) {
  return {
    id: profile.id,
    ...(includeLabels ? { label: profile.label, initials: profile.initials, alias: profile.alias } : {}),
    archived: profile.archived,
  };
}

export function createEvidenceExport(state, options = {}) {
  const migrated = migrateClassroomState(state);
  const includeLabels = options.includeLabels !== false;
  return {
    type: EVIDENCE_PACKAGE_TYPE,
    schemaVersion: CLASSROOM_SCHEMA_VERSION,
    applicationVersion: cleanText(options.applicationVersion, migrated.applicationVersion, 40),
    exportedAt: isoDate(options.now ?? Date.now(), null),
    profiles: migrated.profiles.map((profile) => exportProfile(profile, includeLabels)),
    groups: migrated.groups.map((group) => ({ id: group.id, name: includeLabels ? group.name : "", profileIds: group.profileIds })),
    sessions: migrated.sessions.filter((session) => session.status === "complete").map((session) => ({
      id: session.id, profileIds: session.profileIds, title: session.title, startedAt: session.startedAt, completedAt: session.completedAt, config: session.config,
    })),
    events: migrated.events,
  };
}

export function createClassroomBackup(state, options = {}) {
  const migrated = migrateClassroomState(state);
  const backup = clone(migrated);
  backup.settings.teacherPinHash = "";
  backup.settings.teacherAccessConfigured = false;
  return {
    type: CLASSROOM_PACKAGE_TYPE,
    schemaVersion: CLASSROOM_SCHEMA_VERSION,
    applicationVersion: cleanText(options.applicationVersion, migrated.applicationVersion, 40),
    exportedAt: isoDate(options.now ?? Date.now(), null),
    data: backup,
  };
}

export function validateClassroomPackage(value, expectedType = null) {
  const packageValue = asObject(value);
  const errors = [];
  if (![CLASSROOM_PACKAGE_TYPE, EVIDENCE_PACKAGE_TYPE].includes(packageValue.type)) errors.push("Unknown package type.");
  if (expectedType && packageValue.type !== expectedType) errors.push(`Expected ${expectedType}.`);
  if (packageValue.schemaVersion !== CLASSROOM_SCHEMA_VERSION) errors.push("Unsupported schema version.");
  const data = packageValue.type === CLASSROOM_PACKAGE_TYPE ? packageValue.data : packageValue;
  if (!data || typeof data !== "object" || Array.isArray(data)) errors.push("Package data is missing.");
  if (packageValue.type === EVIDENCE_PACKAGE_TYPE && !Array.isArray(packageValue.events)) errors.push("Evidence events are missing.");
  if (packageValue.type === CLASSROOM_PACKAGE_TYPE && !Array.isArray(packageValue.data?.profiles)) errors.push("Backup profiles are missing.");
  return { valid: errors.length === 0, errors, type: packageValue.type, data };
}

function importedProfiles(packageValue) {
  return asArray(packageValue.type === CLASSROOM_PACKAGE_TYPE ? packageValue.data?.profiles : packageValue.profiles).map(normaliseProfile);
}

function importedEvents(packageValue) {
  return normaliseEvents(packageValue.type === CLASSROOM_PACKAGE_TYPE ? packageValue.data?.events : packageValue.events, { cap: 100_000, profileCap: 100_000 });
}

function mergeImportedEventsPreservingCurrent(currentValues, incomingValues, options = {}) {
  const cap = clamp(Math.round(finiteNumber(options.cap, DEFAULT_EVENT_CAP)), 1, 100_000);
  const profileCap = clamp(Math.round(finiteNumber(options.profileCap, DEFAULT_PROFILE_EVENT_CAP)), 1, cap);
  const current = normaliseEvents(currentValues, { cap, profileCap });
  const incoming = normaliseEvents(incomingValues, { cap: 100_000, profileCap: 100_000 });
  const existingIds = new Set(current.map((event) => event.id));
  const profileCounts = new Map();
  current.forEach((event) => profileCounts.set(event.profileId, (profileCounts.get(event.profileId) ?? 0) + 1));
  const acceptedReversed = [];
  let rejectedForCapacity = 0;
  let duplicates = 0;
  for (let index = incoming.length - 1; index >= 0; index -= 1) {
    const event = incoming[index];
    if (existingIds.has(event.id)) {
      duplicates += 1;
      continue;
    }
    const profileCount = profileCounts.get(event.profileId) ?? 0;
    if (current.length + acceptedReversed.length >= cap || profileCount >= profileCap) {
      rejectedForCapacity += 1;
      continue;
    }
    existingIds.add(event.id);
    profileCounts.set(event.profileId, profileCount + 1);
    acceptedReversed.push(event);
  }
  const accepted = acceptedReversed.reverse();
  const events = [...current, ...accepted].sort((left, right) => (Date.parse(left.timestamp ?? 0) || 0) - (Date.parse(right.timestamp ?? 0) || 0));
  return { events, accepted, duplicates, rejectedForCapacity };
}

function resolveProfileMap(current, packageValue, mappings = {}) {
  const existingIds = new Set(current.profiles.map((profile) => profile.id));
  const map = Object.create(null);
  const unresolved = [];
  const skipped = [];
  const creates = [];
  for (const profile of importedProfiles(packageValue)) {
    if (existingIds.has(profile.id)) {
      map[profile.id] = profile.id;
      continue;
    }
    const selection = Object.prototype.hasOwnProperty.call(asObject(mappings), profile.id) ? mappings[profile.id] : undefined;
    if (selection === "skip" || selection?.action === "skip") {
      skipped.push(profile.id);
      continue;
    }
    if (selection === "create" || selection?.action === "create") {
      const requested = cleanId(selection?.id, profile.id);
      const id = existingIds.has(requested) ? fallbackId("profile", `${requested}:import`) : requested;
      map[profile.id] = id;
      existingIds.add(id);
      creates.push({ ...profile, id });
      continue;
    }
    const targetId = cleanId(typeof selection === "string" ? selection : selection?.profileId);
    if (targetId && existingIds.has(targetId)) {
      map[profile.id] = targetId;
      continue;
    }
    unresolved.push({ id: profile.id, label: profile.label, initials: profile.initials });
  }
  return { map, unresolved, skipped, creates };
}

export function previewEvidenceImport(state, packageValue, options = {}) {
  const current = migrateClassroomState(state);
  const validation = validateClassroomPackage(packageValue, EVIDENCE_PACKAGE_TYPE);
  if (!validation.valid) return { valid: false, errors: validation.errors, unresolvedProfiles: [], duplicateEvents: 0, addEvents: 0, rejectedEvents: 0 };
  const profiles = resolveProfileMap(current, packageValue, options.profileMappings);
  const mappedEvents = [];
  const existingEventIds = new Set(current.events.map((event) => event.id));
  let duplicatesBeforeMapping = 0;
  let rejectedUnmapped = 0;
  for (const event of importedEvents(packageValue)) {
    if (existingEventIds.has(event.id)) { duplicatesBeforeMapping += 1; continue; }
    const profileId = profiles.map[event.profileId];
    if (!profileId) { rejectedUnmapped += 1; continue; }
    mappedEvents.push({ ...event, profileId });
  }
  const merge = mergeImportedEventsPreservingCurrent(current.events, mappedEvents, options);
  return {
    valid: true,
    errors: [],
    unresolvedProfiles: profiles.unresolved,
    profilesToCreate: profiles.creates,
    skippedProfiles: profiles.skipped,
    duplicateEvents: duplicatesBeforeMapping + merge.duplicates,
    addEvents: merge.accepted.length,
    rejectedEvents: rejectedUnmapped + merge.rejectedForCapacity,
    rejectedForCapacity: merge.rejectedForCapacity,
    canApply: profiles.unresolved.length === 0,
  };
}

export function applyEvidenceImport(state, packageValue, options = {}) {
  const current = migrateClassroomState(state);
  const preview = previewEvidenceImport(current, packageValue, options);
  if (!preview.valid || !preview.canApply) return { applied: false, state: current, report: preview };
  const profiles = resolveProfileMap(current, packageValue, options.profileMappings);
  const candidates = [];
  for (const event of importedEvents(packageValue)) {
    const profileId = profiles.map[event.profileId];
    if (!profileId) continue;
    candidates.push({ ...event, profileId });
  }
  const merge = mergeImportedEventsPreservingCurrent(current.events, candidates, options);
  const next = { ...current, profiles: uniqueById([...current.profiles, ...profiles.creates]), events: merge.events };
  return { applied: true, state: next, report: { ...preview, appliedEvents: merge.accepted.length, createdProfiles: profiles.creates.length, rejectedForCapacity: merge.rejectedForCapacity } };
}

function mergeById(current, incoming, normaliser, incomingWins = false) {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item, index) => {
    const normalised = normaliser(item, index);
    if (!map.has(normalised.id) || incomingWins) map.set(normalised.id, normalised);
  });
  return [...map.values()];
}

export function previewBackupRestore(state, packageValue, options = {}) {
  const current = migrateClassroomState(state);
  const validation = validateClassroomPackage(packageValue, CLASSROOM_PACKAGE_TYPE);
  if (!validation.valid) return { valid: false, errors: validation.errors, mode: options.mode ?? "merge" };
  const incoming = migrateClassroomState(packageValue.data);
  const existingEvents = new Set(current.events.map((event) => event.id));
  const eventMerge = mergeImportedEventsPreservingCurrent(current.events, incoming.events, options);
  return {
    valid: true,
    errors: [],
    mode: options.mode === "replace" ? "replace" : "merge",
    profiles: incoming.profiles.length,
    groups: incoming.groups.length,
    presets: incoming.presets.filter((item) => !item.builtIn).length,
    sessions: incoming.sessions.length,
    notes: incoming.notes.length,
    events: incoming.events.length,
    duplicateEvents: incoming.events.filter((event) => existingEvents.has(event.id)).length,
    addEvents: eventMerge.accepted.length,
    rejectedForCapacity: eventMerge.rejectedForCapacity,
    warning: options.mode === "replace" ? "Current classroom data will be replaced after confirmation." : "Existing data will be preserved and compatible records added.",
  };
}

export function restoreClassroomBackup(state, packageValue, options = {}) {
  const current = migrateClassroomState(state);
  const preview = previewBackupRestore(current, packageValue, options);
  if (!preview.valid) return { restored: false, state: current, report: preview };
  const incoming = migrateClassroomState(packageValue.data);
  if (preview.mode === "replace") {
    return { restored: true, state: { ...incoming, settings: { ...incoming.settings, teacherPinHash: "", teacherAccessConfigured: false } }, report: preview };
  }
  const eventMerge = mergeImportedEventsPreservingCurrent(current.events, incoming.events, options);
  const next = {
    ...current,
    profiles: mergeById(current.profiles, incoming.profiles, normaliseProfile),
    groups: mergeById(current.groups, incoming.groups, normaliseGroup),
    presets: mergeById(current.presets, incoming.presets.filter((item) => !item.builtIn), normalisePreset),
    sessions: mergeById(current.sessions, incoming.sessions, normaliseSession).slice(-200),
    notes: mergeById(current.notes, incoming.notes, normaliseNote).slice(-2_000),
    events: eventMerge.events,
    recentSessionIds: uniqueStrings([...current.recentSessionIds, ...incoming.recentSessionIds], 12),
  };
  return { restored: true, state: next, report: preview };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsvSummary(state, options = {}) {
  const migrated = migrateClassroomState(state);
  const evidence = calculateEvidence(migrated.events, options);
  const labels = new Map(migrated.profiles.map((profile) => [profile.id, profile.label]));
  const rows = [["Profile", "Strand", "Subskill", "Evidence state", "Evidence strength", "Questions", "Variations", "Independent success", "Supported success", "Last practised"]];
  for (const profileId of Object.keys(evidence).sort((left, right) => (labels.get(left) ?? left).localeCompare(labels.get(right) ?? right))) {
    for (const item of Object.values(evidence[profileId]).sort((left, right) => left.key.localeCompare(right.key))) {
      rows.push([
        labels.get(profileId) ?? profileId,
        item.strand,
        item.subskill,
        item.state,
        item.strength,
        item.sampleCount,
        item.variationCount,
        `${Math.round(item.lenses.independence * 100)}%`,
        item.supportCount,
        item.lastPractised ?? "",
      ]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
