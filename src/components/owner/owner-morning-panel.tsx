"use client";

import { useEffect, useState } from "react";

type MorningNote = {
  reportDate: string;
  body: string;
  needsAttention: boolean;
};

type OwnerMorningPanelProps = {
  adminKey: string;
};

export function OwnerMorningPanel({ adminKey }: OwnerMorningPanelProps) {
  const [report, setReport] = useState<MorningNote | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const response = await fetch("/api/owner/morning-report", {
          headers: { Authorization: `Bearer ${adminKey}` },
        });
        const body = (await response.json()) as {
          ok?: boolean;
          error?: string;
          report?: MorningNote | null;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok || !body.ok) {
          setError(body.error ?? "The morning note could not be loaded.");
          setReport(null);
          return;
        }
        setReport(body.report ?? null);
      } catch {
        if (!cancelled) {
          setError("The morning note could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [adminKey]);

  return (
    <section
      aria-labelledby="owner-tab-morning"
      className="panel panel-padding"
      id="owner-panel-morning"
      role="tabpanel"
    >
      <h2>This morning</h2>
      <p className="panel-copy">
        The same note Discord gets. It describes this database. A pass does
        not mean more dinners.
      </p>
      {loading ? <p className="panel-copy">Loading the morning note.</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && !report ? (
        <p className="panel-copy">No morning note yet.</p>
      ) : null}
      {report ? (
        <p className="owner-morning-note">{report.body}</p>
      ) : null}
    </section>
  );
}
