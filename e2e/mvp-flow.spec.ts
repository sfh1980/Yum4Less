import { test, expect } from "@playwright/test";

async function runCoreMvpFlow(page: import("@playwright/test").Page) {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Find realistic low-cost dinner options near you/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Step 1: Find nearby stores" }),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "ZIP code" }).fill("23111");
  await page.getByRole("button", { name: "Find nearby stores" }).click();

  await expect(page.getByText(/Kroger|Publix|Food Lion/i).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Nearby stores map" }),
  ).toBeVisible();
  await expect(
    page.getByText(/no live Walmart pricing, or no weekly ad rollout yet/i),
  ).toBeVisible();
  await expect(page.getByText(/Weekly ad prices/i).first()).toBeVisible();
  await expect(page.getByText(/^Priced$/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Rank dinner options" }).click();

  await expect(
    page.getByRole("heading", { name: "How to read these results" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(
    page.getByRole("heading", { name: "How to read these results" }),
  ).not.toBeVisible();

  await expect(page.getByText(/Est\. \$\d+\.\d{2}/).first()).toBeVisible();
  await expect(
    page.getByText(/Ranked meal totals below use saved weekly-ad prices/i).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        /(?:Directional )?saved weekly-ad prices at .+ — not live checkout; confirm in store\./i,
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/weekly-ad price — directional|directional|estimated/i)
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText(/limited local ZIP list|limited coverage/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("note", { name: /heads up about these prices/i }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Treat totals as estimates/i).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Project & data details (internal)" }),
  ).toHaveCount(0);
}

test.describe("Yum4Less local MVP (ZIP 23111)", () => {
  test("finds nearby stores and ranks dinners with trust labels", async ({ page }) => {
    await runCoreMvpFlow(page);
  });

  test("shows swipe carousel controls for multiple ranked dinners", async ({ page }) => {
    await runCoreMvpFlow(page);

    const carouselHint = page.getByText(/Swipe sideways or use the arrows/i);
    const nextButton = page.getByRole("button", { name: "Next recommendation" });

    if (await carouselHint.isVisible()) {
      await expect(page.getByText(/1 of \d+/)).toBeVisible();
      await nextButton.click();
      await expect(page.getByText(/2 of \d+/)).toBeVisible();
      await page.getByRole("button", { name: "Previous recommendation" }).click();
      await expect(page.getByText(/1 of \d+/)).toBeVisible();
    }
  });

  test("opens the trust explainer from the results panel", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Find nearby stores" }).click();
    await expect(page.getByText(/Kroger|Publix/i).first()).toBeVisible();

    await page.getByRole("button", { name: "How to read these labels" }).click();
    const trustDialog = page.getByRole("dialog");
    await expect(
      trustDialog.getByRole("heading", { name: "How to read these results" }),
    ).toBeVisible();
    await expect(trustDialog.getByText(/helpful estimates/i)).toBeVisible();
    await expect(
      trustDialog.getByText(/estimated, directional, or limited coverage/i),
    ).toBeVisible();
    await expect(
      trustDialog.getByText(/live, current weekly-ad pricing from Walmart is not available/i),
    ).toBeVisible();
  });
});
