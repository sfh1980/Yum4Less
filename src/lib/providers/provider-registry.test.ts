import { describe, expect, it } from "vitest";
import { getStoreDiscoveryProviders } from "@/lib/providers/provider-registry";

describe("getStoreDiscoveryProviders", () => {
  it("registers Kroger, Publix, and Walmart discovery adapters in rollout order", () => {
    const providers = getStoreDiscoveryProviders();

    expect(providers.map((provider) => provider.provider)).toEqual([
      "kroger",
      "publix",
      "walmart",
    ]);
    expect(providers[1]?.label).toBe("Publix store discovery");
    expect(providers[1]?.configured).toBe(true);
    expect(providers[2]?.label).toBe("Walmart official store discovery");
    expect(providers[2]?.configured).toBe(false);
  });
});
