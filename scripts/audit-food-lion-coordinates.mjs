import { loadEnvLocal } from "./lib/load-env-local.mjs";
import {
  loadCoordinateSanityAuditStores,
  toStoreForCoordinateSanityCheck,
} from "../src/lib/chain-rollout-coordinate-sanity.ts";
import { checkCoordinateSanityBatch } from "../src/lib/geo/coordinate-sanity-check.ts";

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const requestedIds = parseRequestedIds(process.argv.slice(2));
  const auditStores = (await loadCoordinateSanityAuditStores("food-lion")).filter(
    (store) => requestedIds === null || requestedIds.has(store.storeId),
  );
  const userAgent = process.env.YUM4LESS_NOMINATIM_USER_AGENT?.trim();
  if (!userAgent) {
    console.warn(
      "YUM4LESS_NOMINATIM_USER_AGENT is not set; using the local fallback identifier for this audit run.",
    );
  }

  const results = await checkCoordinateSanityBatch(
    auditStores.map(toStoreForCoordinateSanityCheck),
    userAgent ? { userAgent } : {},
  );
  const flaggedRows = auditStores.flatMap((store) => {
    const result = results.get(store.storeId);
    if (!result) {
      return [];
    }

    if (result.flagReasons.length === 0) {
      return [];
    }

    return [
      {
        store_id: store.storeId,
        source_name: store.sourceName ?? "",
        saved_lat: formatNumber(store.storedCoords.lat),
        saved_lon: formatNumber(store.storedCoords.lon),
        geocoded_lat: formatNumber(result.suggestedCoords?.lat ?? null),
        geocoded_lon: formatNumber(result.suggestedCoords?.lon ?? null),
        delta_miles: formatNumber(result.deltaMiles),
        flag_reasons: result.flagReasons.join(", "),
      },
    ];
  });
  const buckets = bucketFlaggedRows(flaggedRows);

  console.log(
    `Checked ${auditStores.length} Food Lion catalog row(s); flagged ${flaggedRows.length}.`,
  );

  if (flaggedRows.length === 0) {
    console.log("No flagged Food Lion coordinate rows found.");
    return;
  }

  console.log("");
  renderBucket("Correction candidates", buckets.correctionCandidates);
  renderBucket("Metadata-only", buckets.metadataOnly);
  renderBucket("Manual review", buckets.manualReview);
}

function renderMarkdownTable(rows) {
  const columns = [
    "store_id",
    "source_name",
    "saved_lat",
    "saved_lon",
    "geocoded_lat",
    "geocoded_lon",
    "delta_miles",
    "flag_reasons",
  ];

  const header = `| ${columns.join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) =>
    `| ${columns.map((column) => escapeMarkdownCell(row[column])).join(" | ")} |`,
  );

  return [header, divider, ...body].join("\n");
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function renderBucket(label, rows) {
  console.log(`### ${label} (${rows.length})`);
  if (rows.length === 0) {
    console.log("");
    console.log("_None_");
    console.log("");
    return;
  }

  console.log("");
  console.log(renderMarkdownTable(rows));
  console.log("");
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(4);
}

function bucketFlaggedRows(rows) {
  const correctionCandidates = [];
  const metadataOnly = [];
  const manualReview = [];

  for (const row of rows) {
    const reasons = row.flag_reasons
      .split(",")
      .map((reason) => reason.trim())
      .filter(Boolean);

    if (reasons.includes("coordinate_delta")) {
      correctionCandidates.push(row);
      continue;
    }

    if (reasons.length === 1 && reasons[0] === "unknown_city_state") {
      metadataOnly.push(row);
      continue;
    }

    manualReview.push(row);
  }

  return {
    correctionCandidates,
    metadataOnly,
    manualReview,
  };
}

function parseRequestedIds(argv) {
  const idsArg = argv.find((entry) => entry.startsWith("--ids="));
  if (!idsArg) {
    return null;
  }

  return new Set(
    idsArg
      .slice("--ids=".length)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
