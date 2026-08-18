import { expect, test } from "@playwright/test";

test("event footer reaches the bottom of a sparse viewport", async ({ page }) => {
  const viewportHeight = 1280;
  await page.setViewportSize({ width: 1440, height: viewportHeight });
  await page.route("**/api/activities", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ activities: [], authenticated: false }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/event");
  await expect(page.getByRole("heading", { name: "Belum ada kegiatan." })).toBeVisible();

  const footerBottom = await page.locator("footer").evaluate((footer) => footer.getBoundingClientRect().bottom);
  expect(footerBottom).toBeCloseTo(viewportHeight, 0);
});

test("calendar footer reaches the bottom of a sparse viewport", async ({ page }) => {
  const viewportHeight = 1280;
  await page.setViewportSize({ width: 1440, height: viewportHeight });
  await page.route("**/api/activities", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ activities: [], authenticated: false }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/kalender");
  await expect(page.getByRole("heading", { name: "Belum ada kegiatan." })).toBeVisible();

  const footerBottom = await page.locator("footer").evaluate((footer) => footer.getBoundingClientRect().bottom);
  expect(footerBottom).toBeCloseTo(viewportHeight, 0);
});
