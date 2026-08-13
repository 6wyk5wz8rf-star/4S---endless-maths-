const PARTICIPANT_KINDS = new Set(["guest", "profile", "group"]);

function cleanProfileIds(profileIds, availableProfileIds) {
  const allowed = Array.isArray(availableProfileIds) ? new Set(availableProfileIds.map(String)) : null;
  return Array.from(new Set((Array.isArray(profileIds) ? profileIds : []).map(String)))
    .filter((profileId) => profileId && (!allowed || allowed.has(profileId)));
}

export function normaliseParticipantSelection(selection, availableProfileIds) {
  const profileIds = cleanProfileIds(selection?.profileIds, availableProfileIds);
  const kind = PARTICIPANT_KINDS.has(selection?.participantKind) ? selection.participantKind : "guest";
  if (kind === "profile" && profileIds.length === 1) {
    return { participantKind: "profile", profileIds, evidenceProfileId: profileIds[0] };
  }
  if (kind === "group" && profileIds.length > 0) {
    return { participantKind: "group", profileIds, evidenceProfileId: null };
  }
  return { participantKind: "guest", profileIds: [], evidenceProfileId: null };
}

export function restoreParticipantSelection(snapshot, availableProfileIds) {
  const explicit = normaliseParticipantSelection(snapshot, availableProfileIds);
  if (snapshot?.participantKind === "profile"
    && explicit.participantKind === "profile"
    && String(snapshot?.evidenceProfileId ?? "") === explicit.profileIds[0]) return explicit;
  if (snapshot?.participantKind === "group" && explicit.participantKind === "group") return explicit;
  if (snapshot?.participantKind === "guest" && explicit.participantKind === "guest") return explicit;

  // Older snapshots did not distinguish a one-pupil group from an individual.
  // Preserve the practice, but fail closed for individual evidence.
  const profileIds = cleanProfileIds(snapshot?.profileIds, availableProfileIds);
  return profileIds.length
    ? { participantKind: "group", profileIds, evidenceProfileId: null }
    : { participantKind: "guest", profileIds: [], evidenceProfileId: null };
}

export function evidenceProfileForSession(session, boardMode = false) {
  if (boardMode || session?.participantKind !== "profile") return null;
  const profileIds = cleanProfileIds(session?.profileIds);
  const evidenceProfileId = String(session?.evidenceProfileId ?? "");
  return profileIds.length === 1 && profileIds[0] === evidenceProfileId ? evidenceProfileId : null;
}

export function isPracticeLinkRoute(value) {
  return /(?:^|[?#&])y4f=/.test(String(value ?? ""));
}

export function clearPracticeLinkRoute(locationLike, historyLike) {
  const route = `${locationLike?.search ?? ""}${locationLike?.hash ?? ""}`;
  if (!isPracticeLinkRoute(route) || typeof historyLike?.replaceState !== "function") return false;
  historyLike.replaceState(null, "", locationLike?.pathname || "./");
  return true;
}
