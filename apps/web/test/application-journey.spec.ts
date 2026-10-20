import { expect, test } from "@playwright/test";
import { deleteApp } from "firebase-admin/app";
import { applicationFixtureJobs } from "../../../packages/server/dist/application-fixtures.js";
import { applicationsResponseSchema } from "../../../packages/server/dist/application-schema.js";
import {
  createEmulatorServices,
  persistSharedJobs,
} from "../../../packages/server/dist/emulator.js";
import { syntheticPdf } from "../../../packages/server/test/profile-fixtures.js";

test("five synthetic email/questionnaire packages support exact review, real clipboard, immutable edits and manual status", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  const services = createEmulatorServices();
  const jobs = applicationFixtureJobs(Date.now() - 60_000);
  const errors: string[] = [];
  const external: string[] = [];
  const copies: unknown[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().endsWith("/api/applications/copy"))
      copies.push(request.postDataJSON());
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:5173",
  });
  await context.route("**/*", async (route) => {
    const hostname = new URL(route.request().url()).hostname;
    if (!["127.0.0.1", "localhost"].includes(hostname)) {
      external.push(hostname);
      await route.abort();
    } else await route.continue();
  });
  try {
    await persistSharedJobs(services.firestore, jobs);
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in to local demo" }).click();
    const panel = page.getByRole("region", {
      name: "Private synthetic profile",
    });
    await expect(panel).toBeVisible();
    const open = async (title: string) => {
      const row = page.getByRole("row").filter({
        has: page.getByRole("heading", { name: title, exact: true }),
      });
      await row.getByRole("button", { name: "View application draft" }).click();
      const dialog = page.getByRole("dialog", { name: "Application draft" });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Refresh application" }),
      ).toBeEnabled();
      return dialog;
    };
    const first = jobs[0];
    if (!first?.observation.title) throw new Error("Fixture needs title");
    let dialog = await open(first.observation.title.value);
    await expect(
      dialog.getByText(
        "Approve an immutable profile version before generating an application draft.",
      ),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: "Generate application draft",
        exact: true,
      }),
    ).toBeDisabled();
    await dialog
      .getByLabel("Manual application status")
      .selectOption("ignored");
    await expect(dialog.getByLabel("Manual application status")).toHaveValue(
      "ignored",
    );
    await dialog
      .getByRole("button", { name: "Close application draft" })
      .click();
    await panel
      .getByRole("checkbox", { name: /This PDF contains synthetic test facts/ })
      .check();
    await panel
      .getByLabel("Synthetic PDF (maximum 2 MiB, 10 pages)")
      .setInputFiles({
        name: "synthetic-application-profile.pdf",
        mimeType: "application/pdf",
        buffer: syntheticPdf(),
      });
    await panel.getByRole("button", { name: "Upload synthetic PDF" }).click();
    await expect(
      panel.getByRole("heading", { name: "Review extracted draft" }),
    ).toBeVisible();
    await panel
      .getByRole("checkbox", { name: /I reviewed these synthetic facts/ })
      .check();
    await panel
      .getByRole("button", { name: "Approve profile version" })
      .click();
    await expect(panel.getByTestId("active-profile-version")).toBeVisible();
    await panel.getByRole("button", { name: "Match discoveries" }).click();
    await expect(
      panel.getByRole("button", { name: "Match discoveries" }),
    ).toBeEnabled();

    let emailCount = 0;
    let questionnaireCount = 0;
    for (const job of jobs) {
      if (!job.observation.title) throw new Error("Fixture needs title");
      dialog = await open(job.observation.title.value);
      const generated = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/applications/generate") &&
          response.request().method() === "POST",
      );
      await dialog
        .getByRole("button", {
          name: "Generate application draft",
          exact: true,
        })
        .click();
      const response = await generated;
      expect(response.status()).toBe(200);
      const result = applicationsResponseSchema.parse(await response.json());
      const record = result.applications.find(
        (item) => item.jobId === job.jobId,
      );
      const pkg = record?.packages.find(
        (item) => item.id === record.currentPackageId,
      );
      if (!record || !pkg) throw new Error("Missing generated package");
      expect(pkg.origin).toBe("generated");
      await dialog
        .getByText("Version and evidence links", { exact: true })
        .click();
      await expect(
        dialog.getByText(pkg.contentHash, { exact: false }).first(),
      ).toBeVisible();
      await expect(
        dialog.getByRole("heading", { name: "Approved fact evidence" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("heading", { name: "Job evidence at generation" }),
      ).toBeVisible();
      expect(copies).toHaveLength(emailCount * 2 + questionnaireCount);
      const review = async () => {
        await dialog
          .getByRole("checkbox", { name: /I reviewed this exact full package/ })
          .check();
        await dialog
          .getByRole("button", { name: "Review exact package" })
          .click();
        await expect(
          dialog.getByText("Review recorded for this exact content hash."),
        ).toBeVisible();
      };
      await review();
      if (pkg.content.kind === "email") {
        emailCount += 1;
        if (emailCount === 1) {
          await dialog.evaluate((element) => {
            element.scrollTop = 0;
          });
          await page.screenshot({
            path: test.info().outputPath("email-package.png"),
          });
        }

        await expect(dialog.getByTestId("package-readiness")).toHaveText(
          "ready",
        );
        for (const [fieldId, text] of [
          ["subject", pkg.content.subject],
          ["body", pkg.content.body],
        ]) {
          if (!fieldId || !text) throw new Error("Missing email fixture text");
          await dialog
            .getByRole("button", { name: `Copy ${fieldId}`, exact: true })
            .click();
          await expect(
            dialog.getByText(`Copied ${fieldId}. You alone send or submit.`),
          ).toBeVisible();
          expect(
            await page.evaluate(() => navigator.clipboard.readText()),
          ).toBe(text);
        }
        if (emailCount === 1) {
          await dialog
            .getByText("Edit into a new immutable version", { exact: true })
            .click();
          await dialog
            .getByLabel("Edited email body", { exact: true })
            .fill("Synthetic applicant edit preserved across regeneration.");
          await page.route(
            "**/api/applications/edit",
            (route) =>
              route.fulfill({
                status: 401,
                contentType: "application/json",
                body: JSON.stringify({ error: "unauthorized" }),
              }),
            { times: 1 },
          );
          await dialog
            .getByRole("button", { name: "Save edited version" })
            .click();
          await expect(dialog.getByRole("alert")).toContainText(
            "Session expired",
          );
          await expect(
            dialog.getByLabel("Edited email body", { exact: true }),
          ).toHaveValue(
            "Synthetic applicant edit preserved across regeneration.",
          );
          await dialog
            .getByRole("button", { name: "Save edited version" })
            .click();
          await expect(dialog.getByTestId("package-readiness")).toHaveText(
            "edited_unverified",
          );
          await expect(dialog.getByTestId("answer-body")).toHaveText(
            "Synthetic applicant edit preserved across regeneration.",
          );
          await review();
          await expect(dialog.getByTestId("package-readiness")).toHaveText(
            "edited_unverified",
          );
          await expect(
            dialog.getByRole("button", { name: "Copy body", exact: true }),
          ).toBeDisabled();
          const editedId = await dialog
            .getByLabel("Package version")
            .inputValue();
          await dialog
            .getByRole("button", { name: "Regenerate new version" })
            .click();
          await expect(
            dialog.getByLabel("Package version").getByRole("option"),
          ).toHaveCount(3);
          await expect(dialog.getByLabel("Package version")).not.toHaveValue(
            editedId,
          );
          await dialog
            .getByRole("checkbox", {
              name: /I reviewed this exact full package/,
            })
            .check();
          const currentId = await dialog
            .getByLabel("Package version")
            .inputValue();
          const authorization = response.request().headers().authorization;
          if (!authorization)
            throw new Error("Expected authenticated generation");
          const parallel = await page.request.post(
            "/api/applications/generate",
            {
              headers: { Authorization: authorization },
              data: {
                jobId: job.jobId,
                expectedJobRevisionId: job.currentRevisionId,
                expectedActiveVersionId: pkg.profileVersionId,
                expectedCurrentPackageId: currentId,
                operationId: crypto.randomUUID(),
              },
            },
          );
          expect(parallel.status()).toBe(200);
          await dialog
            .getByRole("button", { name: "Refresh application" })
            .click();
          await expect(dialog.getByLabel("Package version")).not.toHaveValue(
            currentId,
          );
          await expect(
            dialog.getByRole("checkbox", {
              name: /I reviewed this exact full package/,
            }),
          ).not.toBeChecked();
          await expect(
            dialog.getByRole("button", { name: "Review exact package" }),
          ).toBeDisabled();
          await dialog.getByLabel("Package version").selectOption(editedId);
          await expect(dialog.getByTestId("answer-body")).toHaveText(
            "Synthetic applicant edit preserved across regeneration.",
          );
          await dialog.getByLabel("Package version").selectOption(pkg.id);
          await expect(dialog.getByTestId("answer-body")).toHaveText(
            pkg.content.body,
          );
          await expect(
            dialog.getByRole("button", { name: "Copy body", exact: true }),
          ).toBeDisabled();
          const latestId = await dialog
            .getByLabel("Package version")
            .getByRole("option")
            .last()
            .getAttribute("value");
          if (!latestId) throw new Error("Expected regenerated version");
          await dialog.getByLabel("Package version").selectOption(latestId);
          await review();
          await page.evaluate(() => {
            const original = navigator.clipboard.writeText.bind(
              navigator.clipboard,
            );
            navigator.clipboard.writeText = async (text) => {
              navigator.clipboard.writeText = original;
              throw new DOMException(
                text ? "Synthetic permission denial" : "Denied",
                "NotAllowedError",
              );
            };
          });
          await dialog
            .getByRole("button", { name: "Copy body", exact: true })
            .click();
          await expect(dialog.getByRole("alert")).toContainText(
            "Clipboard permission unavailable",
          );
          await dialog
            .getByRole("button", { name: "Copy body", exact: true })
            .click();
          await expect(
            dialog.getByText("Copied body. You alone send or submit."),
          ).toBeVisible();
          expect(
            await page.evaluate(() => navigator.clipboard.readText()),
          ).toBe(pkg.content.body);
          await page.evaluate(() =>
            navigator.clipboard.writeText(
              "Synthetic unchanged clipboard sentinel",
            ),
          );
          await page.clock.install({ time: new Date() });
          await page.route(
            "**/api/applications/copy",
            async (route) => {
              const authorized = await route.fetch();
              expect(authorized.status()).toBe(200);
              await page.clock.setFixedTime(
                new Date(Date.parse(pkg.expiresAt) + 1),
              );
              await route.fulfill({ response: authorized });
            },
            { times: 1 },
          );
          await dialog
            .getByRole("button", { name: "Copy body", exact: true })
            .click();
          await expect(dialog.getByRole("alert")).toContainText(
            "This package expired",
          );
          expect(
            await page.evaluate(() => navigator.clipboard.readText()),
          ).toBe("Synthetic unchanged clipboard sentinel");
          await page.clock.setFixedTime(new Date());
          await dialog
            .getByRole("button", { name: "Refresh application" })
            .click();
          await expect(
            dialog.getByRole("button", { name: "Copy body", exact: true }),
          ).toBeEnabled();
          copies.splice(-3);
        }
      } else {
        questionnaireCount += 1;
        if (questionnaireCount === 1) {
          await dialog.evaluate((element) => {
            element.scrollTop = 0;
          });
          await page.screenshot({
            path: test.info().outputPath("questionnaire-package.png"),
          });
        }

        const answered = pkg.content.fields.filter(
          (field) => field.status === "answered",
        );
        expect(answered).toHaveLength(1);
        for (const field of pkg.content.fields) {
          await expect(
            dialog.getByTestId(`answer-${field.internalId}`),
          ).toHaveText(field.answer ?? "");
          const copy = dialog.getByRole("button", {
            name: `Copy ${field.internalId}`,
            exact: true,
          });
          if (field.status === "answered") {
            await copy.click();
            await expect(
              dialog.getByText(
                `Copied ${field.internalId}. You alone send or submit.`,
              ),
            ).toBeVisible();
            expect(
              await page.evaluate(() => navigator.clipboard.readText()),
            ).toBe(field.answer);
          } else {
            expect(field.answer).toBeNull();
            await expect(copy).toBeDisabled();
          }
        }
        await expect(
          dialog.getByRole("link", { name: "Original questionnaire ↗" }),
        ).toHaveAttribute("rel", "noopener noreferrer");
      }
      await expect(
        dialog.getByLabel("Manual application status"),
      ).not.toHaveValue("applied");
      await dialog
        .getByLabel("Manual application status")
        .selectOption("applied");
      await expect(dialog.getByLabel("Manual application status")).toHaveValue(
        "applied",
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    expect(emailCount).toBe(2);
    expect(questionnaireCount).toBe(3);
    expect(copies).toHaveLength(7);
    await panel
      .getByLabel("Fact 2 value", { exact: true })
      .fill("Data analysis");
    await panel
      .getByLabel("Correction explanation")
      .fill(
        "Synthetic profile version change invalidates prior application evidence.",
      );
    await panel.getByRole("button", { name: "Save corrected draft" }).click();
    await panel
      .getByRole("checkbox", { name: /I reviewed these synthetic facts/ })
      .check();
    await panel
      .getByRole("button", { name: "Approve profile version" })
      .click();
    dialog = await open(first.observation.title.value);
    await expect(dialog.getByTestId("package-readiness")).toHaveText("stale");
    await expect(
      dialog.getByRole("button", { name: "Copy body", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: test.info().outputPath("application-review.png"),
    });
    await dialog
      .getByRole("button", { name: "Close application draft" })
      .click();
    await panel
      .getByRole("checkbox", {
        name: "Delete my local PDFs, drafts, profile history, evaluations and application history.",
      })
      .check();
    await panel.getByRole("button", { name: "Delete my local data" }).click();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Sign in to local demo" }).click();
    dialog = await open(first.observation.title.value);
    await expect(dialog.getByLabel("Package version")).toHaveCount(0);
    await expect(dialog.getByTestId("answer-body")).toHaveCount(0);
    await expect(dialog.getByLabel("Manual application status")).toHaveValue(
      "not_applied",
    );
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    expect(context.pages()).toHaveLength(1);
  } finally {
    for (const job of jobs)
      await services.firestore.collection("sharedJobs").doc(job.jobId).delete();
    await deleteApp(services.app);
  }
});
