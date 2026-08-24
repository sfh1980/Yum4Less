// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  SETTINGS_PREFERENCES_STORAGE_KEY,
  buildSettingsPreferencesPatch,
  clearSettingsPreferences,
  isSettingsPreferencesComplete,
  readSettingsPreferences,
  stripExactCoordinates,
  writeSettingsPreferences,
} from "@/lib/settings-preferences";

describe("settings preferences", () => {
  beforeEach(() => {
    clearSettingsPreferences();
  });

  afterEach(() => {
    clearSettingsPreferences();
  });

  it("clears a prior ZIP when an explicit empty ZIP is patched", () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      locationMode: "geolocation",
    });

    const prefs = buildSettingsPreferencesPatch({
      zipCode: "",
      locationMode: "geolocation",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-mechanicsville"],
      markSetupComplete: true,
    });

    expect(prefs.zipCode).toBeUndefined();
    expect(prefs.setupComplete).toBe(true);
  });

  it("persists onboardingStep for incomplete wizard resume", () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      onboardingStep: "radius",
    });

    expect(readSettingsPreferences()?.onboardingStep).toBe("radius");
    expect(isSettingsPreferencesComplete(readSettingsPreferences())).toBe(false);
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

  it("completes setup on geolocation mode without a ZIP", () => {
    const prefs = buildSettingsPreferencesPatch({
      locationMode: "geolocation",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-mechanicsville"],
      markSetupComplete: true,
    });

    expect(prefs.setupComplete).toBe(true);
    expect(isSettingsPreferencesComplete(prefs)).toBe(true);
    expect(prefs.zipCode).toBeUndefined();
  });

  it("does not complete setup without ZIP when location mode is zip", () => {
    const prefs = buildSettingsPreferencesPatch({
      locationMode: "zip",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-mechanicsville"],
      markSetupComplete: true,
    });

    expect(prefs.setupComplete).toBe(false);
    expect(isSettingsPreferencesComplete(prefs)).toBe(false);
  });

  it("persists ZIP-only preferences and strips exact coordinates on write", () => {
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
      setupComplete: true,
    });

    const raw = window.localStorage.getItem(SETTINGS_PREFERENCES_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("37.6085");
    expect(raw).not.toContain("-77.3739");
    expect(raw).not.toMatch(/"latitude"/);
    expect(raw).not.toMatch(/"longitude"/);
  });

  it("proof-of-catch: legacy lat/lng in localStorage do not survive a read/write reload", () => {
    window.localStorage.setItem(
      SETTINGS_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        zipCode: "23111",
        radiusMiles: 5,
        shoppingStyle: "single-store",
        selectedStoreIds: ["kroger-mechanicsville"],
        locationMode: "geolocation",
        latitude: 37.6085,
        longitude: -77.3739,
        setupComplete: true,
      }),
    );

    const loaded = readSettingsPreferences();
    expect(loaded?.latitude).toBeUndefined();
    expect(loaded?.longitude).toBeUndefined();
    expect(loaded?.zipCode).toBe("23111");
    expect(isSettingsPreferencesComplete(loaded)).toBe(true);

    writeSettingsPreferences(loaded!);
    const reloaded = JSON.parse(
      window.localStorage.getItem(SETTINGS_PREFERENCES_STORAGE_KEY)!,
    ) as Record<string, unknown>;
    expect(reloaded.latitude).toBeUndefined();
    expect(reloaded.longitude).toBeUndefined();
    expect(reloaded.zipCode).toBe("23111");
  });

  it("stripExactCoordinates removes only lat/lng", () => {
    expect(
      stripExactCoordinates({
        zipCode: "23111",
        latitude: 1,
        longitude: 2,
        locationMode: "geolocation",
      }),
    ).toEqual({
      zipCode: "23111",
      locationMode: "geolocation",
    });
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
