/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OwnerAfterUpdatePanel } from "@/components/owner/owner-after-update-panel";

const fetchMock = vi.fn();

function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OwnerAfterUpdatePanel", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows a pass line and a fail line after Run checks", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonOk({
        ok: true,
        checks: [
          {
            id: "migrations",
            title: "Database updates",
            ok: true,
            detail: "All updates are applied.",
          },
          {
            id: "markets",
            title: "ZIP list",
            ok: false,
            detail: "No ZIPs are turned on.",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<OwnerAfterUpdatePanel adminKey="test-key" />);
    await user.click(screen.getByRole("button", { name: "Run checks" }));

    expect(
      await screen.findByText("Pass. Database updates. All updates are applied."),
    ).toBeTruthy();
    expect(
      screen.getByText("Fail. ZIP list. No ZIPs are turned on."),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/owner/after-update",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-key" },
      }),
    );
  });
});
