import { describe, expect, it } from "vitest";
import {
  applyStoreIdRedirects,
  followStoreIdRedirect,
} from "@/lib/store-id-redirect-map";

describe("store id redirects", () => {
  it("follows one hop and a later hop", () => {
    const redirects = {
      "osm-way-1": "kroger-111",
      "kroger-111": "kroger-222",
    };
    expect(followStoreIdRedirect("osm-way-1", redirects)).toBe("kroger-222");
    expect(followStoreIdRedirect("kroger-222", redirects)).toBe("kroger-222");
  });

  it("stops on a cycle", () => {
    const redirects = {
      "a-store": "b-store",
      "b-store": "a-store",
    };
    expect(followStoreIdRedirect("a-store", redirects)).toBe("b-store");
  });

  it("leaves ids alone when the map is empty", () => {
    expect(applyStoreIdRedirects(["kroger-1"], undefined)).toEqual(["kroger-1"]);
    expect(applyStoreIdRedirects(["kroger-1"], {})).toEqual(["kroger-1"]);
  });

  it("collapses two saved ids that now name one building", () => {
    expect(
      applyStoreIdRedirects(["osm-way-1", "kroger-111", "aldi-1"], {
        "osm-way-1": "kroger-111",
      }),
    ).toEqual(["kroger-111", "aldi-1"]);
  });
});
