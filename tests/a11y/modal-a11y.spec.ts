import { test, expect, type Locator, type Page } from "@playwright/test";

const DEV_ADMIN_TOKEN = "admin123";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function assertFocusTrapAndEscapeClose(page: Page, dialog: Locator, trigger: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");

  const focusedInsideDialog = await dialog.evaluate((node) =>
    Boolean(document.activeElement && node.contains(document.activeElement)),
  );
  expect(focusedInsideDialog).toBe(true);

  await page.keyboard.press("Shift+Tab");
  const wrappedToLast = await dialog.evaluate((node, selector) => {
    const focusables = node.querySelectorAll<HTMLElement>(selector);
    const last = focusables[focusables.length - 1];
    return document.activeElement === last;
  }, FOCUSABLE_SELECTOR);
  expect(wrappedToLast).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

async function loginAsAdmin(page: Page) {
  await page.getByPlaceholder("Admin token").fill(DEV_ADMIN_TOKEN);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("button", { name: "Import" })).toBeEnabled();
}

async function importAthletesWithRetry(page: Page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByRole("button", { name: "Import" }).click();
    try {
      await expect(page.getByText("Imported 3 athletes")).toBeVisible({ timeout: 8_000 });
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
    }
  }
}

test("Create Athlete modal traps focus and closes on Escape", async ({ page }) => {
  await page.goto("/athletes");
  const trigger = page.getByRole("button", { name: "Create Athlete" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Create athlete" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Import CSV modal traps focus and closes on Escape", async ({ page }) => {
  await page.goto("/athletes");
  const trigger = page.getByRole("button", { name: "Import CSV" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Import CSV" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Export preview modal traps focus and closes on Escape", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/admin");
  await loginAsAdmin(page);
  await importAthletesWithRetry(page);

  const trigger = page.getByRole("button", { name: "Export" });
  await expect(trigger).toBeEnabled();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Preview export leaderboard" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Delete athlete confirm dialog traps focus and closes on Escape", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/admin");
  await loginAsAdmin(page);
  await importAthletesWithRetry(page);

  const trigger = page.getByRole("button", { name: "Delete Utha" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Hapus atlet minggu ini" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});
