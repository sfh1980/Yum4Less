"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ActiveMarketRow } from "@/lib/active-markets";
import {
  INGEST_OVERLAY_NOTICE,
  type OwnerMarketStorePreview,
} from "@/lib/owner/ingest-markets-copy";
import { formatOwnerMarketPreviewLine } from "@/lib/owner/owner-market-preview-format";

type OwnerMarketsPanelProps = {
  adminKey: string;
};

type PreviewState = {
  zipCode: string;
  city: string;
  state: string;
  alreadyActive: boolean;
  stores: OwnerMarketStorePreview[];
  warnings: string[];
  headline?: string;
};

function authHeaders(key: string): HeadersInit {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function OwnerMarketsPanel({ adminKey }: OwnerMarketsPanelProps) {
  const [zipCode, setZipCode] = useState("");
  const [markets, setMarkets] = useState<ActiveMarketRow[]>([]);
  const [listNotice, setListNotice] = useState<string | undefined>();
  const [overlayNotice] = useState(INGEST_OVERLAY_NOTICE);
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [loadingList, setLoadingList] = useState(false);
  const [checking, setChecking] = useState(false);
  const [activating, setActivating] = useState(false);
  const [preview, setPreview] = useState<PreviewState | undefined>();

  const loadMarkets = useCallback(async () => {
    if (!adminKey.trim()) {
      return;
    }

    setLoadingList(true);
    try {
      const response = await fetch("/api/owner/markets", {
        headers: authHeaders(adminKey),
        cache: "no-store",
      });
      const json = (await response.json()) as {
        ok?: boolean;
        markets?: ActiveMarketRow[];
        error?: string;
      };
      if (!response.ok || !json.ok) {
        setMarkets([]);
        setListNotice(json.error ?? "Ingest markets could not be loaded.");
        return;
      }
      setMarkets(json.markets ?? []);
      setListNotice(undefined);
    } catch {
      setMarkets([]);
      setListNotice("Ingest markets could not be loaded.");
    } finally {
      setLoadingList(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  async function handleCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);
    setPreview(undefined);
    setChecking(true);
    try {
      const response = await fetch("/api/owner/markets/preview", {
        method: "POST",
        headers: authHeaders(adminKey),
        body: JSON.stringify({ zipCode: zipCode.trim() }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        error?: string;
        zipCode?: string;
        alreadyActive?: boolean;
        stores?: OwnerMarketStorePreview[];
        warnings?: string[];
        location?: { city?: string; state?: string };
        admission?: { headline?: string };
      };
      if (!response.ok || !json.ok) {
        setError(json.error ?? "That ZIP could not be checked.");
        return;
      }
      setPreview({
        zipCode: json.zipCode ?? zipCode.trim(),
        city: json.location?.city ?? "",
        state: json.location?.state ?? "",
        alreadyActive: Boolean(json.alreadyActive),
        stores: json.stores ?? [],
        warnings: json.warnings ?? [],
        headline: json.admission?.headline,
      });
    } catch {
      setError("That ZIP could not be checked.");
    } finally {
      setChecking(false);
    }
  }

  async function handleActivate() {
    if (!preview) {
      return;
    }
    setError(undefined);
    setStatus(undefined);
    setActivating(true);
    try {
      const response = await fetch("/api/owner/markets/activate", {
        method: "POST",
        headers: authHeaders(adminKey),
        body: JSON.stringify({ zipCode: preview.zipCode }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        error?: string;
        alreadyActive?: boolean;
        activatedNow?: boolean;
      };
      if (!response.ok || !json.ok) {
        setError(json.error ?? "That ZIP could not be activated.");
        return;
      }
      setStatus(
        json.activatedNow
          ? `${preview.zipCode} is active. The next ingest run will visit this ZIP.`
          : `${preview.zipCode} is on the ingest list.`,
      );
      setPreview(undefined);
      setZipCode("");
      await loadMarkets();
    } catch {
      setError("That ZIP could not be activated.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <section
      aria-labelledby="owner-tab-markets"
      className="panel panel-padding"
      id="owner-panel-markets"
      role="tabpanel"
    >
      <h2>Markets</h2>
      <p className="panel-copy">
        Check first. Invalid ZIPs, failed geocode, and locations outside the
        lower 48 are refused.         The list is recognized grocery banners, clubs, and Target/Whole Foods
        inside the ZIP outline (convenience, bakeries, specialty, and
        independent leftovers omitted). Ranked
        banners are listed first. OSM pins without address tags show as near
        the ZIP city — not a street address. Activating books the ZIP for the
        next ingest run. ZIP 23111 is allowed if you type it — it is not a
        hidden default.
      </p>
      <p className="panel-copy">{overlayNotice}</p>
      {listNotice ? (
        <p className="panel-copy" role="status">
          {listNotice}
        </p>
      ) : null}
      {error ? (
        <p className="panel-copy" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="panel-copy" role="status">
          {status}
        </p>
      ) : null}

      <form className="owner-coverage-filters" onSubmit={handleCheck}>
        <label className="field" htmlFor="owner-market-zip">
          <span className="field-label">ZIP</span>
          <input
            autoComplete="postal-code"
            id="owner-market-zip"
            inputMode="numeric"
            name="owner-market-zip"
            onChange={(event) => setZipCode(event.target.value)}
            pattern="[0-9]{5}"
            placeholder="23220"
            value={zipCode}
          />
        </label>
        <div className="action-row owner-coverage-search-row">
          <button className="primary-button" disabled={checking} type="submit">
            {checking ? "Checking…" : "Check ZIP"}
          </button>
        </div>
      </form>

      {preview ? (
        <div className="owner-market-preview">
          <p className="panel-copy">
            {preview.headline ??
              `${preview.zipCode} · ${preview.city}, ${preview.state}${preview.alreadyActive ? " · already active" : ""}`}
          </p>
          {preview.warnings.map((warning) => (
            <p className="panel-copy" key={warning}>
              {warning}
            </p>
          ))}
          {preview.stores.length > 0 ? (
            <ul className="owner-market-store-list">
              {preview.stores.map((store, index) => (
                <li key={`${store.name}-${store.kind}-${index}`}>
                  {formatOwnerMarketPreviewLine(store)}
                  {store.group === "food-only"
                    ? " · food-only"
                    : store.group === "needs-you"
                      ? " · needs you"
                      : store.inIngestFence === false
                        ? " · outside ingest cap"
                        : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {preview.alreadyActive ? (
            <p className="panel-copy">This ZIP is already on the ingest list.</p>
          ) : (
            <div className="action-row">
              <button
                className="primary-button"
                disabled={activating}
                onClick={() => void handleActivate()}
                type="button"
              >
                {activating ? "Activating…" : `Activate ${preview.zipCode}`}
              </button>
            </div>
          )}
        </div>
      ) : null}

      <h3 className="owner-coverage-caption">Active and paused markets</h3>
      {loadingList ? (
        <p className="panel-copy">Loading markets…</p>
      ) : markets.length === 0 ? (
        <p className="panel-copy">No ingest markets yet.</p>
      ) : (
        <ul className="owner-coverage-list">
          {markets.map((market) => (
            <li className="owner-coverage-row" key={market.zipCode}>
              <p className="owner-coverage-title">
                {market.zipCode} · {market.status} · {market.source}
                {market.densityClass
                  ? ` · ${market.densityClass} ${market.ingestMiles ?? ""} mi`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
