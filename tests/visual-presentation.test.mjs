import assert from "node:assert/strict";
import test from "node:test";

import { numberLineLabelPlan } from "../lib/visual-presentation.mjs";

test("known number-line endpoints are labelled once by the endpoint row", () => {
  const plan = numberLineLabelPlan({ min: 800, max: 1600, markers: [800, 1200, 1600] });
  assert.deepEqual(plan.markers.map((marker) => marker.showLabel), [false, true, false]);
  assert.deepEqual(plan.markers.map((marker) => marker.position), [0, 50, 100]);
  assert.equal(plan.unknownAtMin, false);
  assert.equal(plan.unknownAtMax, false);
});

test("an unknown endpoint is concealed while its marker remains classified", () => {
  const start = numberLineLabelPlan({ min: 800, max: 1600, markers: [800, 1200], unknown: 0 });
  assert.equal(start.unknownAtMin, true);
  assert.equal(start.markers[0].isEndpoint, true);
  assert.equal(start.markers[0].isUnknown, true);
  assert.equal(start.markers[0].showLabel, false);

  const end = numberLineLabelPlan({ min: 800, max: 1600, markers: [1200, 1600], unknown: 1 });
  assert.equal(end.unknownAtMax, true);
  assert.equal(end.markers[1].isEndpoint, true);
  assert.equal(end.markers[1].isUnknown, true);
  assert.equal(end.markers[1].showLabel, false);
});
