/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OwnerConsole } from "@/components/owner/owner-console";

const fetchMock = vi.fn();

describe("OwnerConsole", () => {
  afterEach(() => {
    fetchMock.mockReset();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("sends the typed admin key on View and renders feedback + analytics", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/feedback")) {
        return new Response(
          JSON.stringify({
            ok: true,
            feedback: [
              {
                id: 1,
                receivedAt: "2026-08-05T12:00:00.000Z",
                issueType: "general",
                chainLabel: null,
                productDescription: null,
                note: "Works well",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          events: [
            {
              id: 9,
              receivedAt: "2026-08-05T12:01:00.000Z",
              eventName: "rank_meals_completed",
              sessionId: "sess-12345678",
              properties: { result_count_bucket: "1-3" },
              appEnv: "production",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<OwnerConsole />);

    await user.type(screen.getByLabelText(/admin key/i), "secret-owner-key");
    await user.click(screen.getByRole("button", { name: /^view$/i }));

    await waitFor(() => {
      expect(screen.getByText("Works well")).toBeInTheDocument();
    });
    expect(screen.getByText("rank_meals_completed")).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalled();
    const feedbackCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/api/feedback"),
    );
    expect(feedbackCall?.[1]?.headers).toMatchObject({
      Authorization: "Bearer secret-owner-key",
    });
    expect(sessionStorage.getItem("yum4less.owner-admin-key.v1")).toBe(
      "secret-owner-key",
    );
  });

  it("shows an auth error when either list returns 401", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Unauthorized." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<OwnerConsole />);

    await user.type(screen.getByLabelText(/admin key/i), "bad-key");
    await user.click(screen.getByRole("button", { name: /^view$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Wrong or missing admin key/i),
      ).toBeInTheDocument();
    });
  });
});
