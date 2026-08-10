import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASSROOM_PACKAGE_TYPE,
  CLASSROOM_SCHEMA_VERSION,
  DEFAULT_CLASSROOM_PRESETS,
  EVIDENCE_PACKAGE_TYPE,
  appendEvents,
  applyEvidenceImport,
  buildRecommendations,
  calculateEvidence,
  calculateSkillEvidence,
  createClassroomBackup,
  createClassroomState,
  createCsvSummary,
  createEvidenceExport,
  csvCell,
  decodePracticeConfig,
  encodePracticeConfig,
  migrateClassroomState,
  mergeClassroomStates,
  normaliseEvent,
  normaliseEvents,
  normalisePracticeConfig,
  previewBackupRestore,
  previewEvidenceImport,
  restoreClassroomBackup,
  upsertGroup,
  upsertNote,
  upsertPreset,
  upsertProfile,
  upsertSession,
  validateClassroomPackage,
} from "../lib/classroom-mastery.mjs";

const DAY = 86_400_000;
const BASE = Date.parse("2026-08-01T09:00:00.000Z");

function event(overrides = {}) {
  const index = overrides.index ?? 0;
  return {
    id: overrides.id ?? `event-${index}`,
    profileId: overrides.profileId ?? "profile-a",
    sessionId: overrides.sessionId ?? `session-${Math.floor(index / 4)}`,
    timestamp: overrides.timestamp ?? new Date(BASE + index * 60 * 60_000).toISOString(),
    family: overrides.family ?? "derived-facts",
    strand: overrides.strand ?? "multiplication",
    subskill: overrides.subskill ?? "derived facts",
    difficulty: overrides.difficulty ?? 56,
    selectedChallengeBand: overrides.selectedChallengeBand ?? { min: 48, max: 64 },
    supportAvailable: overrides.supportAvailable ?? 40,
    supportUsed: overrides.supportUsed ?? 0,
    representationShown: overrides.representationShown ?? "",
    attempts: overrides.attempts ?? 1,
    firstResponseCorrect: overrides.firstResponseCorrect ?? true,
    finalCorrect: overrides.finalCorrect ?? true,
    misconceptionCode: overrides.misconceptionCode ?? "",
    relatedSequencePosition: overrides.relatedSequencePosition ?? 0,
    connectionKind: overrides.connectionKind ?? "",
    transfer: overrides.transfer ?? false,
    questionSignature: overrides.questionSignature ?? `variation-${index % 6}`,
    sessionSeed: overrides.sessionSeed ?? "seed-one",
    responseMs: overrides.responseMs ?? 2_500,
  };
}

test("v3 defaults are safe, local and contain the six restrained classroom presets", () => {
  const state = createClassroomState({ now: "2026-08-07T10:00:00Z", applicationVersion: "3.0.0" });
  assert.equal(state.schemaVersion, CLASSROOM_SCHEMA_VERSION);
  assert.equal(state.profiles.length, 0);
  assert.equal(state.events.length, 0);
  assert.equal(state.presets.length, 6);
  assert.deepEqual(state.presets.map((item) => item.name), [
    "Morning Warm-Up",
    "Year 4 Core",
    "Foundations",
    "Tables and Division",
    "Fractions and Decimals",
    "Deep Challenge",
  ]);
  assert.ok(state.presets.every((item) => item.builtIn));
  assert.ok(state.presets.every((item) => item.config.challenge.min <= item.config.challenge.max));
  assert.ok(state.presets.every((item) => item.config.support.mode));
  assert.equal(DEFAULT_CLASSROOM_PRESETS.length, 6);
});

