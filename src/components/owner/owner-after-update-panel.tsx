"use client";

import { useState } from "react";
import type { AfterUpdateCheckResult } from "@/lib/owner/after-update-checks";

type OwnerAfterUpdatePanelProps = {
  adminKey: string;
};

function authHeaders(key: string): HeadersInit {
  return { Authorization: `Bearer ${key}` };
}

export function OwnerAfterUpdatePanel({ adminKey }: OwnerAfterUpdatePanelProps) {
  const [checks, setChecks] = useState<AfterUpdateCheckResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function run(checkId?: string) {
    setRunning(checkId ?? "all");
    setError(undefined);
    try {
      const url = checkId
        ? `/api/owner/after-update?check=${encodeURIComponent(checkId)}`
        : "/api/owner/after-update";
      const response = await fetch(url, { headers: authHeaders(adminKey) });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        checks?: AfterUpdateCheckResult[];
      };
      if (!response.ok || !body.ok || !body.checks) {
        setError(body.error ?? "Checks could not be loaded.");
        return;
      }
      setChecks((current) => {
        if (!checkId) {
          return body.checks ?? [];
        }
        const next = new Map(current.map((row) => [row.id, row]));
        for (const row of body.checks ?? []) {
          next.set(row.id, row);
        }
        return [...next.values()];
      });
    } catch {
      setError("Checks could not be loaded.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <section
      aria-labelledby="owner-tab-after-update"
      className="panel panel-padding"
      id="owner-panel-after-update"
      role="tabpanel"
    >
      <h2>After update</h2>
      <p className="panel-copy">
        These lines describe this database only. The laptop and yum4less.com
        are different. A pass does not mean more dinners. Nothing here starts
        the night job or turns a ZIP on.
      </p>
      <div className="action-row">
        <button
          className="primary-button"
          disabled={running !== null}
          onClick={() => void run()}
          type="button"
        >
          {running === "all" ? "Running…" : "Run checks"}
        </button>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {checks.length > 0 ? (
        <ul className="owner-after-update-list">
          {checks.map((check) => (
            <li key={check.id}>
              <p>{`${check.ok ? "Pass" : "Fail"}. ${check.title}. ${check.detail}`}</p>
              <button
                className="secondary-button"
                disabled={running !== null}
                onClick={() => void run(check.id)}
                type="button"
              >
                {running === check.id ? "Running…" : `Run ${check.title} again`}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
