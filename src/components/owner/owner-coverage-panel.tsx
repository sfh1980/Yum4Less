import { useState, type FormEvent } from "react";
import type {
  StoreCoverageRow,
  StoreCoverageSummary,
  StoreCoverageUsableFilter,
} from "@/lib/owner/store-coverage";

type OwnerCoveragePanelProps = {
  stores: StoreCoverageRow[];
  summaries: StoreCoverageSummary[];
  total: number;
  hasMore: boolean;
  freshnessHours: number;
  notice?: string;
  loadingMore: boolean;
  loadingSearch: boolean;
  pageSize: number;
  onSearch: (input: {
    nameQuery: string;
    locationQuery: string;
    usable: StoreCoverageUsableFilter;
  }) => void;
  onLoadMore: () => void;
};

function formatStage(stage: StoreCoverageSummary["rolloutStage"]): string {
  switch (stage) {
    case "ranked":
      return "Ranked";
    case "map_context":
      return "Map context";
    case "ingest_only":
      return "Ingest only";
    case "blocked":
      return "Blocked";
    case "upcoming":
      return "Upcoming";
  }
}

function CoverageBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={`owner-coverage-badge${active ? " owner-coverage-badge--on" : ""}`}
    >
      {label}
    </span>
  );
}

export function OwnerCoveragePanel({
  stores,
  summaries,
  total,
  hasMore,
  freshnessHours,
  notice,
  loadingMore,
  loadingSearch,
  pageSize,
  onSearch,
  onLoadMore,
}: OwnerCoveragePanelProps) {
  const [nameQuery, setNameQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [usable, setUsable] = useState<StoreCoverageUsableFilter>("all");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch({
      nameQuery: nameQuery.trim(),
      locationQuery: locationQuery.trim(),
      usable,
    });
  }

  return (
    <section
      aria-labelledby="owner-tab-coverage"
      className="panel panel-padding"
      id="owner-panel-coverage"
      role="tabpanel"
    >
      <h2>Coverage</h2>
      <p className="panel-copy">
        Read-only checklist over existing storefronts. Usable in the app means a
        ranked dinner chain that is not promotion-blocked and has fresh sale
        prices in the last {freshnessHours} hours. Walmart ads never count.
        Convenience pins such as 7-Eleven stay Other / untracked. Location
        search is city or state — store rows have no ZIP column.
      </p>
      {notice ? (
        <p className="panel-copy" role="status">
          {notice}
        </p>
      ) : null}

      <form className="owner-coverage-filters" onSubmit={handleSearch}>
        <label className="field" htmlFor="owner-coverage-name">
          <span className="field-label">Store name</span>
          <input
            id="owner-coverage-name"
            name="owner-coverage-name"
            onChange={(event) => setNameQuery(event.target.value)}
            placeholder="Kroger, Whole Foods…"
            value={nameQuery}
          />
        </label>
        <label className="field" htmlFor="owner-coverage-location">
          <span className="field-label">Location</span>
          <input
            id="owner-coverage-location"
            name="owner-coverage-location"
            onChange={(event) => setLocationQuery(event.target.value)}
            placeholder="City or state"
            value={locationQuery}
          />
        </label>
        <label className="field" htmlFor="owner-coverage-usable">
          <span className="field-label">Usable in the app</span>
          <select
            id="owner-coverage-usable"
            name="owner-coverage-usable"
            onChange={(event) =>
              setUsable(event.target.value as StoreCoverageUsableFilter)
            }
            value={usable}
          >
            <option value="all">All stores</option>
            <option value="yes">Usable in the app</option>
            <option value="no">Not usable yet</option>
          </select>
        </label>
        <div className="action-row owner-coverage-search-row">
          <button
            className="primary-button"
            disabled={loadingSearch}
            type="submit"
          >
            {loadingSearch ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {summaries.length > 0 ? (
        <div className="owner-coverage-summary-wrap">
          <table className="owner-coverage-table">
            <caption className="owner-coverage-caption">Tracked banners</caption>
            <thead>
              <tr>
                <th scope="col">Banner</th>
                <th scope="col">Stage</th>
                <th scope="col">Seen</th>
                <th scope="col">Mapped</th>
                <th scope="col">Sales</th>
                <th scope="col">Usable</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((row) => (
                <tr key={row.chainId}>
                  <th scope="row">{row.chainLabel}</th>
                  <td>{formatStage(row.rolloutStage)}</td>
                  <td>{row.storeCount}</td>
                  <td>{row.mappedCount}</td>
                  <td>{row.salesCount}</td>
                  <td>{row.usableCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="panel-copy">
        Showing {stores.length}
        {hasMore ? "+" : ""} of {total} matching storefronts.
      </p>
      {stores.length === 0 ? (
        notice ? null : (
          <p className="panel-copy">No storefronts match those filters.</p>
        )
      ) : (
        <ul className="owner-coverage-list">
          {stores.map((row) => (
            <li className="owner-coverage-row" key={row.storeId}>
              <p className="owner-coverage-title">{row.name}</p>
              <p className="panel-copy">
                {row.chainLabel}
                {row.city || row.state
                  ? ` · ${[row.city, row.state].filter(Boolean).join(", ")}`
                  : ""}
                {row.sourceName ? ` · ${row.sourceName}` : ""}
              </p>
              <div className="owner-coverage-badges">
                <CoverageBadge active={row.seen} label="Seen" />
                <CoverageBadge active={row.mapped} label="Mapped" />
                <CoverageBadge active={row.sales} label="Sales" />
                <CoverageBadge
                  active={row.usableInApp}
                  label={row.usableInApp ? "Usable in app" : "Not usable"}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {hasMore ? (
        <div className="action-row owner-load-more-row">
          <button
            className="secondary-button"
            disabled={loadingMore}
            onClick={onLoadMore}
            type="button"
          >
            {loadingMore ? "Loading…" : `Show next ${pageSize} stores`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
