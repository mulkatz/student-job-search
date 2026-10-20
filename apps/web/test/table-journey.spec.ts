import { expect, test } from "@playwright/test";
import { syntheticPdf } from "../../../packages/server/test/profile-fixtures.js";

test("compact table keeps evidence on demand and persists reversible owner status without a profile", async ({
  page,
  context,
}) => {
  const external: string[] = [];
  const mutations: string[] = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!["127.0.0.1", "localhost"].includes(new URL(request.url()).hostname)) {
      external.push(request.url());
      await route.abort();
    } else {
      if (request.method() !== "GET" && request.url().includes("/api/"))
        mutations.push(new URL(request.url()).pathname);
      await route.continue();
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in to local demo" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveCount(9);
  await expect(
    page.getByRole("region", { name: "Private synthetic profile" }),
  ).not.toBeVisible();
  const group = page.locator("tbody.job-group").first();
  const row = group.locator(".job-row");
  await expect(row.getByRole("cell")).toHaveCount(9);
  await expect(group.locator(".job-evidence")).toHaveCount(0);
  await expect(
    row.getByRole("link", { name: "Apply", exact: true }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    row.getByRole("button", { name: "View Draft", exact: true }),
  ).toBeEnabled();
  const fit = row.locator(".fit-trigger");
  await fit.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText(
    "not a hiring probability",
  );
  await fit.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await row.getByRole("button", { name: "Ignore", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Ignore", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(group).toHaveClass(/is-ignored/);
  await row.getByRole("button", { name: "View Draft", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Application draft" });
  await expect(dialog.getByLabel("Manual application status")).toHaveValue(
    "ignored",
  );
  await dialog.getByRole("button", { name: "Close application draft" }).click();
  await expect(
    row.getByRole("button", { name: "Ignore", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "Applied", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Applied", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    row.getByRole("button", { name: "Ignore", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(group).not.toHaveClass(/is-ignored/);
  await row.getByRole("button", { name: "Applied", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Applied", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await row.getByRole("button", { name: "Evidence & details" }).click();
  await expect(group.locator(".job-evidence")).toBeVisible();
  await expect(group.locator(".job-evidence")).toContainText(
    "Industry unknown: no sourced fact",
  );
  await row.getByRole("button", { name: "Evidence & details" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const scroll = page.getByRole("region", { name: "Discovered jobs" });
  expect(
    await scroll.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await fit.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  const bounds = await page.getByRole("tooltip").boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  expect(mutations.every((path) => path === "/api/applications/status")).toBe(
    true,
  );
  expect(external).toEqual([]);
});

test("guided private profile UI confirms questionnaire facts before a mocked bounded search", async ({
  page,
}) => {
  const questionnaireFacts: unknown[] = [];
  const consent: string[] = [];
  let searchStarted = false;
  await page.route("**/src/runtime.ts", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text())
        .replace("local: true", "local: false")
        .replace("realProfileProcessing: false", "realProfileProcessing: true"),
    });
  });
  await page.route("**/api/search-runs", async (route) => {
    if (route.request().method() === "POST") {
      searchStarted = true;
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: {
          run: {
            id: "11111111-1111-4111-8111-111111111111",
            status: "limited",
            profileVersionId: body.expectedActiveVersionId,
            target: 30,
            displayedJobs: 0,
            observations: 0,
            searchRequests: 0,
            httpRequests: 0,
            reason: "synthetic_ui_test",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } else await route.fulfill({ json: { run: null } });
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/api/profile/draft"))
      questionnaireFacts.push(request.postDataJSON().facts);
    if (request.url().endsWith("/api/profile/upload"))
      consent.push(request.headers()["x-applicant-consent"] ?? "missing");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Run 30-job dry run" }),
  ).toBeDisabled();
  await page.locator(".profile-disclosure > summary").click();
  const panel = page.getByRole("region", {
    name: "Private profile",
    exact: true,
  });
  await panel
    .getByRole("checkbox", { name: /I consent to private processing/ })
    .check();
  await panel.getByLabel(/CV or work\/project-list PDFs/).setInputFiles({
    name: "synthetic-work-list.pdf",
    mimeType: "application/pdf",
    buffer: syntheticPdf(),
  });
  await panel.getByRole("button", { name: "Upload profile documents" }).click();
  const questionnaire = panel.getByRole("region", {
    name: "2. Confirm your search profile",
  });
  await expect(questionnaire).toBeVisible();
  await questionnaire.getByLabel("Language", { exact: true }).fill("English");
  await questionnaire
    .getByRole("combobox", { name: "Level", exact: true })
    .selectOption("C1");
  await questionnaire.getByRole("button", { name: "Add language" }).click();
  await questionnaire
    .getByLabel("Language", { exact: true })
    .nth(1)
    .fill("German");
  await questionnaire
    .getByRole("combobox", { name: "Level", exact: true })
    .nth(1)
    .selectOption("not spoken");
  await questionnaire.getByLabel("Available hours per week").fill("12");
  await questionnaire
    .getByRole("checkbox", { name: "Working student", exact: true })
    .check();
  await questionnaire
    .getByRole("checkbox", { name: "On-site Berlin, Germany", exact: true })
    .check();
  await questionnaire
    .getByRole("checkbox", { name: "Remote from Germany", exact: true })
    .check();
  await questionnaire
    .getByLabel(/Desired roles, industries/)
    .fill("Hospitality and barista");
  await questionnaire
    .getByRole("checkbox", { name: /I confirm these answers/ })
    .check();
  await questionnaire
    .getByRole("button", { name: "Save questionnaire answers" })
    .click();
  await expect(panel.getByText(/draft revision 1/)).toBeVisible();
  expect(questionnaireFacts.at(-1)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        category: "working_language",
        value: "German not spoken",
      }),
      expect.objectContaining({
        category: "search_preference",
        value: "Hospitality and barista",
      }),
    ]),
  );
  expect(questionnaireFacts.at(-1)).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ category: "work_authorization" }),
    ]),
  );
  expect(consent).toEqual(["reviewed-private-processing"]);
  await expect(
    page.getByRole("button", { name: "Run 30-job dry run" }),
  ).toBeDisabled();
  await panel.getByRole("checkbox", { name: /I reviewed these facts/ }).check();
  await panel.getByRole("button", { name: "Approve profile version" }).click();
  await expect(
    page.getByRole("button", { name: "Run 30-job dry run" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Run 30-job dry run" }).click();
  await expect(
    page.getByText(/Search finished within available sources/),
  ).toBeVisible();
  expect(searchStarted).toBe(true);
});
