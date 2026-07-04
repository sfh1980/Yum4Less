// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  SETTINGS_PREFERENCES_STORAGE_KEY,
  buildSettingsPreferencesPatch,
  clearSettingsPreferences,
  isSettingsPreferencesComplete,
  readSettingsPreferences,
  writeSettingsPreferences,
} from "@/lib/settings-preferences";

describe("settings preferences", () => {
  beforeEach(() => {
    clearSettingsPreferences();
  });

  afterEach(() => {
    clearSettingsPreferences();
  });

  it("marks setup complete only on explicit save", () => {
    const prefs = buildSettingsPreferencesPatch({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-mechanicsville"],
      markSetupComplete: true,
    });

    expect(isSettingsPreferencesComplete(prefs)).toBe(true);
    expect(prefs.setupComplete).toBe(true);
  });

  it("does not mark setup complete from draft auto-save patches", () => {
    const prefs = buildSettingsPreferencesPatch({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-mechanicsville"],
    });

    expect(prefs.setupComplete).toBe(false);
    expect(isSettingsPreferencesComplete(prefs)).toBe(false);
  });

  it("requires exactly one store for single-store shopping style", () => {
    expect(
      isSettingsPreferencesComplete(
        buildSettingsPreferencesPatch({
          zipCode: "23111",
          radiusMiles: 5,
          shoppingStyle: "single-store",
          selectedStoreIds: ["kroger-mechanicsville", "aldi-mechanicsville"],
          markSetupComplete: true,
        }),
      ),
    ).toBe(false);
  });

  it("persists and reads preferences from localStorage", () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "multi-store",
      selectedStoreIds: ["kroger-mechanicsville", "aldi-mechanicsville"],
      locationMode: "geolocation",
      latitude: 37.6085,
      longitude: -77.3739,
      setupComplete: true,
    });

    expect(readSettingsPreferences()).toEqual({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "multi-store",
      selectedStoreIds: ["kroger-mechanicsville", "aldi-mechanicsville"],
      locationMode: "geolocation",
      latitude: 37.6085,
      longitude: -77.3739,
      setupComplete: true,
    });
    expect(window.localStorage.getItem(SETTINGS_PREFERENCES_STORAGE_KEY)).toBeTruthy();
  });

  it("returns null for corrupt localStorage JSON", () => {
    window.localStorage.setItem(SETTINGS_PREFERENCES_STORAGE_KEY, "{not-json");

    expect(readSettingsPreferences()).toBeNull();
  });

  it("returns null for garbage JSON objects that fail schema validation", () => {
    window.localStorage.setItem(
      SETTINGS_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ zipCode: "123", radiusMiles: 99, theme: "neon" }),
    );

    expect(readSettingsPreferences()).toBeNull();
  });

  it("returns null for invalid theme values", () => {
    window.localStorage.setItem(
      SETTINGS_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ theme: "neon", zipCode: "23111", radiusMiles: 5 }),
    );

    expect(readSettingsPreferences()).toBeNull();
  });

  it("returns null when radius exceeds API bounds", () => {
    window.localStorage.setItem(
      SETTINGS_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ zipCode: "23111", radiusMiles: 50 }),
    );

    expect(readSettingsPreferences()).toBeNull();
  });

  it("reads selectedStoreIds beyond the shopping-route stop limit", () => {
    window.localStorage.setItem(
      SETTINGS_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        zipCode: "23111",
        radiusMiles: 5,
        selectedStoreIds: Array.from({ length: 9 }, (_, index) => `store-${index}`),
      }),
    );

    expect(readSettingsPreferences()).toEqual({
      zipCode: "23111",
      radiusMiles: 5,
      selectedStoreIds: Array.from({ length: 9 }, (_, index) => `store-${index}`),
    });
  });
});
