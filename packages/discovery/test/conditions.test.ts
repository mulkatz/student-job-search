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
  for (const key of [
    "languageRequirements",
    "employmentOptions",
    "workArrangements",
    "additionalRequirements",
  ])
    assert.ok(!(key in parsed));
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

test("complete source condition lists are strict, bounded and quoted without defaults", () => {
  const legacy = syntheticObservation();
  const evidence = {
    url: legacy.originalUrl,
    quote:
      "English B2 and German, or Russian fluent. Part-time 8-12 hours on site in Leipzig, Germany. No further mandatory requirements.",
    selector: "p.conditions",
  };
  const requirement = { language: "English", minimumLevel: "B2", evidence };
  const source = {
    ...legacy,
    languageRequirements: {
      status: "complete",
      alternatives: [
        [
          requirement,
          { ...requirement, language: "German", minimumLevel: null },
        ],
        [{ ...requirement, language: "Russian", minimumLevel: "fluent" }],
      ],
      evidence,
    },
    employmentOptions: {
      status: "complete",
      options: [
        {
          employmentType: "part_time",
          weeklyHours: { minimum: 8, maximum: 12, flexibleWithinRange: false },
          evidence,
        },
      ],
      evidence,
    },
    workArrangements: {
      status: "complete",
      arrangements: [
        { mode: "on_site", city: "Leipzig", countryCode: "DE", evidence },
      ],
      evidence,
    },
    additionalRequirements: { status: "none", evidence },
  };
  assert.ok(observationSchema.safeParse(source).success);
  assert.notEqual(
    revisionIdentity(observationSchema.parse(source)),
    revisionIdentity(legacy),
  );
  const bad: [string, unknown][] = [
    [
      "languageRequirements",
      { status: "complete", alternatives: [], evidence },
    ],
    [
      "languageRequirements",
      {
        status: "complete",
        alternatives: [[requirement, requirement]],
        evidence,
      },
    ],
    [
      "languageRequirements",
      {
        status: "complete",
        alternatives: Array(6).fill([requirement]),
        evidence,
      },
    ],
    [
      "languageRequirements",
      {
        status: "complete",
        alternatives: [[{ ...requirement, minimumLevel: "native" }]],
        evidence,
      },
    ],
    [
      "languageRequirements",
      {
        status: "complete",
        alternatives: [[{ language: "German", minimumLevel: null }]],
        evidence,
      },
    ],
    [
      "languageRequirements",
      { status: "unknown", alternatives: [[requirement]] },
    ],
    [
      "employmentOptions",
      {
        status: "complete",
        options: [
          {
            employmentType: "part_time",
            weeklyHours: {
              minimum: 12,
              maximum: 8,
              flexibleWithinRange: false,
            },
            evidence,
          },
        ],
        evidence,
      },
    ],
    [
      "employmentOptions",
      {
        status: "complete",
        options: [
          {
            employmentType: "part_time",
            weeklyHours: { minimum: 8, maximum: 12 },
            evidence,
          },
        ],
        evidence,
      },
    ],
    [
      "workArrangements",
      {
        status: "complete",
        arrangements: [
          { mode: "remote", allowedCountries: ["DE", "DE"], evidence },
        ],
        evidence,
      },
    ],
    [
      "workArrangements",
      {
        status: "complete",
        arrangements: [{ mode: "remote", allowedCountries: ["de"], evidence }],
        evidence,
      },
    ],
    [
      "workArrangements",
      {
        status: "complete",
        arrangements: [{ mode: "on_site", city: "Leipzig", evidence }],
        evidence,
      },
    ],
    ["additionalRequirements", { status: "none" }],
    ["additionalRequirements", { status: "none", evidence, guessed: true }],
  ];
  for (const [field, value] of bad)
    assert.equal(
      observationSchema.safeParse({ ...legacy, [field]: value }).success,
      false,
      field,
    );
});
