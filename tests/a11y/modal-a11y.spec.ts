import { test, expect, type Locator, type Page } from "@playwright/test";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function assertFocusTrapAndEscapeClose(
  page: Page,
  dialog: Locator,
  trigger: Locator,
  options: { checkFocusRestore?: boolean } = {},
) {
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
  if (options.checkFocusRestore ?? true) {
    await expect(trigger).toBeFocused();
  }
}

function escapedPathPattern(path: string) {
  return new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

async function loginAsAdmin(page: Page, nextPath = "/admin") {
  const username = process.env.E2E_ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!username || !password) {
    test.skip(true, "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run admin a11y tests.");
    return;
  }

  await page.goto(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(escapedPathPattern(nextPath));
}

async function openAthleteDatabase(page: Page) {
  await loginAsAdmin(page, "/admin?tab=athletes");
  await expect(page.getByRole("button", { name: "Tambah anggota" })).toBeEnabled();
}

async function importAthletesWithRetry(page: Page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByRole("button", { name: "Masukkan data" }).click();
    try {
      await expect(page.getByText(/atlet masuk ke draft minggu ini/i)).toBeVisible({ timeout: 8_000 });
      return;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
    }
  }
}

test("Tambah anggota modal traps focus and closes on Escape", async ({ page }) => {
  await openAthleteDatabase(page);
  const trigger = page.getByRole("button", { name: "Tambah anggota" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Tambah anggota" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Import anggota modal traps focus and closes on Escape", async ({ page }) => {
  await openAthleteDatabase(page);
  const trigger = page.getByRole("button", { name: "Import anggota" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Import anggota" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Export preview modal traps focus and closes on Escape", async ({ page }) => {
  test.setTimeout(45_000);
  await loginAsAdmin(page);
  await expect(page.getByRole("button", { name: "Masukkan data" })).toBeEnabled();
  await importAthletesWithRetry(page);

  const trigger = page.getByRole("button", { name: "Unduh gambar" });
  await expect(trigger).toBeEnabled();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Pratinjau gambar leaderboard" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Delete athlete confirm dialog traps focus and closes on Escape", async ({ page }) => {
  test.setTimeout(45_000);
  await loginAsAdmin(page);
  await expect(page.getByRole("button", { name: "Masukkan data" })).toBeEnabled();
  await importAthletesWithRetry(page);

  const trigger = page.getByRole("button", { name: "Hapus Utha" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Hapus atlet minggu ini" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Crop image modal traps focus and closes on Escape", async ({ page }) => {
  await openAthleteDatabase(page);
  await page.getByRole("button", { name: "Tambah anggota" }).click();

  const fileInput = page.getByLabel("Pilih foto profil");
  await fileInput.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
  });

  const trigger = page.getByLabel("Pilih foto profil");
  const dialog = page.getByRole("dialog", { name: /^Potong/ });
  // checkFocusRestore skipped: setInputFiles opens the crop modal without a real click on
  // the hidden file input, so there is no natural "previously focused" element to restore to
  // here (a real user always clicks the label first, which focuses the input for real).
  await assertFocusTrapAndEscapeClose(page, dialog, trigger, { checkFocusRestore: false });
});

test("Unsaved-changes view-switch dialog traps focus and closes on Escape", async ({ page }) => {
  test.setTimeout(45_000);
  await loginAsAdmin(page);
  await expect(page.getByRole("button", { name: "Masukkan data" })).toBeEnabled();
  await importAthletesWithRetry(page);

  const trigger = page.getByRole("button", { name: "Cycling" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Perubahan belum disimpan" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Delete week confirm dialog traps focus and closes on Escape", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole("button", { name: "Bersihkan minggu" })).toBeEnabled();

  const trigger = page.getByRole("button", { name: "Bersihkan minggu" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Hapus seluruh data minggu ini" });
  await assertFocusTrapAndEscapeClose(page, dialog, trigger);
});

test("Event registration confirmation modal traps focus and closes on Escape", async ({ page }) => {
  await page.route("**/api/activities/activity-open", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        activity: {
          activityType: "Workout",
          coverImageUrl: "https://example.com/event.jpg",
          currentAthleteParticipant: false,
          description: "Easy run bersama komunitas.",
          displaySchedule: "14 Agu 2026, 06.00",
          id: "activity-open",
          images: [
            {
              activityId: "activity-open",
              id: "image-open",
              imageUrl: "https://example.com/event.jpg",
              isCover: true,
              sortOrder: 0,
            },
          ],
          location: "GBK",
          logoHasWhiteOutline: false,
          name: "Open Community Run",
          participants: [],
          registrationClosed: false,
          registrationEnabled: true,
          registrationOpen: true,
          scheduleMode: "single",
          sportType: "Run",
          startsAt: "2026-08-13T23:00:00.000Z",
          visibility: "public",
        },
        authenticated: true,
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/kegiatan/activity-open/daftar");

  const dialog = page.getByRole("dialog", { name: "Konfirmasi pendaftaran" });
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
});
