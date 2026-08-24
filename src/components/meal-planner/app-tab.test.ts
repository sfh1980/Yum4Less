// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  isAppTabContentReady,
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

describe("isAppTabContentReady", () => {
  it("keeps Feedback and Settings usable before setup is complete", () => {
    expect(
      isAppTabContentReady("settings", { settingsComplete: false, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabContentReady("feedback", { settingsComplete: false, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabContentReady("home", { settingsComplete: false, cookEnabled: false }),
    ).toBe(false);
    expect(
      isAppTabContentReady("deals", { settingsComplete: false, cookEnabled: false }),
    ).toBe(false);
    expect(
      isAppTabContentReady("saved", { settingsComplete: false, cookEnabled: false }),
    ).toBe(false);
    expect(
      isAppTabContentReady("cook", { settingsComplete: false, cookEnabled: true }),
    ).toBe(false);
  });

  it("does not hard-disable Home or other tabs before setup", () => {
    expect(
      isAppTabEnabled("home", { settingsComplete: false, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabEnabled("deals", { settingsComplete: false, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabEnabled("cook", { settingsComplete: false, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabEnabled("saved", { settingsComplete: false, cookEnabled: false }),
    ).toBe(true);
  });

  it("allows Home/Deals/Saved content after setup; Cook still needs recipes", () => {
    expect(
      isAppTabContentReady("home", { settingsComplete: true, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabContentReady("deals", { settingsComplete: true, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabContentReady("saved", { settingsComplete: true, cookEnabled: false }),
    ).toBe(true);
    expect(
      isAppTabContentReady("cook", { settingsComplete: true, cookEnabled: false }),
    ).toBe(false);
    expect(
      isAppTabContentReady("cook", { settingsComplete: true, cookEnabled: true }),
    ).toBe(true);
  });
});
