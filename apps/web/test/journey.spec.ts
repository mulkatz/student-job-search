import { expect, test } from "@playwright/test";

test("synthetic local sign-in, evidence, original link, unknowns and sign-out", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to view discoveries" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in to local demo" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
  const application = page.getByRole("link", {
    name: "Source-listed link · unverified",
  });
  await expect(application).toHaveAttribute("href", /^https:\/\//);
  await expect(application).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByText("Evidence & details", { exact: true }).click();
  await expect(
    page.getByText("Unknown · confirmation needed").first(),
  ).toBeVisible();
  await expect(page.getByText("Source evidence").first()).toBeVisible();
  await expect(page.getByText(/Last checked:/)).toBeVisible();
  const parentEvidence = page.getByRole("link", {
    name: "Parent page evidence",
  });
  await expect(parentEvidence).toHaveAttribute(
    "href",
    "https://careers.synthetic.example/careers",
  );
  await expect(parentEvidence).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByText("Student analytics vacancy")).toBeVisible();
  await expect(
    page.getByText(/does not prove the vacancy is still open/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign in to local demo" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
