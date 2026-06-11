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
    page
      .getByText(
        /Context only — no Walmart pricing|Walmart always context-only|Live, current weekly-ad pricing from Walmart is not available/i,
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/Est\. weekly-ad prices/i).first()).toBeVisible();
  await expect(page.getByText(/^Priced$/i)).toHaveCount(0);

  await expect(
    page.getByRole("heading", { name: "Step 3: Browse nearby sale ingredients" }),
  ).toBeVisible();

  const suggestButton = page.getByRole("button", {
    name: "Suggest recipes using my selected ingredients",
  });
  await expect(suggestButton).toBeDisabled();

  const ingredientCheckbox = page
    .locator(".sale-ingredient-list input[type=checkbox]")
    .first();
  await expect(ingredientCheckbox).toBeVisible({ timeout: 30_000 });
  await ingredientCheckbox.check();
  await expect(suggestButton).not.toBeDisabled();

  await suggestButton.click();

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
  const headsUpNote = page.getByRole("note", { name: /heads up about these prices/i }).first();
  await expect(headsUpNote).toBeVisible();
  await expect(headsUpNote).toContainText(
    /saved weekly ads and recently checked online store prices|Treat totals as estimates/i,
  );
  await expect(page.getByText(/Treat totals as estimates/i).first()).toBeVisible();
  await expect(
    page.locator(".meal-card-price-age, .sale-ingredient-freshness").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Project & data details (internal)" }),
  ).toHaveCount(0);
}

test.describe("Yum4Less beta v1 (ZIP 23111)", () => {
  test("finds nearby stores and ranks dinners with trust labels", async ({ page }) => {
    await runCoreMvpFlow(page);
  });

  test("shows swipe carousel controls for multiple ranked dinners", async ({ page }) => {
    await runCoreMvpFlow(page);

    const carouselHint = page.getByText(/Swipe sideways or use the arrows/i);
    const nextButton = page.getByRole("button", { name: "Next recommendation" });

    if (await carouselHint.isVisible()) {
      await expect(page.getByText(/1 of \d+/)).toBeVisible();

      const pagination = page.locator('[aria-label="Recommendation pagination"]');
      await expect(pagination).toBeVisible();
      const dotButtons = pagination.getByRole("button");
      await expect(dotButtons.first()).toBeVisible();
      expect(await dotButtons.count()).toBeGreaterThan(1);

      const secondDot = page.getByRole("button", { name: "Show recommendation 2" });
      await expect(secondDot).toBeVisible();
      await secondDot.click();
      await expect(page.getByText(/2 of \d+/)).toBeVisible();

      await page.getByRole("button", { name: "Previous recommendation" }).click();
      await expect(page.getByText(/1 of \d+/)).toBeVisible();
      await nextButton.click();
      await expect(page.getByText(/2 of \d+/)).toBeVisible();
    }
  });

  test("shows beta label and footer feedback link", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/Yum4Less · Beta v1/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Send feedback or report a wrong price" }),
    ).toHaveAttribute("href", "/feedback");

    await runCoreMvpFlow(page);

    await expect(page.getByText(/Beta v1: totals are estimates/i)).toBeVisible();
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
    await expect(trustDialog.getByText(/Beta v1/i)).toBeVisible();
    await expect(trustDialog.getByText(/not part of the current production release/i)).toBeVisible();
    await expect(
      trustDialog.getByText(/Kroger family and Aldi \(production focus\)/i),
    ).toBeVisible();
  });
});
