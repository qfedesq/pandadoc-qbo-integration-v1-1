import { expect, test } from "@playwright/test";

test("dashboard smoke flow", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

  await page.getByLabel("Email").fill(
    process.env.DEFAULT_ADMIN_EMAIL ?? "admin@example.com",
  );
  await page.getByLabel("Password").fill(
    process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!",
  );
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/factoring-dashboard$/);
  await expect(page.getByRole("heading", { name: "PandaDoc Factoring Dashboard" })).toBeVisible();
  await expect(page.getByText("PandaDoc Demo Workspace", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo Manufacturing LLC", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Acme Holdings")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import to PandaDoc" }).first()).toBeVisible();
});
