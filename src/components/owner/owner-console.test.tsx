/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OwnerConsole } from "@/components/owner/owner-console";

const fetchMock = vi.fn();

function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const EMPTY_COVERAGE = {
  ok: true,
  stores: [] as const,
  summaries: [] as const,
  freshnessHours: 24,
  hasMore: false,
  total: 0,
};

describe("OwnerConsole", () => {
  afterEach(() => {
    fetchMock.mockReset();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("sends the typed admin key on View and switches owner tabs", async () => {
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
      if (url.includes("/api/owner/ingredient-reviews")) {
        return new Response(
          JSON.stringify({ ok: true, reviews: [], hasMore: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/owner/store-coverage")) {
        return jsonOk({
          ok: true,
          stores: [
            {
              storeId: "kroger-mechanicsville",
              name: "Kroger",
              chainLabel: "Kroger",
              city: "Mechanicsville",
              state: "VA",
              seen: true,
              mapped: true,
              sales: true,
              usableInApp: true,
              sourceName: "kroger-official-api",
            },
          ],
          summaries: [
            {
              chainId: "kroger",
              chainLabel: "Kroger",
              rolloutStage: "ranked",
              storeCount: 1,
              mappedCount: 1,
              salesCount: 1,
              usableCount: 1,
            },
          ],
          freshnessHours: 24,
          hasMore: false,
          total: 1,
        });
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
      expect(
        screen.getByRole("tab", { name: "Ingredient review" }),
      ).toHaveAttribute("aria-selected", "true");
    });
    expect(
      screen.getByRole("heading", { name: "Ingredient review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No flyer lines waiting for review.")).toBeInTheDocument();
    expect(screen.queryByText("Works well")).not.toBeInTheDocument();
    expect(screen.queryByText("rank_meals_completed")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "User feedback" }));
    expect(screen.getByText("Works well")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Ingredient review" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Analytics" }));
    expect(screen.getByText("rank_meals_completed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Show next 50 events/i }),
    ).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("tab", { name: "Coverage" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Coverage" })).toBeInTheDocument();
    expect(screen.getByText("Usable in app")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("tab", { name: "Ingredient review" }),
    ).toHaveAttribute("aria-selected", "true");

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
      if (url.includes("/api/owner/ingredient-reviews")) {
        return new Response(
          JSON.stringify({ ok: true, reviews: [], hasMore: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/owner/store-coverage")) {
        return jsonOk(EMPTY_COVERAGE);
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
      expect(
        screen.getByRole("tab", { name: "Analytics" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("tab", { name: "Analytics" }));
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

  it("posts Yes on a pending flyer line", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (typeof init?.method === "string" && init.method === "POST") {
        return new Response(
          JSON.stringify({ ok: true, ingredientId: "pears" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/feedback")) {
        return new Response(
          JSON.stringify({ ok: true, feedback: [], hasMore: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/analytics/events")) {
        return new Response(
          JSON.stringify({ ok: true, events: [], hasMore: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          reviews: [
            {
              id: 7,
              normalizedLabel: "bartlett pears",
              rawProductName: "Bartlett Pears",
              chain: "kroger",
              seenAt: "2026-08-22T00:00:00.000Z",
              suggestedIngredientId: "pears",
              suggestedName: "Pears",
              suggestedCategory: "produce",
            },
          ],
          hasMore: false,
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
      expect(screen.getByText("Bartlett Pears")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^yes$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Saved as pears/i)).toBeInTheDocument();
    });
    const reviewPost = fetchMock.mock.calls.find(
      (call) =>
        String(call[0]).includes("/api/owner/ingredient-reviews") &&
        call[1]?.method === "POST",
    );
    expect(reviewPost?.[1]?.headers).toMatchObject({
      Authorization: "Bearer secret-owner-key",
    });
    expect(JSON.parse(String(reviewPost?.[1]?.body))).toMatchObject({
      normalizedLabel: "bartlett pears",
      decision: "yes",
      ingredientId: "pears",
      ingredientName: "Pears",
      category: "produce",
    });
  });

  it("explains food-id format and posts a new id with name and category", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (typeof init?.method === "string" && init.method === "POST") {
        return new Response(
          JSON.stringify({ ok: true, ingredientId: "imitation-crab" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/feedback")) {
        return new Response(
          JSON.stringify({ ok: true, feedback: [], hasMore: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/analytics/events")) {
        return new Response(
          JSON.stringify({ ok: true, events: [], hasMore: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          reviews: [
            {
              id: 9,
              normalizedLabel: "imitation crab meat",
              rawProductName: "Imitation Crab Meat",
              chain: "publix",
              seenAt: "2026-08-24T00:00:00.000Z",
              suggestedIngredientId: null,
              suggestedName: null,
              suggestedCategory: null,
            },
          ],
          hasMore: false,
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
      expect(screen.getByText("Imitation Crab Meat")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/How to create or reuse a food id/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/canonical food id/i)).toHaveValue(
      "imitation-crab-meat",
    );
    expect(screen.getByLabelText(/shopper-facing name/i)).toHaveValue(
      "Imitation Crab Meat",
    );

    await user.click(screen.getByRole("button", { name: /^yes$/i }));
    expect(
      screen.getByText(/Pick a category/i),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/canonical food id/i));
    await user.type(screen.getByLabelText(/canonical food id/i), "Imitation Crab");
    await user.selectOptions(screen.getByLabelText(/category/i), "protein");
    await user.click(screen.getByRole("button", { name: /^yes$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Saved as imitation-crab/i)).toBeInTheDocument();
    });
    const reviewPost = fetchMock.mock.calls.find(
      (call) =>
        String(call[0]).includes("/api/owner/ingredient-reviews") &&
        call[1]?.method === "POST",
    );
    expect(JSON.parse(String(reviewPost?.[1]?.body))).toMatchObject({
      normalizedLabel: "imitation crab meat",
      decision: "yes",
      ingredientId: "imitation-crab",
      ingredientName: "Imitation Crab Meat",
      category: "protein",
    });
  });

  it("still unlocks when store coverage needs migrate 026", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/owner/store-coverage")) {
        return jsonOk(
          {
            ok: false,
            error:
              "Store coverage could not be loaded. Apply db/init/026 if chain_registry is missing.",
          },
          503,
        );
      }
      if (url.includes("/api/feedback")) {
        return jsonOk({ ok: true, feedback: [], hasMore: false });
      }
      if (url.includes("/api/analytics/events")) {
        return jsonOk({ ok: true, events: [], hasMore: false });
      }
      if (url.includes("/api/owner/ingredient-reviews")) {
        return jsonOk({ ok: true, reviews: [], hasMore: false });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<OwnerConsole />);
    await user.type(screen.getByLabelText(/admin key/i), "secret-owner-key");
    await user.click(screen.getByRole("button", { name: /^view$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Ingredient review" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "Coverage" }));
    expect(
      screen.getByText(/Apply db\/init\/026 if chain_registry is missing/i),
    ).toBeInTheDocument();
  });
});
