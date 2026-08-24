// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZipPinScreen } from "@/components/meal-planner/zip-pin-screen";
import {
  clearAllZipSearchCenters,
  writeZipSearchCenter,
} from "@/lib/zip-search-centers";

vi.mock("@/components/zip-center-pick-map", () => ({
  ZipCenterPickMap: () => createElement("div", { "data-testid": "zip-center-pick-map-stub" }),
}));

describe("ZipPinScreen", () => {
  afterEach(() => {
    clearAllZipSearchCenters();
    vi.unstubAllGlobals();
  });

  it("uses a cached pin without calling geocode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeZipSearchCenter("23111", { latitude: 37.6085, longitude: -77.3739 });

    render(
      createElement(ZipPinScreen, {
        zipCode: "23111",
        radiusMiles: 5,
        onConfirm: () => undefined,
      }),
    );

    expect(await screen.findByTestId("zip-center-pick-map-stub")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