test("missing, malformed and partial Build 1/2 data migrate without throwing", () => {
  assert.doesNotThrow(() => migrateClassroomState(null));
  assert.doesNotThrow(() => migrateClassroomState("broken"));
  const state = migrateClassroomState({
    challenge: 67,
    support: 42,
    profiles: [{ id: "p one", displayName: "  Ada\nL.  ", groupIds: ["known", "missing"] }, null],
    groups: [{ id: "known", name: "4B", profileIds: ["p-one", "missing"] }],
    presets: [{ id: "mine", name: "My preset", challenge: 61, support: 22 }],
    sessions: "not-an-array",
    events: [{ id: "bad-date", profileId: "p-one", timestamp: "nope", correct: "yes" }],
    settings: { profilePrivacy: "impossible", largerText: true },
  });
  assert.equal(state.schemaVersion, 3);
  assert.equal(state.settings.lastChallenge, 67);
  assert.equal(state.settings.lastSupport, 42);
  assert.equal(state.settings.profilePrivacy, "full");
  assert.equal(state.settings.largerText, true);
  assert.equal(state.profiles[0].label, "Ada L.");
  assert.deepEqual(state.profiles[0].groupIds, ["known"]);
  assert.deepEqual(state.groups[0].profileIds, ["p-one"]);
  assert.equal(state.presets.at(-1).name, "My preset");
  assert.equal(state.events[0].finalCorrect, false);
});

test("profile, group, preset, session and note helpers preserve a normalised state shape", () => {
  let state = createClassroomState();
  state = upsertProfile(state, { id: "p/1", name: "Sam Smith", symbol: "diamond" });
  state = upsertGroup(state, { id: "g1", name: "Table One", type: "table", profileIds: ["p-1"] });
  state = upsertPreset(state, { id: "custom", name: "Six times", config: { mode: "focus", focus: "tables", challenge: 55 } });
  state = upsertSession(state, { id: "s1", profileId: "p-1", title: "Morning", position: -9 });
  state = upsertNote(state, { id: "n1", subjectType: "profile", subjectId: "p-1", text: "  Use arrays first.  " });
  assert.equal(state.profiles[0].id, "p-1");
  assert.equal(state.groups[0].type, "table");
  assert.equal(state.presets.at(-1).builtIn, false);
  assert.equal(state.sessions[0].position, 0);
  assert.equal(state.notes[0].text, "Use arrays first.");
});

test("practice configuration is clamped, whitelisted and safe for GitHub Pages links", () => {
  const source = {
    mode: "THINK",
    focus: "Equivalence",
    strands: ["mixed", "multiplication"],
    challenge: { kind: "range", min: -20, max: 180 },
    support: { mode: "guided", value: 72 },
    length: { kind: "questions", value: 20 },
    seedMode: "same",
    seed: "class-set-4b",
    profileId: "MUST-NOT-LEAK",
    pupilName: "MUST-NOT-LEAK",
    results: [{ correct: false }],
  };
  const config = normalisePracticeConfig(source);
  assert.equal(config.mode, "think");
  assert.deepEqual(config.challenge, { kind: "range", min: 0, max: 100, value: 50 });
  assert.equal(config.support.mode, "guided");
  assert.equal(config.profileId, undefined);
  const token = encodePracticeConfig(source);
  assert.equal(token.includes("MUST-NOT-LEAK"), false);
  for (const input of [token, `?${token}`, `#${token}`, `https://example.github.io/repo/?${token}`, `https://example.github.io/repo/?${token}#section`, `https://example.github.io/repo/#${token}`]) {
    const decoded = decodePracticeConfig(input);
    assert.equal(decoded.valid, true, input);
    assert.equal(decoded.config.seed, "class-set-4b");
    assert.equal(decoded.config.profileId, undefined);
  }
  assert.deepEqual(decodePracticeConfig("#y4f=not-json"), { valid: false, error: "This practice link is not valid." });
});

