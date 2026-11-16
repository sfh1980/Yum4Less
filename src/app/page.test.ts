import { describe, expect, it } from "vitest";
import { dynamic } from "@/app/page";

/**
 * The export is what stops `next build` from prerendering "/".
 * A route-manifest check would only run after a full build, so this unit test
 * fails as soon as the line is removed.
 */
describe("home page request-time settings", () => {
  it("opts / out of static prerender", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
