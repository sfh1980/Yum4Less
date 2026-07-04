// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
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
