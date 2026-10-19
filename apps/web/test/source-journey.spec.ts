import { expect, test } from "@playwright/test";
import { readPrivateDiscoveryJobs } from "../../../packages/server/dist/import-jobs.js";

test("explicit private source projection renders with authenticated evidence and sign-out", async ({
  page,
  context,
}) => {
  const fixturePath = process.env.G4_SOURCE_FIXTURE_PATH;
  if (!fixturePath)
    throw new Error("Source journey requires G4_SOURCE_FIXTURE_PATH");
  const jobs = await readPrivateDiscoveryJobs(fixturePath);
  const job = jobs.find((value) => {
    const hostname = new URL(value.observation.originalUrl).hostname;
    return (
      value.observation.kind === "vacancy_detail" &&
      !value.sourceId.startsWith("synthetic-") &&
      hostname !== "example" &&
      !hostname.endsWith(".example") &&
      !hostname.endsWith(".invalid") &&
      !hostname.endsWith(".test") &&
      !["example.com", "example.org", "example.net"].some(
        (reserved) =>
          hostname === reserved || hostname.endsWith(`.${reserved}`),
      ) &&
      value.observation.title &&
      value.observation.employer
    );
  });
  if (!job?.observation.title || !job.observation.employer)
    throw new Error(
      "Source journey needs an actual vacancy detail with evidenced title and employer",
    );
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
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in to local demo" }).click();
  const row = page
    .getByRole("row")
    .filter({
      has: page.getByRole("heading", {
        name: job.observation.title.value,
        exact: true,
      }),
    })
    .filter({ hasText: job.observation.employer.value })
    .first();
  await expect(row).toBeVisible();
  await expect(
    row.getByText("Source observation", { exact: true }),
  ).toBeVisible();
  const employerColumn = row.locator(".job-row > div").nth(1);
  await expect(employerColumn).toBeVisible();
  await expect(employerColumn).toContainText(job.observation.employer.value);
  await expect(row.getByText("Unavailable", { exact: true })).toBeVisible();
  await expect(
    row.getByText("Matching is not available yet", { exact: true }),
  ).toBeVisible();
  const original = row.getByRole("link", { name: "Original posting" });
  await expect(original).toHaveAttribute(
    "href",
    new URL(job.observation.originalUrl).href,
  );
  await expect(original).toHaveAttribute("rel", "noopener noreferrer");
  await row.getByText("Evidence & details", { exact: true }).click();
  for (const { label, field } of [
    { label: "Title", field: job.observation.title },
    { label: "Employer", field: job.observation.employer },
  ]) {
    const evidence = row
      .locator(".evidence")
      .filter({ has: page.getByText(label, { exact: true }) })
      .first();
    await expect(evidence.locator("blockquote")).toHaveText(
      field.evidence.quote,
    );
    await expect(
      evidence.getByRole("link", { name: "Source evidence" }),
    ).toHaveAttribute("href", new URL(field.evidence.url).href);
    await expect(
      evidence.getByText(`Locator: ${field.evidence.selector}`, {
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(
    row.getByText(`Revision: ${job.currentRevisionId}`, { exact: true }),
  ).toBeVisible();
  await expect(
    row.getByText(`Source: ${job.sourceId}`, { exact: true }),
  ).toBeVisible();
  const provenance = job.observation.discoveryProvenance;
  if (provenance?.kind === "parent_anchor") {
    await expect(
      row.getByText(`Parent record: ${provenance.parentSourceRecordId}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      row.getByRole("link", { name: "Parent page evidence" }),
    ).toHaveAttribute("href", new URL(provenance.evidence.url).href);
    await expect(
      row.getByText(provenance.evidence.quote, { exact: true }).last(),
    ).toBeVisible();
  } else if (
    provenance?.kind === "search_result" ||
    provenance?.kind === "brave_search_result"
  ) {
    await expect(
      row.getByText(`Search query reference: ${provenance.queryRef}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      row.getByText(`Search result reference: ${provenance.resultRef}`, {
        exact: true,
      }),
    ).toBeVisible();
  }
  if (
    job.observation.englishAccepted.status === "unknown" ||
    job.observation.remoteFromGermany.status === "unknown"
  )
    await expect(
      row.getByText("Unknown · confirmation needed").first(),
    ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign in to local demo" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(context.pages()).toHaveLength(1);
});
