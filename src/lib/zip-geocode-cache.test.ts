import { describe, expect, it } from "vitest";
import { rememberIngestZipGeocode } from "@/lib/zip-geocode-cache";

describe("rememberIngestZipGeocode", () => {
  it("skips browser pins so shopper GPS is not stored as a ZIP centroid", async () => {
    await expect(
      rememberIngestZipGeocode({
        zipCode: "10001",
        city: "Current location",
        state: "US",
        latitude: 40.75,
        longitude: -73.99,
        source: "browser",
      }),
    ).resolves.toBeUndefined();
  });
});
