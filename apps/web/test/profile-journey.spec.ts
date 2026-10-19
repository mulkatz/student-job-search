import { emptyState, ingestObservation } from "@job-search/discovery";
import { expect, test } from "@playwright/test";
import { deleteApp } from "firebase-admin/app";
import { z } from "zod";
import {
  createEmulatorServices,
  persistSharedJobs,
} from "../../../packages/server/dist/emulator.js";
import { profileStateSchema } from "../../../packages/server/dist/profile-schema.js";
import {
  matchingJob,
  syntheticPdf,
} from "../../../packages/server/test/profile-fixtures.js";

test("synthetic PDF upload, provenance correction, immutable approval, private matching, export and deletion", async ({
  page,
  context,
}) => {
  const services = createEmulatorServices();
  const positive = matchingJob(Date.now() - 3_600_000);
  positive.observation.sourceId = "synthetic-matching-positive";
  positive.observation.sourceRecordId = "supported-data-analysis";
  if (!positive.observation.title)
    throw new Error("Synthetic positive needs evidenced title");
  positive.observation.title.value = "Synthetic Data Analysis Assistant";
  positive.observation.title.evidence.quote = positive.observation.title.value;
  try {
    await persistSharedJobs(services.firestore, [
      ingestObservation(emptyState(), positive.observation).job,
    ]);
  } finally {
    await deleteApp(services.app);
  }
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/*", async (route) => {
    const hostname = new URL(route.request().url()).hostname;
    if (!["127.0.0.1", "localhost"].includes(hostname)) {
      externalRequests.push(hostname);
      await route.abort();
    } else await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in to local demo" }).click();
  const panel = page.getByRole("region", { name: "Private synthetic profile" });
  await expect(panel).toBeVisible();
  await expect(page.getByRole("row").nth(1).getByRole("heading")).toHaveText(
    "Working Student — Analytics",
  );
  await panel
    .getByRole("checkbox", { name: /This PDF contains synthetic test facts/ })
    .check();
  await panel
    .getByLabel("Synthetic PDF (maximum 2 MiB, 10 pages)")
    .setInputFiles({
      name: "synthetic-profile.pdf",
      mimeType: "application/pdf",
      buffer: syntheticPdf(),
    });
  await panel.getByRole("button", { name: "Upload synthetic PDF" }).click();
  await expect(
    panel.getByRole("heading", { name: "Review extracted draft" }),
  ).toBeVisible();
  await expect(
    panel.getByText("PDF page 1: Skill: Analytics", { exact: true }),
  ).toBeVisible();
  await panel.getByLabel("Fact 2 value", { exact: true }).fill("Data analysis");
  await panel
    .getByLabel("Correction explanation")
    .fill("Explicit synthetic correction from Analytics to Data analysis.");
  await panel.getByRole("button", { name: "Save corrected draft" }).click();
  await expect(panel.getByText(/draft revision 1/)).toBeVisible();
  await panel
    .getByRole("checkbox", { name: /I reviewed these synthetic facts/ })
    .check();
  await panel.getByRole("button", { name: "Approve profile version" }).click();
  const firstVersion = await panel
    .getByTestId("active-profile-version")
    .textContent();
  expect(firstVersion).toMatch(/^[a-f0-9]{64}$/);
  await panel.getByRole("button", { name: "Match discoveries" }).click();
  const supported = page.getByRole("row").filter({
    has: page.getByRole("heading", {
      name: "Synthetic Data Analysis Assistant",
      exact: true,
    }),
  });
  await expect(
    supported
      .locator(".job-row > div")
      .nth(2)
      .getByText("100/100", { exact: true }),
  ).toBeVisible();
  await expect(
    supported
      .locator(".job-row > div")
      .nth(2)
      .getByText("eligible", { exact: true }),
  ).toBeVisible();
  await expect(
    supported
      .locator(".job-row > div")
      .nth(2)
      .getByText("Evidence confidence: 100%", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("row").nth(1).getByRole("heading")).toHaveText(
    "Synthetic Data Analysis Assistant",
  );
  await supported.getByText("Evidence & details", { exact: true }).click();
  await expect(
    supported.getByText("Complete language requirements", { exact: true }),
  ).toBeVisible();
  await expect(
    supported
      .getByText(
        "English is the only required working language. No other languages are required.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await expect(
    supported.getByText("Complete work arrangements", { exact: true }),
  ).toBeVisible();
  await expect(
    supported.getByText("on site · Berlin, DE", { exact: true }),
  ).toBeVisible();
  const row = page.getByRole("row").filter({
    has: page.getByRole("heading", {
      name: "Working Student — Analytics",
      exact: true,
    }),
  });
  await expect(
    row
      .locator(".job-row > div")
      .nth(2)
      .getByText("needs review", { exact: true }),
  ).toBeVisible();
  await row.getByText("Evidence & details", { exact: true }).click();
  await expect(
    row.getByText("language requirements incomplete · unknown", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(row.getByText(/Evidence confidence:/).first()).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("profile-review.png"),
    fullPage: true,
  });
  await panel.getByLabel("Fact 2 value", { exact: true }).fill("Analytics");
  await panel
    .getByLabel("Correction explanation")
    .fill("Second explicit synthetic correction; preserve the first approval.");
  await panel.getByRole("button", { name: "Save corrected draft" }).click();
  await expect(panel.getByText(/draft revision 2/)).toBeVisible();
  await panel
    .getByRole("checkbox", { name: /I reviewed these synthetic facts/ })
    .check();
  await panel.getByRole("button", { name: "Approve profile version" }).click();
  await expect(panel.getByTestId("active-profile-version")).not.toHaveText(
    firstVersion ?? "",
  );
  await expect(
    row.getByText("Stale · profile or job version changed", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Export my local data" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    expect(Buffer.isBuffer(chunk)).toBe(true);
    chunks.push(Buffer.from(chunk));
  }
  const exported = z
    .object({
      profile: profileStateSchema,
      files: z.array(z.object({ base64: z.string() })),
    })
    .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  expect(exported.profile.versions).toHaveLength(2);
  expect(
    exported.profile.versions[0]?.facts.find(
      (fact) => fact.category === "skill",
    )?.value,
  ).toBe("Data analysis");
  expect(
    exported.profile.versions[1]?.facts.find(
      (fact) => fact.category === "skill",
    )?.value,
  ).toBe("Analytics");
  expect(exported.profile.versions[0]?.id).toBe(firstVersion);
  expect(Buffer.from(exported.files[0]?.base64 ?? "", "base64")).toEqual(
    syntheticPdf(),
  );
  await panel
    .getByRole("checkbox", {
      name: "Delete my local PDFs, drafts, profile history and evaluations.",
    })
    .check();
  await panel.getByRole("button", { name: "Delete my local data" }).click();
  await expect(
    page.getByText(
      "Local profile deletion complete. Sign out to end this session.",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("active-profile-version")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to view discoveries" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(context.pages()).toHaveLength(1);
});
