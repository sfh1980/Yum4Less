import { describe, expect, it } from "vitest";
import {
  formatOwnerChainToolLine,
  listOwnerChainTools,
} from "@/lib/owner/owner-chain-tools";

describe("owner chain tools", () => {
  it("lists flyer adapters we already wrote, plus official lists for Kroger/Publix/Target", () => {
    const tools = listOwnerChainTools();
    expect(tools.find((row) => row.chainId === "kroger")).toMatchObject({
      officialList: true,
      flyer: true,
    });
    expect(tools.find((row) => row.chainId === "aldi")).toMatchObject({
      officialList: false,
      flyer: true,
    });
    expect(tools.find((row) => row.chainId === "publix")).toMatchObject({
      officialList: true,
      flyer: true,
    });
    expect(formatOwnerChainToolLine(tools[0]!)).toMatch(/official list \+ flyer|flyer/);
  });
});