test("events are normalised, deduplicated and capped while retaining the newest per pupil", () => {
  const values = [];
  for (let index = 0; index < 12; index += 1) values.push(event({ index, profileId: index % 2 ? "b" : "a" }));
  values.push({ ...values[11] });
  const result = normaliseEvents(values, { cap: 7, profileCap: 4 });
  assert.equal(result.length, 7);
  assert.equal(new Set(result.map((item) => item.id)).size, 7);
  assert.ok(result.filter((item) => item.profileId === "a").length <= 4);
  assert.ok(result.filter((item) => item.profileId === "b").length <= 4);
  assert.equal(result.at(-1).id, "event-11");
  assert.equal(result.some((item) => item.id === "event-0"), false);
  const bad = normaliseEvent({ profileId: "", difficulty: 999, supportUsed: -50, attempts: 0, responseMs: -1 });
  assert.equal(bad.profileId, "guest");
  assert.equal(bad.questionDifficulty, 100);
  assert.equal(bad.supportUsed, 0);
  assert.equal(bad.attempts, 1);
  assert.equal(bad.responseMs, 0);
});

test("five evidence lenses distinguish beginning, supported success and secure variation", () => {
  const empty = calculateSkillEvidence([], { now: BASE });
  assert.equal(empty.state, "Not yet seen");
  assert.deepEqual(Object.keys(empty.lenses), ["accuracy", "independence", "stability", "retrieval", "transfer"]);

  const beginning = calculateSkillEvidence([
    event({ index: 0, finalCorrect: false, firstResponseCorrect: false }),
    event({ index: 1, finalCorrect: false, firstResponseCorrect: false }),
  ], { now: BASE + DAY });
  assert.equal(beginning.state, "Beginning");
  assert.equal(beginning.lenses.accuracy, 0);

  const supported = calculateSkillEvidence(Array.from({ length: 6 }, (_, index) => event({
    index,
    finalCorrect: true,
    firstResponseCorrect: false,
    supportUsed: index % 2 ? 55 : 90,
    attempts: 2,
  })), { now: BASE + DAY });
  assert.equal(supported.state, "Support still useful");
  assert.equal(supported.lenses.accuracy, 1);
  assert.equal(supported.lenses.independence, 0);
  assert.equal(supported.supportCount, 6);

  const secureEvents = Array.from({ length: 12 }, (_, index) => event({
    index,
    sessionId: `session-${index % 3}`,
    timestamp: new Date(BASE + index * 2 * 60 * 60_000).toISOString(),
    questionSignature: `variation-${index % 6}`,
    transfer: index >= 8,
    relatedSequencePosition: index >= 8 ? 2 : 0,
  }));
  const secure = calculateSkillEvidence(secureEvents, { now: BASE + 2 * DAY });
  assert.equal(secure.state, "Secure recently");
  assert.equal(secure.strength, "Strong evidence");
  assert.equal(secure.lenses.accuracy, 1);
  assert.equal(secure.lenses.independence, 1);
  assert.equal(secure.lenses.stability, 1);
  assert.equal(secure.lenses.transfer, 1);
  assert.ok(secure.lenses.retrieval > 0);
  const due = calculateSkillEvidence(secureEvents, { now: BASE + 12 * DAY });
  assert.equal(due.state, "Ready for retrieval");

  const ordinarySession = calculateSkillEvidence(Array.from({ length: 8 }, (_, index) => event({
    index,
    relatedSequencePosition: index + 1,
    connectionKind: "",
    transfer: false,
  })), { now: BASE + DAY });
  assert.equal(ordinarySession.lenses.transfer, 0, "a global session index must not masquerade as transfer evidence");
  const designedConnection = calculateSkillEvidence([
    event({ index: 30, connectionKind: "connection", transfer: false, relatedSequencePosition: 30 }),
  ], { now: BASE + 2 * DAY });
  assert.equal(designedConnection.lenses.transfer, 1, "an independently successful designed connection is valid transfer evidence");
});

