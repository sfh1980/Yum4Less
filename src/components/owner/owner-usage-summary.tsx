"use client";

import { useEffect, useState } from "react";
import type { AreaInterestRow } from "@/lib/area-interest/area-interest-repository";
import type { UsageSummary, UsageZipCount } from "@/lib/analytics/usage-summary";

type OwnerUsageSummaryProps = {
  adminKey: string;
};

type UsageResponse = {
  ok?: boolean;
  usage?: UsageSummary;
  areaInterest?: AreaInterestRow[];
  areaInterestNotice?: string;
  error?: string;
};

export function OwnerUsageSummary({ adminKey }: OwnerUsageSummaryProps) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [areaInterest, setAreaInterest] = useState<AreaInterestRow[] | null>(null);
  const [areaInterestNotice, setAreaInterestNotice] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => {
    if (!adminKey) {
      return;
    }

    const controller = new AbortController();
    setNotice(undefined);

    void fetch("/api/owner/usage", {
      headers: { Authorization: `Bearer ${adminKey}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as UsageResponse;
        if (!response.ok || body.ok !== true || !isUsageSummary(body.usage)) {
          setUsage(null);
          setAreaInterest(null);
          setNotice(body.error ?? "Usage summary is unavailable.");
          return;
        }
        setUsage(body.usage);
        setAreaInterest(Array.isArray(body.areaInterest) ? body.areaInterest : []);
        setAreaInterestNotice(body.areaInterestNotice);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setUsage(null);
        setNotice("Usage summary is unavailable.");
      });

    return () => controller.abort();
  }, [adminKey]);

  return (
    <section aria-labelledby="owner-usage-title">
      <h3 id="owner-usage-title">Usage, last 30 days</h3>
      {notice ? (
        <p className="field-hint" role="status">
          {notice}
        </p>
      ) : null}
      {usage ? (
        <>
          <p className="panel-copy">
            Visitors are distinct sessions. A ranked dinner list is a finished
            rank with at least one dinner. Map-only is a search with stores and
            no ranked dinners. ZIPs are counted only when a shopper typed one.
          </p>
          <ul className="owner-analytics-scoreboard">
            <li>Reached a ranked dinner list: {usage.rankedDinnerSessions}</li>
            <li>Saw map-only: {usage.mapOnlySessions}</li>
          </ul>
          <h4>Visitors per day</h4>
          {usage.visitorsByDay.length === 0 ? (
            <p className="panel-copy">No sessions in this window.</p>
          ) : (
            <ul>
              {usage.visitorsByDay.map((row) => (
                <li key={row.day}>
                  {row.day}: {row.visitors}
                </li>
              ))}
            </ul>
          )}
          <ZipList title="Top ZIPs, map-only" rows={usage.mapOnlyTopZips} />
          <ZipList title="Top ZIPs, area interest" rows={usage.areaInterestTopZips} />
          <h4>Area interest counts</h4>
          {areaInterestNotice ? (
            <p className="field-hint" role="status">
              {areaInterestNotice}
            </p>
          ) : null}
          {!areaInterest || areaInterest.length === 0 ? (
            <p className="panel-copy">No ZIP requests yet.</p>
          ) : (
            <ol>
              {areaInterest.map((row) => (
                <li key={row.zip}>
                  {row.zip}: {row.requestCount}
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </section>
  );
}

function ZipList({ title, rows }: { title: string; rows: UsageZipCount[] }) {
  return (
    <>
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p className="panel-copy">None in this window.</p>
      ) : (
        <ol>
          {rows.map((row) => (
            <li key={row.zip}>
              {row.zip}: {row.count}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function isUsageSummary(value: UsageSummary | undefined): value is UsageSummary {
  return Boolean(
    value &&
      Array.isArray(value.visitorsByDay) &&
      typeof value.rankedDinnerSessions === "number" &&
      typeof value.mapOnlySessions === "number" &&
      Array.isArray(value.mapOnlyTopZips) &&
      Array.isArray(value.areaInterestTopZips),
  );
}
