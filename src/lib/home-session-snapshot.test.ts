// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  clearHomeSessionDinners,
  clearHomeSessionSnapshot,
  readAppReturnSnapshot,
  readHomeSessionSnapshot,
  shouldRestoreHomeSessionSnapshot,
  writeAppReturnSnapshot,
  writeHomeSessionSnapshot,
} from "@/lib/home-session-snapshot";

describe("home-session-snapshot", () => {
  afterEach(() => {
    clearHomeSessionSnapshot();
  });

  it("round-trips a ready dinners snapshot", () => {
    writeHomeSessionSnapshot({
      flowStep: "results",
      marketSearchState: { status: "ready", market: { nearbyStores: [] } as never },
      recommendationState: { status: "ready", recommendations: [] },
    });

    const snapshot = readHomeSessionSnapshot();
    expect(snapshot?.flowStep).toBe("results");
    expect(snapshot?.recommendationState.status).toBe("ready");
    expect(snapshot?.marketSearchState.status).toBe("ready");
  });

  it("keeps the last tab when dinners become ready", () => {
    writeAppReturnSnapshot({
      splashFinished: true,
      activeTab: "settings",
      flowStep: "welcome-budget",
    });
    writeHomeSessionSnapshot({
      flowStep: "results",
      marketSearchState: { status: "ready", market: { nearbyStores: [] } as never },
      recommendationState: { status: "ready", recommendations: [] },
    });

    expect(readAppReturnSnapshot()?.activeTab).toBe("settings");
    expect(readHomeSessionSnapshot()?.flowStep).toBe("results");
  });

  it("rejects snapshots that are not ready dinners", () => {
    writeHomeSessionSnapshot({
      flowStep: "results",
      marketSearchState: { status: "loading" },
      recommendationState: { status: "ready", recommendations: [] },
    });

    expect(readHomeSessionSnapshot()).toBeNull();
  });

  it("clears dinners without dropping the last tab", () => {
    writeAppReturnSnapshot({
      splashFinished: true,
      activeTab: "feedback",
      flowStep: "welcome-budget",
    });
    writeHomeSessionSnapshot({
      flowStep: "results",
      marketSearchState: { status: "ready", market: { nearbyStores: [] } as never },
      recommendationState: { status: "ready", recommendations: [] },
    });

    clearHomeSessionDinners();

    expect(readHomeSessionSnapshot()).toBeNull();
    expect(readAppReturnSnapshot()?.activeTab).toBe("feedback");
    expect(readAppReturnSnapshot()?.splashFinished).toBe(true);
  });

  it("reads a version-1 dinners snapshot as a Home return", () => {
    window.sessionStorage.setItem(
      "yum4less.home-session.v1",
      JSON.stringify({
        version: 1,
        flowStep: "results",
        marketSearchState: { status: "ready", market: { nearbyStores: [] } },
        recommendationState: { status: "ready", recommendations: [] },
      }),
    );

    const snapshot = readAppReturnSnapshot();
    expect(snapshot?.activeTab).toBe("home");
    expect(snapshot?.splashFinished).toBe(true);
    expect(readHomeSessionSnapshot()?.flowStep).toBe("results");
  });

  it("allows restore unless the document load was a reload", () => {
    expect(shouldRestoreHomeSessionSnapshot()).toBe(true);
  });
});