test("evidence is grouped by profile and skill and misconceptions require repetition", () => {
  const events = [
    event({ id: "a1", profileId: "a", index: 1, misconceptionCode: "denominator-size", finalCorrect: false, firstResponseCorrect: false }),
    event({ id: "a2", profileId: "a", index: 2, misconceptionCode: "denominator-size", finalCorrect: false, firstResponseCorrect: false }),
    event({ id: "b1", profileId: "b", index: 3, strand: "fractions", subskill: "compare fractions" }),
  ];
  const evidence = calculateEvidence(events, { now: BASE + DAY });
  assert.deepEqual(Object.keys(evidence).sort(), ["a", "b"]);
  assert.deepEqual(evidence.a["multiplication::derived facts"].misconception, { code: "denominator-size", count: 2 });
  assert.equal(evidence.b["fractions::compare fractions"].misconception, null);
});

test("untrusted profile identifiers cannot alter evidence or mapping object prototypes", () => {
  const evidence = calculateEvidence([event({ id: "hostile-event", profileId: "__proto__", index: 1 })], { now: BASE + DAY });
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.hasOwn(evidence, "__proto__"), true);
  assert.equal(evidence.__proto__["multiplication::derived facts"].sampleCount, 1);

  const packageValue = {
    type: EVIDENCE_PACKAGE_TYPE,
    schemaVersion: 3,
    profiles: [{ id: "__proto__", label: "Imported" }],
    events: [event({ id: "hostile-import", profileId: "__proto__" })],
  };
  const preview = previewEvidenceImport(createClassroomState(), packageValue);
  assert.equal(preview.canApply, false);
  assert.equal(preview.unresolvedProfiles[0].id, "__proto__");
  assert.equal(Object.prototype.polluted, undefined);
});

test("teacher recommendations are transparent, actionable and capped at three", () => {
  const entries = {
    one: { key: "multiplication::facts", strand: "multiplication", subskill: "related 8× facts", state: "Support still useful", strength: "Growing evidence", overall: 0.5, lenses: { accuracy: 0.8, independence: 0.2 }, sampleCount: 8, variationCount: 4, supportCount: 6, misconception: null },
    two: { key: "place value::rounding", strand: "place value", subskill: "rounding", state: "Ready for retrieval", strength: "Strong evidence", overall: 0.9, lenses: { accuracy: 0.9, independence: 0.9 }, sampleCount: 14, variationCount: 7, supportCount: 0, misconception: null },
    three: { key: "fractions::equivalence", strand: "fractions", subskill: "equivalence", state: "Beginning", strength: "Limited evidence", overall: 0.2, lenses: { accuracy: 0.3, independence: 0.2 }, sampleCount: 2, variationCount: 1, supportCount: 0, misconception: { code: "adds-denominators", count: 2 } },
    four: { key: "addition::bridging", strand: "addition", subskill: "bridging", state: "Building", strength: "Growing evidence", overall: 0.6, lenses: { accuracy: 0.7, independence: 0.6 }, sampleCount: 7, variationCount: 4, supportCount: 1, misconception: null },
  };
  const recommendations = buildRecommendations(entries, { defaultChallenge: 58 });
  assert.equal(recommendations.length, 3);
  assert.equal(recommendations[0].evidenceState, "Support still useful");
  assert.ok(recommendations.every((item) => item.reason.length > 20));
  assert.ok(recommendations.every((item) => item.actionLabel === "Practise this"));
  assert.ok(recommendations.every((item) => item.config.mode === "focus"));
  assert.ok(recommendations.every((item) => item.suggestedChallengeBand.min >= 0 && item.suggestedChallengeBand.max <= 100));
});

