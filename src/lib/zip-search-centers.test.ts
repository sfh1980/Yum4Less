// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearAllZipSearchCenters,
  clearZipSearchCenter,
  readZipSearchCenter,
  writeZipSearchCenter,
  ZIP_SEARCH_CENTERS_STORAGE_KEY,
} from "@/lib/zip-search-centers";

describe("zip-search-centers", () => {
  beforeEach(() => {
    clearAllZipSearchCenters();
  });

  afterEach(() => {
    clearAllZipSearchCenters();
  });

  it("round-trips a valid ZIP center", () => {
    writeZipSearchCenter("23111", { latitude: 37.61, longitude: -77.37 });
    expect(readZipSearchCenter("23111")).toEqual({
      latitude: 37.61,
      longitude: -77.37,
    });
  });

  it("clears one ZIP without dropping others", () => {
    writeZipSearchCenter("23111", { latitude: 37.61, longitude: -77.37 });
    writeZipSearchCenter("23116", { latitude: 37.7, longitude: -77.4 });
    clearZipSearchCenter("23111");
    expect(readZipSearchCenter("23111")).toBeNull();
    expect(readZipSearchCenter("23116")).toEqual({
      latitude: 37.7,
      longitude: -77.4,
    });
  });

  it("ignores invalid ZIP keys and corrupt storage", () => {
    writeZipSearchCenter("abc", { latitude: 1, longitude: 2 });
    expect(readZipSearchCenter("abc")).toBeNull();

    window.localStorage.setItem(ZIP_SEARCH_CENTERS_STORAGE_KEY, "{not-json");
    expect(readZipSearchCenter("23111")).toBeNull();
  });
});
