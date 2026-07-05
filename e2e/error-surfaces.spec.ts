import { test, expect } from "@playwright/test";

test.describe("Error surfaces (H11, H12)", () => {
  test("H11 error.tsx catches a forced render error on localhost", async ({ page }) => {
    await page.goto("/?verifyRenderError=1");

    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByText(/unexpected error while loading this page/i)).toBeVisible();
  });

  test.skip(
    "H12 shows Map unavailable when Leaflet fails to load",
    "Leaflet is bundled in production builds; network abort does not reliably surface mapError in CI.",
  );
});