test("evidence imports never guess a profile from a similar name", () => {
  const current = appendEvents(upsertProfile(createClassroomState(), { id: "local-alice", label: "Alice" }), [
    event({ id: "duplicate", profileId: "local-alice", index: 0 }),
  ]);
  const packageValue = {
    type: EVIDENCE_PACKAGE_TYPE,
    schemaVersion: 3,
    applicationVersion: "3",
    profiles: [{ id: "other-device-alice", label: "Alice" }],
    events: [
      event({ id: "duplicate", profileId: "other-device-alice", index: 1 }),
      event({ id: "new-event", profileId: "other-device-alice", index: 2 }),
    ],
  };
  const unresolved = previewEvidenceImport(current, packageValue);
  assert.equal(unresolved.canApply, false);
  assert.deepEqual(unresolved.unresolvedProfiles.map((profile) => profile.id), ["other-device-alice"]);
  assert.equal(unresolved.addEvents, 0);
  assert.equal(unresolved.rejectedEvents, 1);

  const mapped = previewEvidenceImport(current, packageValue, { profileMappings: { "other-device-alice": "local-alice" } });
  assert.equal(mapped.canApply, true);
  assert.equal(mapped.duplicateEvents, 1);
  assert.equal(mapped.addEvents, 1);
  const applied = applyEvidenceImport(current, packageValue, { profileMappings: { "other-device-alice": "local-alice" } });
  assert.equal(applied.applied, true);
  assert.equal(applied.state.events.length, 2);
  assert.equal(applied.state.events.find((item) => item.id === "new-event").profileId, "local-alice");

  const reapplied = applyEvidenceImport(applied.state, packageValue, { profileMappings: { "other-device-alice": "local-alice" } });
  assert.equal(reapplied.state.events.length, 2);
  assert.equal(reapplied.report.duplicateEvents, 2);
});

test("profile import can explicitly create or skip, and malformed packages are rejected", () => {
  const packageValue = {
    type: EVIDENCE_PACKAGE_TYPE,
    schemaVersion: 3,
    profiles: [{ id: "remote-pupil", label: "Pupil R" }],
    events: [event({ id: "remote-event", profileId: "remote-pupil" })],
  };
  const created = applyEvidenceImport(createClassroomState(), packageValue, { profileMappings: { "remote-pupil": "create" } });
  assert.equal(created.applied, true);
  assert.equal(created.state.profiles[0].id, "remote-pupil");
  assert.equal(created.state.events[0].profileId, "remote-pupil");
  const skipped = previewEvidenceImport(createClassroomState(), packageValue, { profileMappings: { "remote-pupil": "skip" } });
  assert.equal(skipped.canApply, true);
  assert.equal(skipped.addEvents, 0);
  assert.equal(skipped.rejectedEvents, 1);
  const malformed = validateClassroomPackage({ type: "anything", schemaVersion: 99 });
  assert.equal(malformed.valid, false);
  assert.ok(malformed.errors.length >= 2);
  const backupInEvidenceImporter = previewEvidenceImport(createClassroomState(), createClassroomBackup(createClassroomState()));
  assert.equal(backupInEvidenceImporter.valid, false);
  assert.match(backupInEvidenceImporter.errors.join(" "), /Expected year-4-fluency-evidence/);
});

test("evidence import caps reject excess imported events without removing existing evidence", () => {
  let current = upsertProfile(createClassroomState(), { id: "p1", label: "One" });
  current = appendEvents(current, [
    event({ id: "existing-old", profileId: "p1", index: 0 }),
    event({ id: "existing-new", profileId: "p1", index: 1 }),
  ]);
  const packageValue = {
    type: EVIDENCE_PACKAGE_TYPE,
    schemaVersion: 3,
    profiles: [{ id: "p1", label: "One" }],
    events: [
      event({ id: "import-1", profileId: "p1", index: 20 }),
      event({ id: "import-2", profileId: "p1", index: 21 }),
      event({ id: "import-3", profileId: "p1", index: 22 }),
    ],
  };
  const preview = previewEvidenceImport(current, packageValue, { cap: 3, profileCap: 3 });
  assert.equal(preview.addEvents, 1);
  assert.equal(preview.rejectedForCapacity, 2);
  const applied = applyEvidenceImport(current, packageValue, { cap: 3, profileCap: 3 });
  assert.equal(applied.report.appliedEvents, 1);
  assert.equal(applied.report.rejectedForCapacity, 2);
  assert.equal(applied.state.events.length, 3);
  assert.ok(applied.state.events.some((item) => item.id === "existing-old"));
  assert.ok(applied.state.events.some((item) => item.id === "existing-new"));
  assert.ok(applied.state.events.some((item) => item.id === "import-3"), "the newest compatible import should be retained");
});

