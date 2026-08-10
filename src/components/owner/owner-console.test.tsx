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
            hasMore: false,
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
          hasMore: true,
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
    expect(
      screen.getByRole("button", { name: /Show next 50 events/i }),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalled();
    const feedbackCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/api/feedback"),
    );
    expect(String(feedbackCall?.[0])).toContain("offset=0");
    expect(feedbackCall?.[1]?.headers).toMatchObject({
      Authorization: "Bearer secret-owner-key",
    });
    expect(sessionStorage.getItem("yum4less.owner-admin-key.v1")).toBe(
      "secret-owner-key",
    );
  });

  it("loads the next analytics page when Show next is clicked", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/feedback")) {
        return new Response(
          JSON.stringify({ ok: true, feedback: [], hasMore: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("offset=1")) {
        return new Response(
          JSON.stringify({
            ok: true,
            events: [
              {
                id: 10,
                receivedAt: "2026-08-05T11:00:00.000Z",
                eventName: "location_search_started",
                sessionId: "sess-12345678",
                properties: { mode: "zip" },
                appEnv: "production",
              },
            ],
            hasMore: false,
            limit: 50,
            offset: 1,
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
          hasMore: true,
          limit: 50,
          offset: 0,
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
      expect(screen.getByText("rank_meals_completed")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /Show next 50 events/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("location_search_started")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Show next 50 events/i }),
    ).not.toBeInTheDocument();
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
