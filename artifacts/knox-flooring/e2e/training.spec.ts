import { expect, test } from "@playwright/test";

const email = process.env.TRAINING_EMAIL;
const password = process.env.TRAINING_PASSWORD;

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, "Set TRAINING_EMAIL and TRAINING_PASSWORD for authenticated mission tests.");
  await page.goto("/welcome");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("banner").getByRole("button", { name: /^(training|open training center)$/i })).toBeVisible();
});

test("all five guided missions are available", async ({ page }) => {
  await page.getByRole("banner").getByRole("button", { name: /^(training|open training center)$/i }).click();
  for (const name of ["Executive Tour", "Owner Mission", "Sales & Estimating Mission", "Operations Mission", "Installer Mission"]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
});

test("an owner can pause and resume training through the header", async ({ page }) => {
  const trainingButton = page.getByRole("banner").getByRole("button", { name: /^(training|open training center)$/i });
  await trainingButton.click();
  const mission = page.getByRole("article").filter({ hasText: "Executive Tour" });
  await mission.getByRole("button", { name: /start silently/i }).click();
  const trainingDialog = page.getByRole("dialog", { name: /your command center/i });
  await expect(trainingDialog).toBeVisible();
  await page.getByRole("button", { name: /pause/i }).click();
  await expect(trainingDialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: /^resume training$/i })).toHaveCount(0);
  await trainingButton.click();
  await mission.getByRole("button", { name: /^resume$/i }).click();
  await expect(trainingDialog).toBeVisible();
});
