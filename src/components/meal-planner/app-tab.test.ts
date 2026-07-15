// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  isAppTabEnabled,
  resolveAppTabFromPreferences,
  SSR_DEFAULT_APP_TAB,
} from "@/components/meal-planner/app-tab";
import {
  clearSettingsPreferences,
  writeSettingsPreferences,
} from "@/lib/settings-preferences";

describe("app tab routing", () => {
  it("uses settings as the SSR-safe default", () => {
    expect(SSR_DEFAULT_APP_TAB).toBe("settings");
  });

  it("resolves settings when preferences are incomplete", () => {
    clearSettingsPreferences();
    expect(resolveAppTabFromPreferences()).toBe("settings");
  });

  it("resolves home when settings are complete", () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-1"],
      setupComplete: true,
    });
    expect(resolveAppTabFromPreferences()).toBe("home");
  });
});

describe("isAppTabEnabled (Settings-first gate)", () => {
  it("allows only Settings before setup is complete", () => {
    expect(
      isAppTabEnabled("settings", { settingsComplete: false, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabEnabled("home", { settingsComplete: false, cookEnabled: false }),
    ).toBe(false);
    expect(
      isAppTabEnabled("deals", { settingsComplete: false, cookEnabled: false }),
    ).toBe(false);
    expect(
      isAppTabEnabled("saved", { settingsComplete: false, cookEnabled: false }),
    ).toBe(false);
    expect(
      isAppTabEnabled("cook", { settingsComplete: false, cookEnabled: true }),
    ).toBe(false);
  });

  it("allows Home/Deals/Saved after setup; Cook still needs recipes", () => {
    expect(
      isAppTabEnabled("home", { settingsComplete: true, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabEnabled("deals", { settingsComplete: true, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabEnabled("saved", { settingsComplete: true, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabEnabled("cook", { settingsComplete: true, cookEnabled: false }),
    ).toBe(false);
    expect(
      isAppTabEnabled("cook", { settingsComplete: true, cookEnabled: true }),
    ).toBe(true);
  });
});
