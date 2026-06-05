import { afterEach, describe, expect, it } from "vitest";
import {
  KROGER_API_SPEC,
  getKrogerApiBaseUrl,
  getKrogerApiEnvironment,
  isKrogerOfficialOnlinePricingEligible,
} from "@/lib/providers/kroger/kroger-api-types";

const originalEnv = process.env.KROGER_API_ENV;

describe("Kroger API environment selection", () => {
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.KROGER_API_ENV;
    } else {
      process.env.KROGER_API_ENV = originalEnv;
    }
  });

  it("defaults to certification when KROGER_API_ENV is unset", () => {
    delete process.env.KROGER_API_ENV;

    expect(getKrogerApiEnvironment()).toBe("certification");
    expect(getKrogerApiBaseUrl()).toBe(KROGER_API_SPEC.certificationBaseUrl);
    expect(isKrogerOfficialOnlinePricingEligible()).toBe(false);
  });

  it("uses the production host when KROGER_API_ENV=production", () => {
    process.env.KROGER_API_ENV = "production";

    expect(getKrogerApiEnvironment()).toBe("production");
    expect(getKrogerApiBaseUrl()).toBe(KROGER_API_SPEC.productionBaseUrl);
    expect(isKrogerOfficialOnlinePricingEligible()).toBe(true);
  });

  it("accepts prod as an alias for production", () => {
    process.env.KROGER_API_ENV = "prod";

    expect(getKrogerApiEnvironment()).toBe("production");
    expect(getKrogerApiBaseUrl()).toBe("https://api.kroger.com");
  });

  it("keeps certification host for unknown KROGER_API_ENV values", () => {
    process.env.KROGER_API_ENV = "staging";

    expect(getKrogerApiEnvironment()).toBe("certification");
    expect(getKrogerApiBaseUrl()).toBe("https://api-ce.kroger.com");
    expect(isKrogerOfficialOnlinePricingEligible()).toBe(false);
  });
});
