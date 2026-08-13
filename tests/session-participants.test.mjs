import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  clearPracticeLinkRoute,
  evidenceProfileForSession,
  isPracticeLinkRoute,
  normaliseParticipantSelection,
  restoreParticipantSelection,
} from "../lib/session-participants.mjs";

test("a one-pupil group remains group practice and cannot create individual evidence", () => {
  const participants = normaliseParticipantSelection({ participantKind: "group", profileIds: ["pupil-1"], groupId: "group-1" }, ["pupil-1"]);
  assert.deepEqual(participants, { participantKind: "group", profileIds: ["pupil-1"], evidenceProfileId: null });
  assert.equal(evidenceProfileForSession(participants), null);
});

test("an explicitly selected pupil is the only participant kind eligible for evidence", () => {
  const participants = normaliseParticipantSelection({ participantKind: "profile", profileIds: ["pupil-1"] }, ["pupil-1"]);
  assert.deepEqual(participants, { participantKind: "profile", profileIds: ["pupil-1"], evidenceProfileId: "pupil-1" });
  assert.equal(evidenceProfileForSession(participants), "pupil-1");
  assert.equal(evidenceProfileForSession(participants, true), null, "Class view must never create pupil evidence");
});

test("archived or missing pupils fail closed to Guest and legacy snapshots never fabricate individual evidence", () => {
  assert.deepEqual(
    restoreParticipantSelection({ participantKind: "profile", profileIds: ["archived"], evidenceProfileId: "archived" }, ["active"]),
    { participantKind: "guest", profileIds: [], evidenceProfileId: null },
  );
  assert.deepEqual(
    restoreParticipantSelection({ profileIds: ["pupil-1"] }, ["pupil-1"]),
    { participantKind: "group", profileIds: ["pupil-1"], evidenceProfileId: null },
    "Older one-ID sessions are ambiguous and must resume without individual evidence",
  );
});

test("shared-practice routes are cleared without touching ordinary routes", () => {
  const calls = [];
  const history = { replaceState: (...args) => calls.push(args) };
  assert.equal(isPracticeLinkRoute("?y4f=%7B%7D"), true);
  assert.equal(clearPracticeLinkRoute({ search: "?y4f=%7B%7D", hash: "", pathname: "/4S/" }, history), true);
  assert.deepEqual(calls, [[null, "", "/4S/"]]);
  assert.equal(clearPracticeLinkRoute({ search: "?theme=paper", hash: "#help", pathname: "/4S/" }, history), false);
  assert.equal(calls.length, 1);
});

test("shared practice preserves a resumable session and starts as Guest", async () => {
  const source = await readFile(new URL("../app/FluencyApp.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!restoredResume\) setScreen\("share"\)/, "a valid link must not mask Continue after a refresh");
  assert.match(source, /const begin = [\s\S]*?clearPracticeLinkRoute\(window\.location, window\.history\);[\s\S]*?removeLocalKeys\(ACTIVE_SESSION_KEY\)/, "the link route must clear before a new session replaces the saved one");
  assert.match(source, /begin\(undefined, sharedSession\.config \?\? undefined, \{ participantKind: "guest", profileIds: \[\] \}\)/, "a shared link must not inherit private pupil identity");
  assert.match(source, /profile\.id === profileId && !profile\.archived/, "an archived profile must be rejected again at the exact evidence write");
  assert.match(source, /This link cannot be opened\./, "malformed explicit links need an honest error state");
});