test("exports are versioned, omit access codes and retain only useful evidence data", () => {
  let state = upsertProfile(createClassroomState({ settings: { teacherAccessConfigured: true, teacherPinHash: "secret" } }), { id: "p1", label: "Pupil One" });
  state = appendEvents(state, [event({ id: "e1", profileId: "p1" })]);
  const evidencePackage = createEvidenceExport(state, { now: "2026-08-07T10:00:00Z" });
  assert.equal(evidencePackage.type, EVIDENCE_PACKAGE_TYPE);
  assert.equal(evidencePackage.schemaVersion, 3);
  assert.equal(JSON.stringify(evidencePackage).includes("secret"), false);
  assert.equal(evidencePackage.events.length, 1);
  const anonymous = createEvidenceExport(state, { includeLabels: false });
  assert.equal(anonymous.profiles[0].label, undefined);

  const backup = createClassroomBackup(state);
  assert.equal(backup.type, CLASSROOM_PACKAGE_TYPE);
  assert.equal(backup.data.settings.teacherPinHash, "");
  assert.equal(backup.data.settings.teacherAccessConfigured, false);
  assert.equal(validateClassroomPackage(backup, CLASSROOM_PACKAGE_TYPE).valid, true);
});

test("complete backups optionally preserve sanitised application state and restore it only in replace mode", () => {
  const current = upsertProfile(createClassroomState(), { id: "current", label: "Current" });
  const incoming = upsertProfile(createClassroomState(), { id: "incoming", label: "Incoming" });
  const applicationData = JSON.parse(JSON.stringify({
    preferences: { challenge: 0, support: 100, preferences: { largerText: true } },
    learningState: { "fractions:equivalence": { attempts: 3, score: 0.5 } },
    generatorHistory: [{ family: "fractions", seed: "α" }],
    activeSession: { id: "active-one", answer: "3/8", selectedChoice: "⅜" },
    lastSession: { id: "complete-one", summary: "line one\nline two" },
    ignoredField: { shouldNotSurvive: true },
  }));
  applicationData.preferences.__proto__ = { polluted: true };
  const backup = createClassroomBackup(incoming, { applicationData });
  assert.deepEqual(Object.keys(backup.applicationData).sort(), ["activeSession", "generatorHistory", "lastSession", "learningState", "preferences"]);
  assert.equal(Object.hasOwn(backup.applicationData.preferences, "__proto__"), false);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(validateClassroomPackage(backup, CLASSROOM_PACKAGE_TYPE).valid, true);

  const replacePreview = previewBackupRestore(current, backup, { mode: "replace" });
  assert.equal(replacePreview.hasApplicationData, true);
  assert.equal(replacePreview.applicationDataAction, "restore");
  assert.match(replacePreview.warning, /preferences.*restored/i);
  const replaced = restoreClassroomBackup(current, backup, { mode: "replace" });
  assert.deepEqual(replaced.applicationData, backup.applicationData);

  const mergePreview = previewBackupRestore(current, backup, { mode: "merge" });
  assert.equal(mergePreview.applicationDataAction, "preserve-current");
  assert.match(mergePreview.warning, /only restored in Replace mode/i);
  const merged = restoreClassroomBackup(current, backup, { mode: "merge" });
  assert.equal(merged.applicationData, null, "merge must not overwrite device-specific pupil state");

  const legacyBackup = createClassroomBackup(incoming);
  assert.equal(Object.hasOwn(legacyBackup, "applicationData"), false);
  assert.equal(restoreClassroomBackup(current, legacyBackup, { mode: "replace" }).applicationData, null);
  const hostile = { ...backup, applicationData: JSON.parse('{"preferences":{"__proto__":{"polluted":true}}}') };
  const validation = validateClassroomPackage(hostile, CLASSROOM_PACKAGE_TYPE);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /not permitted/i);
  assert.equal(Object.prototype.polluted, undefined);
});

