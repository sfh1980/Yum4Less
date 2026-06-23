import { test, expect } from "@playwright/test";

/**
 * Agent verification for Phase 1 audit H11/H12 — run ad-hoc against localhost:3000.
 * Not part of CI merge gate (see e2e/mvp-flow.spec.ts).
 */
test.describe("Phase 1 audit error surfaces (H11, H12)", () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(
      Boolean(process.env.CI),
      "Agent verification only — run manually against localhost dev server",
    );
  });

  test("H12 shows Map unavailable when Leaflet fails to load", async ({ page }) => {
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (/leaflet/i.test(url)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto("/");
    await page.getByRole("textbox", { name: "ZIP code" }).fill("23111");
    await page.getByRole("button", { name: "Find nearby stores" }).click();

    await expect(page.getByRole("heading", { name: "Location set" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Map unavailable" })).toBeVisible();
    await expect(
      page.getByText(/Store list details are still available below the map area/i),
    ).toBeVisible();
  });

  test("H11 error.tsx catches a forced render error on localhost", async ({ page }) => {
    await page.goto("/?verifyRenderError=1");

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    await expect(page.getByText(/unexpected error while loading this page/i)).toBeVisible();
  });
});
