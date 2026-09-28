/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OwnerMarketsPanel } from "@/components/owner/owner-markets-panel";
import { NO_RANKED_V1_CHAIN_PREVIEW_NOTICE } from "@/lib/owner/ingest-markets-copy";

const fetchMock = vi.fn();

function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OwnerMarketsPanel", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("checks a ZIP, shows found stores, and activates after confirm", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/owner/markets") && (!init || init.method === undefined)) {
        return jsonOk({ ok: true, markets: [] });
      }
      if (url.includes("/api/owner/markets/preview")) {
        return jsonOk({
          ok: true,
          zipCode: "23220",
          alreadyActive: false,
          location: { city: "Richmond", state: "VA" },
          stores: [
            {
              name: "Kroger",
              city: "Richmond",
              state: "VA",
              kind: "grocery",
              inIngestFence: true,
            },
          ],
          admission: {
            headline: "23220 · Richmond, VA",
            chainTools: [{ chainId: "kroger", label: "Kroger family", officialList: true, flyer: true }],
          },
          warnings: [],
          zctaGeometry: {
            type: "Polygon",
            coordinates: [
              [
                [-77.47, 37.54],
                [-77.44, 37.54],
                [-77.44, 37.56],
                [-77.47, 37.56],
                [-77.47, 37.54],
              ],
            ],
          },
        });
      }
      if (url.includes("/api/owner/markets/activate")) {
        return jsonOk({
          ok: true,
          alreadyActive: true,
          activatedNow: true,
          zipCode: "23220",
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<OwnerMarketsPanel adminKey="secret-owner-key" />);

    await waitFor(() => {
      expect(screen.getByText("No ingest markets yet.")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("img", { name: /No coverage area shaded yet/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Shaded coverage only/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Cron uses this table only when ingest YUM4LESS_INGEST_ZIPS is unset/i),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^ZIP$/i), "23220");
    await user.click(screen.getByRole("button", { name: /Check ZIP/i }));

    await waitFor(() => {
      expect(screen.getByText("Kroger · Richmond, VA")).toBeInTheDocument();
    });
    expect(screen.getByText(/Tonight’s ZIP job/i)).toBeInTheDocument();
    expect(screen.getByText(/Kroger family: official list \+ flyer/i)).toBeInTheDocument();
    expect(screen.getByText(/23220 · Richmond, VA/)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /1 shaded shape/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Activate 23220/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/23220 is active. The next ingest run will visit this ZIP/i),
      ).toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/owner/markets/activate"),
      ),
    ).toBe(true);
  });

  it("shows a geocode failure and does not offer activate", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/owner/markets")) {
        return jsonOk({ ok: true, markets: [] });
      }
      if (url.includes("/preview")) {
        return jsonOk(
          {
            ok: false,
            error:
              "GEOCODIO_API_KEY is required in production. Seed ZIP coordinates are disabled.",
          },
          400,
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<OwnerMarketsPanel adminKey="secret-owner-key" />);
    await user.type(screen.getByLabelText(/^ZIP$/i), "99999");
    await user.click(screen.getByRole("button", { name: /Check ZIP/i }));

    await waitFor(() => {
      expect(screen.getByText(/GEOCODIO_API_KEY is required/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Activate/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a no-ranked-chain warning and still offers Activate", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/owner/markets") && (!init || init.method === undefined)) {
        return jsonOk({ ok: true, markets: [] });
      }
      if (url.includes("/api/owner/markets/preview")) {
        return jsonOk({
          ok: true,
          zipCode: "90210",
          alreadyActive: false,
          location: { city: "Beverly Hills", state: "CA" },
          stores: [{ name: "BJ's Wholesale Club", city: "Beverly Hills", state: "CA", kind: "big-box" }],
          warnings: [NO_RANKED_V1_CHAIN_PREVIEW_NOTICE],
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<OwnerMarketsPanel adminKey="secret-owner-key" />);
    await user.type(screen.getByLabelText(/^ZIP$/i), "90210");
    await user.click(screen.getByRole("button", { name: /Check ZIP/i }));

    await waitFor(() => {
      expect(screen.getByText(NO_RANKED_V1_CHAIN_PREVIEW_NOTICE)).toBeInTheDocument();
    });
    expect(screen.getByText(/BJ's Wholesale Club/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Activate 90210/i })).toBeInTheDocument();
  });

  it("shows the 8-mile sentence after a ZIP is picked", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/owner/markets")) {
        return jsonOk({
          ok: true,
          markets: [
            {
              zipCode: "23220",
              status: "active",
              source: "ops",
              priority: 1,
              latitude: 37.55,
              longitude: -77.45,
              densityClass: "urban",
              ingestMiles: 8,
              notes: null,
              updatedAt: null,
            },
          ],
          coverageShades: [],
        });
      }
      if (url.includes("/api/owner/markets/reach")) {
        return jsonOk({
          ok: true,
          zipCode: "23220",
          sentence: "1 of 3 nearby stores can be priced. 2 sit in ZIPs that are still off.",
          circle: { latitude: 37.55, longitude: -77.45, radiusMiles: 8 },
          shades: [],
          labelZipCodes: ["23225"],
          offZips: [
            {
              zipCode: "23225",
              storeCount: 2,
              reason: "Turn this ZIP on.",
              stores: [
                {
                  storeId: "aldi-7003",
                  name: "Forest Hill",
                  chainLabel: "Aldi",
                  city: "Richmond",
                  state: "VA",
                  sourceStoreId: "7003",
                  addressLine: "7319 Forest Hill Ave",
                  postalCode: "23225",
                },
              ],
            },
          ],
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<OwnerMarketsPanel adminKey="secret-owner-key" />);
    await user.click(await screen.findByRole("button", { name: "23220" }));

    expect(
      await screen.findByText(/2 sit in ZIPs that are still off/),
    ).toBeInTheDocument();
    expect(screen.getByText("23225 · 2 stores")).toBeInTheDocument();
    await user.click(screen.getByText("23225 · 2 stores"));
    expect(screen.getByRole("heading", { name: "Aldi" })).toBeInTheDocument();
    expect(screen.getByText("Forest Hill")).toBeInTheDocument();
    expect(screen.getByText("7319 Forest Hill Ave, Richmond, VA 23225")).toBeInTheDocument();
    expect(screen.getByText("Store id 7003")).toBeInTheDocument();
    expect(screen.getAllByText("Turn this ZIP on.")).toHaveLength(1);
  });
});
