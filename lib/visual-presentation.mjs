/**
 * Plan number-line labels without duplicating endpoint values or exposing an
 * endpoint that the pupil is meant to supply. Kept pure so screen rendering can
 * share a deterministic regression contract.
 * @param {{ min?: number, max?: number, markers?: number[], unknown?: number | null }} options
 */
export function numberLineLabelPlan({ min = 0, max = 1, markers = [], unknown = null } = {}) {
  const safeMin = Number(min);
  const safeMax = Number(max);
  const span = Math.max(0.0001, safeMax - safeMin);
  const samePosition = (first, second) => Math.abs(Number(first) - Number(second)) <= Math.max(1, Math.abs(span)) * 1e-9;
  const unknownIndex = Number.isInteger(unknown) && unknown >= 0 && unknown < markers.length ? unknown : null;
  const unknownMarker = unknownIndex === null ? null : Number(markers[unknownIndex]);
  const unknownAtMin = unknownMarker !== null && samePosition(unknownMarker, safeMin);
  const unknownAtMax = unknownMarker !== null && samePosition(unknownMarker, safeMax);

  return {
    span,
    unknownAtMin,
    unknownAtMax,
    markers: markers.map((marker, index) => {
      const value = Number(marker);
      const isEndpoint = samePosition(value, safeMin) || samePosition(value, safeMax);
      return {
        value,
        isEndpoint,
        isUnknown: index === unknownIndex,
        showLabel: !isEndpoint,
        position: Math.max(0, Math.min(100, ((value - safeMin) / span) * 100)),
      };
    }),
  };
}
