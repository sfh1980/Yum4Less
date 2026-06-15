import { readFileSync } from "node:fs";
import {
  buildSnapRetailerLocationId,
  isSnapMapContextRetailerType,
  normalizeSnapRetailerType,
  type SnapRetailerLocationRow,
} from "@/lib/snap-retailer-locations";

type CsvRow = Record<string, string>;

export type SnapRetailerCsvParseReport = {
  parsedRows: number;
  activeRows: number;
  includedRows: number;
  skippedInactive: number;
  skippedStoreType: number;
  skippedIncomplete: number;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeCsvHeaderKey(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_]+/g, " ");
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const rawHeaders = parseCsvLine(lines[0]!);
  const headers = rawHeaders.map(normalizeCsvHeaderKey);
  const rows: CsvRow[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row: CsvRow = {};

    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]!] = values[index] ?? "";
    }

    rows.push(row);
  }

  return rows;
}

function pickField(row: CsvRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCsvHeaderKey(candidate);
    const value = row[normalizedCandidate];
    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
}

function parseNumberField(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseUsDate(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const [month, day, year] = trimmed.split("/").map((part) => Number(part));
  if (!month || !day || !year) {
    return undefined;
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isActiveSnapAuthorization(endDateValue: string, asOf = new Date()): boolean {
  const endDate = parseUsDate(endDateValue);
  if (!endDate) {
    return true;
  }

  return endDate >= asOf;
}

function buildAddressLine(row: CsvRow): string {
  const combined = pickField(row, [
    "Address",
    "ADDRESS",
    "Address Line #1",
    "address1",
    "Additional Address",
  ]);

  if (combined) {
    return combined;
  }

  const streetNumber = pickField(row, ["Street Number", "street number"]);
  const streetName = pickField(row, ["Street Name", "street name"]);
  return [streetNumber, streetName].filter(Boolean).join(" ").trim();
}

function buildSnapRowId(input: {
  recordId?: string;
  state: string;
  zipCode?: string;
  retailerName: string;
  latitude: number;
  longitude: number;
}): string {
  if (input.recordId) {
    return `snap-fns-${input.recordId}`;
  }

  return buildSnapRetailerLocationId(input);
}

function compareAuthorizationRecency(
  left: { authorizationDate: string },
  right: { authorizationDate: string },
): number {
  const leftDate = parseUsDate(left.authorizationDate)?.getTime() ?? 0;
  const rightDate = parseUsDate(right.authorizationDate)?.getTime() ?? 0;
  return rightDate - leftDate;
}

export function parseSnapRetailerCsv(
  content: string,
  snapshotDate: string,
  options: { activeOnly?: boolean; asOf?: Date } = {},
): SnapRetailerLocationRow[] {
  return parseSnapRetailerCsvWithReport(content, snapshotDate, options).rows;
}

export function parseSnapRetailerCsvWithReport(
  content: string,
  snapshotDate: string,
  options: { activeOnly?: boolean; asOf?: Date } = {},
): { rows: SnapRetailerLocationRow[]; report: SnapRetailerCsvParseReport } {
  const activeOnly = options.activeOnly ?? true;
  const asOf = options.asOf ?? new Date();
  const report: SnapRetailerCsvParseReport = {
    parsedRows: 0,
    activeRows: 0,
    includedRows: 0,
    skippedInactive: 0,
    skippedStoreType: 0,
    skippedIncomplete: 0,
  };

  const candidates: Array<
    SnapRetailerLocationRow & {
      recordId?: string;
      authorizationDate: string;
      endDate: string;
    }
  > = [];

  for (const row of parseCsv(content)) {
    report.parsedRows += 1;

    const retailerName = pickField(row, [
      "Store Name",
      "Store_Name",
      "RETAILER_NAME",
      "Retailer Name",
      "storeName",
    ]);
    const retailerType = pickField(row, [
      "Store Type",
      "Store_Type",
      "RETAILER_TYPE",
      "Retailer Type",
      "storeType",
    ]);
    const latitude = parseNumberField(
      pickField(row, ["Latitude", "LATITUDE", "latitude"]),
    );
    const longitude = parseNumberField(
      pickField(row, ["Longitude", "LONGITUDE", "longitude"]),
    );
    const city = pickField(row, ["City", "CITY", "city"]);
    const state = pickField(row, ["State", "STATE", "state"]);
    const zipCode = pickField(row, ["Zip Code", "Zip5", "ZIP5", "Zip", "ZIP", "zip5"]);
    const addressLine1 = buildAddressLine(row);
    const recordId = pickField(row, ["Record ID", "record id", "RETAILER_ID"]);
    const authorizationDate = pickField(row, ["Authorization Date", "authorization date"]);
    const endDate = pickField(row, ["End Date", "end date"]);

    if (
      !retailerName ||
      !retailerType ||
      !city ||
      !state ||
      latitude === undefined ||
      longitude === undefined
    ) {
      report.skippedIncomplete += 1;
      continue;
    }

    if (!isSnapMapContextRetailerType(retailerType)) {
      report.skippedStoreType += 1;
      continue;
    }

    if (activeOnly && !isActiveSnapAuthorization(endDate, asOf)) {
      report.skippedInactive += 1;
      continue;
    }

    report.activeRows += 1;

    candidates.push({
      id: buildSnapRowId({
        recordId: recordId || undefined,
        state,
        zipCode,
        retailerName,
        latitude,
        longitude,
      }),
      retailerName,
      retailerType: normalizeSnapRetailerType(retailerType),
      addressLine1: addressLine1 || undefined,
      city,
      state,
      zipCode: zipCode || undefined,
      latitude,
      longitude,
      snapshotDate,
      recordId: recordId || undefined,
      authorizationDate,
      endDate,
    });
  }

  const bestByRecordId = new Map<string, (typeof candidates)[number]>();

  for (const candidate of candidates) {
    const dedupeKey = candidate.recordId ?? candidate.id;
    const existing = bestByRecordId.get(dedupeKey);

    if (!existing) {
      bestByRecordId.set(dedupeKey, candidate);
      continue;
    }

    if (compareAuthorizationRecency(candidate, existing) > 0) {
      bestByRecordId.set(dedupeKey, candidate);
    }
  }

  const rows = [...bestByRecordId.values()].map(
    ({ recordId: _recordId, authorizationDate: _auth, endDate: _end, ...row }) => row,
  );
  report.includedRows = rows.length;

  return { rows, report };
}

export function loadSnapRetailerCsvFromFile(input: {
  filePath: string;
  snapshotDate: string;
}): SnapRetailerLocationRow[] {
  const content = readFileSync(input.filePath, "utf8");
  return parseSnapRetailerCsv(content, input.snapshotDate);
}

export function loadSnapRetailerCsvFromFileWithReport(input: {
  filePath: string;
  snapshotDate: string;
}): { rows: SnapRetailerLocationRow[]; report: SnapRetailerCsvParseReport } {
  const content = readFileSync(input.filePath, "utf8");
  return parseSnapRetailerCsvWithReport(content, input.snapshotDate);
}
