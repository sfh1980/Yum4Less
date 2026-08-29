import { randomUUID } from "node:crypto";
import { getDbPool } from "@/lib/db";
import { SCHEDULED_INGEST_STEP_ORDER } from "@/lib/scheduled-ingest-pipeline";
import { logServerError } from "@/lib/server-log";

export type IngestJobKind = (typeof SCHEDULED_INGEST_STEP_ORDER)[number];

export type IngestJobRow = {
  id: string;
  kind: IngestJobKind;
  jobKey: string;
  runDate: string;
  status: "queued" | "running" | "succeeded" | "failed" | "skipped";
  priority: number;
};

const JOB_PRIORITY: Record<IngestJobKind, number> = {
  "map-catalog": 20,
  "weekly-ad": 30,
  "snap-ensure": 40,
  "provider-sync": 50,
  "themealdb-from-sales": 60,
  "ranked-price-freshness": 90,
};

export function utcRunDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function ingestQueueWorkerEnabled(): boolean {
  return process.env.YUM4LESS_INGEST_QUEUE_WORKER === "1";
}

export async function enqueueScheduledIngestJobs(input?: {
  runDate?: string;
}): Promise<number> {
  const runDate = input?.runDate ?? utcRunDate();
  let inserted = 0;
  for (const kind of SCHEDULED_INGEST_STEP_ORDER) {
    const id = randomUUID();
    try {
      const result = await getDbPool().query(
        `
          insert into ingest_jobs (
            id, kind, job_key, run_date, status, priority
          )
          values ($1, $2, $3, $4::date, 'queued', $5)
          on conflict (kind, job_key, run_date) do nothing
        `,
        [id, kind, kind, runDate, JOB_PRIORITY[kind]],
      );
      inserted += result.rowCount ?? 0;
    } catch (error) {
      logServerError("ingest-jobs.enqueue", error, { kind, runDate });
      throw error;
    }
  }
  return inserted;
}

export async function claimNextIngestJob(): Promise<IngestJobRow | null> {
  const result = await getDbPool().query<{
    id: string;
    kind: IngestJobKind;
    job_key: string;
    run_date: Date | string;
    status: IngestJobRow["status"];
    priority: number;
  }>(
    `
      with next as (
        select id
        from ingest_jobs
        where status = 'queued'
        order by priority asc, created_at asc
        for update skip locked
        limit 1
      )
      update ingest_jobs
      set status = 'running', started_at = now(), attempts = attempts + 1
      where id in (select id from next)
      returning id, kind, job_key, run_date, status, priority
    `,
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    kind: row.kind,
    jobKey: row.job_key,
    runDate:
      row.run_date instanceof Date
        ? row.run_date.toISOString().slice(0, 10)
        : String(row.run_date).slice(0, 10),
    status: row.status,
    priority: row.priority,
  };
}

export async function finishIngestJob(input: {
  id: string;
  status: "succeeded" | "failed" | "skipped";
  error?: string;
}): Promise<void> {
  await getDbPool().query(
    `
      update ingest_jobs
      set status = $2, finished_at = now(), last_error = $3
      where id = $1
    `,
    [input.id, input.status, input.error ?? null],
  );
}
