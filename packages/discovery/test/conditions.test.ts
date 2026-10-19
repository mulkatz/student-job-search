import assert from "node:assert/strict";
import test from "node:test";
import { syntheticObservation } from "../src/fixture.js";
import { revisionIdentity } from "../src/model.js";
import { observationSchema } from "../src/schema.js";

test("optional hours/authorization evidence preserves legacy hashes and rejects unsupported source claims", () => {
  const legacy = syntheticObservation();
  const parsed = observationSchema.parse(legacy);
  assert.ok(!("weeklyHours" in parsed));
  assert.ok(!("workAuthorization" in parsed));
  assert.equal(revisionIdentity(parsed), revisionIdentity(legacy));
  const evidence = {
    url: legacy.originalUrl,
    quote:
      "Requires 7.5 to 15.5 weekly hours and existing German employee-work permission",
    selector: "p.conditions",
  };
  const supported = observationSchema.parse({
    ...legacy,
    weeklyHours: { status: "confirmed", minimum: 7.5, maximum: 15.5, evidence },
    workAuthorization: {
      status: "confirmed",
      requirement: "employee_work_in_germany",
      evidence,
    },
  });
  assert.notEqual(revisionIdentity(supported), revisionIdentity(legacy));
  for (const weeklyHours of [
    { status: "confirmed", minimum: 16, maximum: 8, evidence },
    { status: "confirmed", minimum: 0, maximum: 8, evidence },
    { status: "confirmed", minimum: 8, maximum: 169, evidence },
    { status: "confirmed", minimum: 8, maximum: 16 },
    { status: "unknown", value: 12 },
  ])
    assert.equal(
      observationSchema.safeParse({ ...legacy, weeklyHours }).success,
      false,
    );
  assert.equal(
    observationSchema.safeParse({
      ...legacy,
      workAuthorization: {
        status: "confirmed",
        requirement: "assume_all_candidates_eligible",
        evidence,
      },
    }).success,
    false,
  );
});