test("backup restore previews merge/replace and never silently overwrites during merge", () => {
  let current = upsertProfile(createClassroomState(), { id: "current", label: "Current" });
  current = appendEvents(current, [event({ id: "shared", profileId: "current", index: 0 })]);
  let incoming = upsertProfile(createClassroomState(), { id: "incoming", label: "Incoming" });
  incoming = appendEvents(incoming, [
    event({ id: "shared", profileId: "incoming", index: 1 }),
    event({ id: "incoming-only", profileId: "incoming", index: 2 }),
  ]);
  const backup = createClassroomBackup(incoming);
  const mergePreview = previewBackupRestore(current, backup, { mode: "merge" });
  assert.equal(mergePreview.valid, true);
  assert.equal(mergePreview.duplicateEvents, 1);
  assert.match(mergePreview.warning, /preserved/i);
  const merged = restoreClassroomBackup(current, backup, { mode: "merge" });
  assert.equal(merged.restored, true);
  assert.deepEqual(merged.state.profiles.map((profile) => profile.id).sort(), ["current", "incoming"]);
  assert.equal(merged.state.events.length, 2);
  assert.equal(merged.state.events.find((item) => item.id === "shared").profileId, "current");

  const replacePreview = previewBackupRestore(current, backup, { mode: "replace" });
  assert.match(replacePreview.warning, /replaced/i);
  const replaced = restoreClassroomBackup(current, backup, { mode: "replace" });
  assert.deepEqual(replaced.state.profiles.map((profile) => profile.id), ["incoming"]);
  assert.equal(replaced.state.events.length, 2);

  const capped = restoreClassroomBackup(current, backup, { mode: "merge", cap: 1, profileCap: 1 });
  assert.equal(capped.state.events.length, 1);
  assert.equal(capped.state.events[0].id, "shared", "merge capacity must preserve the current event");
  assert.equal(capped.report.rejectedForCapacity, 1);
});

