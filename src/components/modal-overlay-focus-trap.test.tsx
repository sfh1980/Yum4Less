// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InternalDetailsModal } from "@/components/internal-details-modal";
import { RankLoadingOverlay } from "@/components/meal-planner/rank-loading-overlay";
import { StoreMapOverlay } from "@/components/meal-planner/store-map-overlay";
import { SingleStoreMapOverlay } from "@/components/single-store-map-overlay";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

vi.mock("@/components/meal-planner/market-discovery-panel", () => ({
  MarketDiscoveryPanel: () => createElement("div", { "data-testid": "market-discovery-panel" }),
}));

vi.mock("@/components/nearby-stores-map", () => ({
  NearbyStoresMap: () => createElement("div", { "data-testid": "nearby-stores-map" }),
}));

const testStore: NearbyStoreSummary = {
  id: "kroger-mechanicsville",
  name: "Kroger",
  city: "Mechanicsville",
  state: "VA",
  kind: "grocery",
  latitude: 37.6153,
  longitude: -77.3491,
  distanceMiles: 1.2,
  chain: "kroger",
  chainLabel: "Kroger",
  rolloutStatus: "weekly-ad-preview",
  recommendationEnabled: true,
  rolloutNote: "Fixture coverage.",
  matchedIngredientCount: 12,
  totalTrackedIngredientCount: 97,
  pricingSourceKind: "weekly-ad",
  locationProvenance: "bootstrap",
  locationBadge: "Catalog coordinates",
  locationNote: "Seed catalog row.",
};

function mountBackgroundFocusTarget() {
  const background = document.createElement("div");
  // Live home shell uses `.meal-planner-grid` (index.tsx); keep legacy col support via selector union.
  background.className = "meal-planner-grid";
  const backgroundButton = document.createElement("button");
  backgroundButton.type = "button";
  backgroundButton.textContent = "Background action";
  background.appendChild(backgroundButton);
  document.body.appendChild(background);
  backgroundButton.focus();
  return { background, backgroundButton };
}

function expectModalFocusTrap(input: {
  dialog: HTMLElement;
  initialFocus: HTMLElement;
}) {
  expect(document.body.classList.contains("modal-open")).toBe(true);
  expect(
    (document.querySelector(".meal-planner-grid") as HTMLElement | null)?.inert,
    "background content should be inert while modal is open",
  ).toBe(true);

  input.initialFocus.focus();
  expect(document.activeElement).toBe(input.initialFocus);

  fireEvent.keyDown(input.dialog, { key: "Tab" });
  expect(input.dialog.contains(document.activeElement)).toBe(true);
}

describe("useModalDialog wiring on overlays", () => {
  it("StoreMapOverlay traps Tab within the dialog and inerts background content", () => {
    mountBackgroundFocusTarget();
    const onClose = vi.fn();

    render(
      createElement(StoreMapOverlay, {
        open: true,
        marketBlocked: false,
        marketSearchState: { status: "idle" },
        onClose,
        onStoreSelect: vi.fn(),
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Store locations" });
    const closeButton = screen.getByRole("button", { name: /^Close$/ });

    expectModalFocusTrap({ dialog, initialFocus: closeButton });

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("SingleStoreMapOverlay traps Tab within the dialog and inerts background content", () => {
    mountBackgroundFocusTarget();
    const onClose = vi.fn();

    render(
      createElement(SingleStoreMapOverlay, {
        store: testStore,
        isOpen: true,
        onClose,
      }),
    );

    const dialog = screen.getByRole("dialog", { name: /Kroger —/ });
    const closeButton = screen.getByRole("button", { name: "Close" });

    expectModalFocusTrap({ dialog, initialFocus: closeButton });

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("RankLoadingOverlay traps Tab within the dialog and inerts background content", () => {
    mountBackgroundFocusTarget();

    render(createElement(RankLoadingOverlay, { open: true }));

    const dialog = screen.getByRole("dialog", { name: "Suggesting recipes" });
    const initialFocus = screen.getByRole("button", { name: "Suggesting recipes" });

    expectModalFocusTrap({ dialog, initialFocus });
  });

  it("InternalDetailsModal remains the reference focus-trap implementation", () => {
    mountBackgroundFocusTarget();
    const onClose = vi.fn();

    render(
      createElement(InternalDetailsModal, {
        open: true,
        onClose,
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Project & data details (internal)",
    });
    const closeButton = screen.getByRole("button", { name: /^Close$/ });

    expectModalFocusTrap({ dialog, initialFocus: closeButton });
  });
});
