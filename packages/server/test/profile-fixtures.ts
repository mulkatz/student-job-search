import { randomUUID } from "node:crypto";
import {
  emptyState,
  ingestObservation,
  syntheticObservation,
} from "@job-search/discovery";
import { contentHash } from "../src/profile-pdf.js";
import type { ProfileFact, ProfileVersion } from "../src/profile-schema.js";

export const fixtureNow = Date.parse("2026-10-19T12:00:00.000Z");
/** Tiny ASCII PDF fixture writer, only for actual Poppler boundary tests (never application PDF output). */
export function syntheticPdf(
  pages: string[][] = [
    [
      "SYNTHETIC G5 TEST PROFILE",
      "Working language: English",
      "Skill: Analytics",
      "Employment preference: Part-time",
      "Location preference: Berlin",
      "Weekly availability hours: 16",
      "Work authorization: employee_work_in_germany",
    ],
  ],
): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const pageIds: number[] = [];
  for (const lines of pages) {
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
    );
    const text = lines.length
      ? `BT /F1 12 Tf 40 790 Td 18 TL ${lines.map((line, index) => `${index ? "T* " : ""}(${line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")}) Tj`).join("\n")} ET`
      : "";
    objects.push(
      `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n% SYNTHETIC TEST ONLY\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
export function approvedFixture(
  ownerId = "synthetic-owner",
  now = fixtureNow,
): ProfileVersion {
  const facts: ProfileFact[] = [
    {
      id: "language",
      category: "working_language",
      value: "English",
      provenance: {
        kind: "user_attestation",
        statement: "Synthetic fixture working language",
      },
    },
    {
      id: "skill",
      category: "skill",
      value: "Analytics",
      provenance: {
        kind: "user_attestation",
        statement: "Synthetic fixture skill",
      },
    },
    {
      id: "employment",
      category: "employment_preference",
      value: "Part-time",
      provenance: {
        kind: "user_attestation",
        statement: "Synthetic fixture preference",
      },
    },
    {
      id: "location",
      category: "location_preference",
      value: "Berlin",
      provenance: {
        kind: "user_attestation",
        statement: "Synthetic fixture preference",
      },
    },
    {
      id: "availability",
      category: "weekly_availability_hours",
      value: "16",
      provenance: {
        kind: "user_attestation",
        statement:
          "Synthetic fixture explicitly declares 16 available weekly hours",
      },
    },
    {
      id: "authorization",
      category: "work_authorization",
      value: "employee_work_in_germany",
      provenance: {
        kind: "user_attestation",
        statement:
          "Synthetic fixture declares existing employee-work permission in Germany; not a legal verification",
      },
    },
  ];
  return {
    id: contentHash([ownerId, "fixture"]),
    ownerId,
    draftId: randomUUID(),
    draftRevision: 0,
    facts,
    profileHash: contentHash(facts),
    sourceAssetHash: "a".repeat(64),
    approvedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 90 * 86_400_000).toISOString(),
    operationId: randomUUID(),
    approvalRequestHash: "b".repeat(64),
  };
}
export function matchingJob(now = fixtureNow) {
  const url = "https://careers.synthetic.example/jobs/student-analytics";
  return ingestObservation(
    emptyState(),
    syntheticObservation({
      observedAt: new Date(now).toISOString(),
      retentionUntil: new Date(now + 7 * 86_400_000).toISOString(),
      expiresAt: new Date(now + 3 * 86_400_000).toISOString(),
      englishAccepted: {
        status: "confirmed",
        value: true,
        evidence: { url, quote: "English is accepted", selector: "p.language" },
      },
      weeklyHours: {
        status: "confirmed",
        minimum: 8,
        maximum: 12,
        evidence: {
          url,
          quote: "The role requires between 8 and 12 weekly hours",
          selector: "p.hours",
        },
      },
      workAuthorization: {
        status: "confirmed",
        requirement: "employee_work_in_germany",
        evidence: {
          url,
          quote: "Existing permission for employee work in Germany is required",
          selector: "p.authorization",
        },
      },
    }),
  ).job;
}