test("multi-tab classroom reconciliation is deterministic, idempotent and unions every durable collection", () => {
  let left = createClassroomState({ now: "2026-08-01T09:00:00Z", settings: { lastChallenge: 24 } });
  left = upsertProfile(left, { id: "shared-profile", label: "Earlier label", groupIds: ["shared-group"], updatedAt: "2026-08-01T10:00:00Z" });
  left = upsertProfile(left, { id: "left-profile", label: "Left" });
  left = upsertGroup(left, { id: "shared-group", name: "Shared", profileIds: ["left-profile"] });
  left = upsertProfile(left, { id: "shared-profile", label: "Earlier label", groupIds: ["shared-group"], updatedAt: "2026-08-01T10:00:00Z" });
  left = upsertPreset(left, { id: "left-preset", name: "Left preset" });
  left = upsertSession(left, { id: "left-session", profileIds: ["left-profile"], startedAt: "2026-08-01T10:00:00Z" });
  left = upsertNote(left, { id: "left-note", subjectType: "profile", subjectId: "left-profile", text: "Left note" });
  left = appendEvents(left, [event({ id: "left-event", profileId: "left-profile", index: 1 })]);
  left = { ...left, recentSessionIds: ["left-session"], meta: { ...left.meta, updatedAt: "2026-08-01T11:00:00Z" } };

  let right = createClassroomState({ now: "2026-08-01T09:00:00Z", settings: { lastChallenge: 86, largerText: true } });
  right = upsertProfile(right, { id: "shared-profile", label: "Newer label", groupIds: ["right-group"], updatedAt: "2026-08-02T10:00:00Z" });
  right = upsertProfile(right, { id: "right-profile", label: "Right" });
  right = upsertGroup(right, { id: "shared-group", name: "Shared", profileIds: ["right-profile"] });
  right = upsertGroup(right, { id: "right-group", name: "Right group", profileIds: ["shared-profile"] });
  right = upsertProfile(right, { id: "shared-profile", label: "Newer label", groupIds: ["right-group"], updatedAt: "2026-08-02T10:00:00Z" });
  right = upsertPreset(right, { id: "right-preset", name: "Right preset" });
  right = upsertSession(right, { id: "right-session", profileIds: ["right-profile"], startedAt: "2026-08-02T10:00:00Z" });
  right = upsertNote(right, { id: "right-note", subjectType: "profile", subjectId: "right-profile", text: "Right note" });
  right = appendEvents(right, [event({ id: "right-event", profileId: "right-profile", index: 2 })]);
  right = { ...right, recentSessionIds: ["right-session"], meta: { ...right.meta, updatedAt: "2026-08-02T11:00:00Z" } };

  const leftRight = mergeClassroomStates(left, right);
  const rightLeft = mergeClassroomStates(right, left);
  assert.deepEqual(leftRight, rightLeft, "tab arrival order must not change the reconciled state");
  assert.deepEqual(mergeClassroomStates(leftRight, leftRight), leftRight, "reapplying a storage event must be a no-op");
  assert.deepEqual(leftRight.profiles.map((item) => item.id).sort(), ["left-profile", "right-profile", "shared-profile"]);
  assert.deepEqual(leftRight.groups.map((item) => item.id).sort(), ["right-group", "shared-group"]);
  assert.ok(leftRight.presets.some((item) => item.id === "left-preset"));
  assert.ok(leftRight.presets.some((item) => item.id === "right-preset"));
  assert.deepEqual(leftRight.sessions.map((item) => item.id).sort(), ["left-session", "right-session"]);
  assert.deepEqual(leftRight.notes.map((item) => item.id).sort(), ["left-note", "right-note"]);
  assert.deepEqual(leftRight.events.map((item) => item.id).sort(), ["left-event", "right-event"]);
  assert.deepEqual(leftRight.recentSessionIds, ["left-session", "right-session"]);
  assert.equal(leftRight.profiles.find((item) => item.id === "shared-profile").label, "Newer label");
  assert.deepEqual(leftRight.profiles.find((item) => item.id === "shared-profile").groupIds, ["right-group", "shared-group"]);
  assert.deepEqual(leftRight.groups.find((item) => item.id === "shared-group").profileIds, ["left-profile", "right-profile"]);
  assert.equal(leftRight.settings.lastChallenge, 86);
  assert.equal(leftRight.settings.largerText, true);
});

test("CSV summary is calm, escaped and includes evidence rather than rankings", () => {
  let state = upsertProfile(createClassroomState(), { id: "p1", label: "Smith, Ada" });
  state = appendEvents(state, [event({ id: "e1", profileId: "p1", index: 1 })]);
  const csv = createCsvSummary(state, { now: BASE + DAY });
  assert.match(csv, /^Profile,Strand,Subskill,Evidence state/);
  assert.match(csv, /"Smith, Ada"/);
  assert.match(csv, /multiplication,derived facts/);
  assert.equal(csv.includes("Rank"), false);
  assert.equal(csv.includes("Speed"), false);
});

test("CSV cells neutralise spreadsheet formulas after optional leading whitespace", () => {
  for (const attack of ["=HYPERLINK(\"https://example.test\")", "+1+1", "-2+3", "@SUM(A1:A2)", "  =cmd|' /C calc'!A0"]) {
    const escaped = csvCell(attack);
    const unquoted = escaped.startsWith('"') ? escaped.slice(1, -1).replaceAll('""', '"') : escaped;
    assert.equal(unquoted.startsWith("'"), true, attack);
  }
  let state = upsertProfile(createClassroomState(), { id: "formula-profile", label: "=HYPERLINK(evil)" });
  state = appendEvents(state, [event({ id: "formula-event", profileId: "formula-profile" })]);
  assert.match(createCsvSummary(state), /'=HYPERLINK\(evil\)/);
});
