// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CfWebAnalytics } from "@/components/cf-web-analytics";
import { readCfWebAnalyticsToken } from "@/lib/cf-web-analytics";

vi.mock("next/script", () => ({
  default: ({
    src,
    ...props
  }: {
    src?: string;
    "data-cf-beacon"?: string;
  }) => createElement("script", { src, ...props }),
}));

describe("Cloudflare web analytics token", () => {
  it("is absent when unset and present when the token is a public site token", () => {
    expect(readCfWebAnalyticsToken({})).toBeNull();
    expect(readCfWebAnalyticsToken({ YUM4LESS_CF_WEB_ANALYTICS_TOKEN: "  " })).toBeNull();
    expect(
      readCfWebAnalyticsToken({ YUM4LESS_CF_WEB_ANALYTICS_TOKEN: "bad token" }),
    ).toBeNull();
    expect(
      readCfWebAnalyticsToken({ YUM4LESS_CF_WEB_ANALYTICS_TOKEN: 'abc"defghij' }),
    ).toBeNull();
    expect(
      readCfWebAnalyticsToken({
        YUM4LESS_CF_WEB_ANALYTICS_TOKEN: "abcdef1234567890",
      }),
    ).toBe("abcdef1234567890");
  });

  it("renders the beacon only when a token is passed", () => {
    const { rerender } = render(createElement(CfWebAnalytics, { token: null }));
    expect(document.querySelector("script")).toBeNull();

    rerender(createElement(CfWebAnalytics, { token: "abcdef1234567890" }));
    const script = document.querySelector("script");
    expect(script?.getAttribute("src")).toBe(
      "https://static.cloudflareinsights.com/beacon.min.js",
    );
    expect(script?.getAttribute("data-cf-beacon")).toBe(
      JSON.stringify({ token: "abcdef1234567890" }),
    );
    expect(screen.queryByText(/YUM4LESS_/)).not.toBeInTheDocument();
  });
});
