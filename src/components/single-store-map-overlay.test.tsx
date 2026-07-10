// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SingleStoreMapOverlay } from "@/components/single-store-map-overlay";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

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

describe("SingleStoreMapOverlay", () => {
  it("renders store name and city/state in the title when open", () => {
    render(
      createElement(SingleStoreMapOverlay, {
        store: testStore,
        isOpen: true,
        onClose: vi.fn(),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Kroger — Mechanicsville, VA" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("nearby-stores-map")).toBeInTheDocument();
  });

  it("shows fallback when store is null", () => {
    render(
      createElement(SingleStoreMapOverlay, {
        store: null,
        isOpen: true,
        onClose: vi.fn(),
      }),
    );

    expect(
      screen.getByText("Location not available for this store"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("nearby-stores-map")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();

    render(
      createElement(SingleStoreMapOverlay, {
        store: testStore,
        isOpen: true,
        onClose,
      }),
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns null when closed", () => {
    const { container } = render(
      createElement(SingleStoreMapOverlay, {
        store: testStore,
        isOpen: false,
        onClose: vi.fn(),
      }),
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("nearby-stores-map")).not.toBeInTheDocument();
  });
});
