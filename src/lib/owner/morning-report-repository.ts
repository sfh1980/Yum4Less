import { getDbPool } from "@/lib/db";
import type { MorningCheckState } from "@/lib/owner/morning-report";

export type StoredMorningReport = {
  reportDate: string;
  kind: "morning" | "missed";
  body: string;
  needsAttention: boolean;
};

function dateText(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

export async function readExternalCheck(reportDate: string): Promise<{
  codeTests: MorningCheckState;
  siteCheck: MorningCheckState;
} | null> {
  const result = await getDbPool().query<{
    code_tests: MorningCheckState;
    site_check: MorningCheckState;
  }>(
    `
      select code_tests, site_check
      from morning_external_checks
      where check_date = $1::date
    `,
    [reportDate],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return { codeTests: row.code_tests, siteCheck: row.site_check };
}

export async function saveExternalCheck(input: {
  reportDate: string;
  codeTests: MorningCheckState;
  siteCheck: MorningCheckState;
  detail: string;
}): Promise<void> {
  await getDbPool().query(
    `
      insert into morning_external_checks (
        check_date, code_tests, site_check, detail
      )
      values ($1::date, $2, $3, $4)
      on conflict (check_date) do update
      set code_tests = excluded.code_tests,
          site_check = excluded.site_check,
          detail = excluded.detail,
          received_at = now()
    `,
    [input.reportDate, input.codeTests, input.siteCheck, input.detail],
  );
}

export async function listAddedZipCodes(): Promise<Set<string>> {
  const result = await getDbPool().query<{ zip_code: string }>(
    `select zip_code from morning_zip_adds`,
  );
  return new Set(result.rows.map((row) => row.zip_code));
}

export async function listZipsWaitingForTest(
  reportDate: string,
): Promise<{ zipCode: string; addedOn: string }[]> {
  const result = await getDbPool().query<{
    zip_code: string;
    added_on: Date | string;
  }>(
    `
      select zip_code, added_on
      from morning_zip_adds
      where tested_on is null
        and added_on < $1::date
      order by added_on, zip_code
    `,
    [reportDate],
  );
  return result.rows.map((row) => ({
    zipCode: row.zip_code,
    addedOn: dateText(row.added_on),
  }));
}

export async function recordZipAdd(input: {
  zipCode: string;
  addedOn: string;
}): Promise<void> {
  await getDbPool().query(
    `
      insert into morning_zip_adds (zip_code, added_on)
      values ($1, $2::date)
      on conflict (zip_code) do nothing
    `,
    [input.zipCode, input.addedOn],
  );
}

export async function recordZipTest(input: {
  zipCode: string;
  testedOn: string;
  outcome: string;
}): Promise<void> {
  await getDbPool().query(
    `
      update morning_zip_adds
      set tested_on = $2::date,
          outcome = $3
      where zip_code = $1
    `,
    [input.zipCode, input.testedOn, input.outcome],
  );
}

export async function saveMorningReport(input: {
  reportDate: string;
  kind: "morning" | "missed";
  body: string;
  needsAttention: boolean;
}): Promise<void> {
  await getDbPool().query(
    `
      insert into morning_reports (report_date, kind, body, needs_attention)
      values ($1::date, $2, $3, $4)
      on conflict (report_date, kind) do update
      set body = excluded.body,
          needs_attention = excluded.needs_attention,
          created_at = now()
    `,
    [input.reportDate, input.kind, input.body, input.needsAttention],
  );
}

export async function readLatestMorningReport(): Promise<StoredMorningReport | null> {
  const result = await getDbPool().query<{
    report_date: Date | string;
    kind: "morning" | "missed";
    body: string;
    needs_attention: boolean;
  }>(
    `
      select report_date, kind, body, needs_attention
      from morning_reports
      order by report_date desc,
        case kind when 'morning' then 0 else 1 end
      limit 1
    `,
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    reportDate: dateText(row.report_date),
    kind: row.kind,
    body: row.body,
    needsAttention: row.needs_attention,
  };
}

export async function hasMorningReport(reportDate: string): Promise<boolean> {
  const result = await getDbPool().query(
    `
      select 1
      from morning_reports
      where report_date = $1::date
        and kind = 'morning'
    `,
    [reportDate],
  );
  return (result.rowCount ?? 0) > 0;
}

export function isMissingMorningReportSchema(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist/i.test(message) && /morning_/i.test(message);
}
