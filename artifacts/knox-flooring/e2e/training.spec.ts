import { expect, test } from "@playwright/test";

const email = process.env.TRAINING_EMAIL;
const password = process.env.TRAINING_PASSWORD;

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, "Set TRAINING_EMAIL and TRAINING_PASSWORD for authenticated mission tests.");
  await page.goto("/welcome");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /training/i })).toBeVisible();
});

test("all five guided missions are available", async ({ page }) => {
  await page.getByRole("button", { name: /training/i }).click();
  for (const name of ["Executive Tour", "Owner Mission", "Sales & Estimating Mission", "Operations Mission", "Installer Mission"]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
});

test("an owner can start, navigate, pause, and resume training", async ({ page }) => {
  await page.getByRole("button", { name: /training/i }).click();
  const mission = page.getByRole("article").filter({ hasText: "Executive Tour" });
  await mission.getByRole("button", { name: /start silently/i }).click();
  await expect(page.getByRole("dialog", { name: /your command center/i })).toBeVisible();
  await page.getByRole("button", { name: /pause/i }).click();
  await expect(page.getByRole("button", { name: /resume training/i })).toBeVisible();
});
