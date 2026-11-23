import { createReadStream, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename } from "node:path";
import type { Transform } from "node:stream";
import { getDbPool } from "@/lib/db";
import { shouldSkipFuelLocation } from "@/lib/ingest/fuel-location";
import type { StoreKind } from "@/lib/market-catalog-types";
import { OSM_EXTRACT_SOURCE } from "@/lib/osm-grocery-file";
import {
  buildOsmCatalogStoreId,
  isDisusedOrClosedOsmFoodRetailElement,
  resolveOsmAddressLocality,
  shouldKeepOsmFoodRetailShop,
} from "@/lib/osm-food-retail-discovery";

const require = createRequire(import.meta.url);

export type OsmGroceryPlaceDraft = {
  id: string;
  osmType: "node" | "way";
  osmId: number;
  name: string;
  kind: StoreKind;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  shopTag: string;
};

export type OsmGroceryReadCounts = {
  kept: number;
  skippedConvenience: number;
  skippedFuel: number;
  skippedOther: number;
  skippedWithoutPoint: number;
  skippedRelations: number;
};

export type OsmGroceryExtract = {
  places: OsmGroceryPlaceDraft[];
  counts: OsmGroceryReadCounts;
  fileTimestamp: Date;
};

export type OsmGroceryLoadSummary = OsmGroceryReadCounts & {
  filePath: string;
  fileTimestamp: string;
  dryRun: boolean;
  wouldInsert: number;
  wouldUpdate: number;
  wouldMarkMissing: number;
  wouldClose: number;
  inserted: number;
  updated: number;
  markedMissing: number;
  closed: number;
  wrote: boolean;
};

type RawNode = {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
  timestamp: Date | null;
};

type RawWay = {
  id: number;
  refs: number[];
  tags: Record<string, string>;
  timestamp: Date | null;
};

const EMPTY_COUNTS = (): OsmGroceryReadCounts => ({
  kept: 0,
  skippedConvenience: 0,
  skippedFuel: 0,
  skippedOther: 0,
  skippedWithoutPoint: 0,
  skippedRelations: 0,
});

export function groceryPlaceKind(shopTag: string, _name: string): StoreKind {
  if (shopTag === "wholesale" || shopTag === "department_store") {
    return "big-box";
  }
  return "grocery";
}

/**
 * Grocery tags already used for map discovery.
 * Convenience and fuel never become pins. A department store is kept only
 * when the name is Target.
 */
export function explainOsmGrocerySkip(input: {
  tags: Record<string, string>;
  name: string | null;
  hasPoint: boolean;
}): "keep" | "convenience" | "fuel" | "other" | "without-point" {
  if (isDisusedOrClosedOsmFoodRetailElement(input.tags)) {
    return "other";
  }
  const shop = input.tags.shop?.trim() ?? "";
  const amenity = input.tags.amenity?.trim() ?? "";
  if (
    shop === "convenience" ||
    amenity === "convenience"
  ) {
    return "convenience";
  }
  if (
    shouldSkipFuelLocation({
      osmShop: shop,
      osmAmenity: amenity,
      name: input.name,
    })
  ) {
    return "fuel";
  }
  if (!input.name || !shop || !shouldKeepOsmFoodRetailShop(shop, input.name)) {
    return "other";
  }
  if (!input.hasPoint) {
    return "without-point";
  }
  return "keep";
}

function rememberSkip(
  counts: OsmGroceryReadCounts,
  reason: ReturnType<typeof explainOsmGrocerySkip>,
) {
  if (reason === "convenience") {
    counts.skippedConvenience += 1;
  } else if (reason === "fuel") {
    counts.skippedFuel += 1;
  } else if (reason === "without-point") {
    counts.skippedWithoutPoint += 1;
  } else if (reason === "other") {
    counts.skippedOther += 1;
  }
}

export function placesFromOsmElements(input: {
  nodes: RawNode[];
  ways: RawWay[];
  relations: number;
  fallbackTimestamp: Date;
}): OsmGroceryExtract {
  const counts = EMPTY_COUNTS();
  counts.skippedRelations = input.relations;
  const points = new Map<number, { lat: number; lon: number }>();
  let newest = 0;
  for (const node of input.nodes) {
    points.set(node.id, { lat: node.lat, lon: node.lon });
    if (node.timestamp) {
      newest = Math.max(newest, node.timestamp.getTime());
    }
  }

  const places: OsmGroceryPlaceDraft[] = [];
  const consider = (
    osmType: "node" | "way",
    osmId: number,
    tags: Record<string, string>,
    point: { lat: number; lon: number } | null,
    timestamp: Date | null,
  ) => {
    if (timestamp) {
      newest = Math.max(newest, timestamp.getTime());
    }
    if (!tags.shop?.trim() && !tags.amenity?.trim() && !tags.name?.trim()) {
      return;
    }
    const name =
      tags.name?.trim() || tags.brand?.trim() || tags.operator?.trim() || null;
    const reason = explainOsmGrocerySkip({
      tags,
      name,
      hasPoint: point !== null,
    });
    if (reason !== "keep" || !name || !point) {
      rememberSkip(counts, reason);
      return;
    }
    const shopTag = tags.shop.trim();
    const locality = resolveOsmAddressLocality(tags);
    places.push({
      id: buildOsmCatalogStoreId({
        osmType,
        osmId,
        name,
        kind: "grocery",
        city: locality.city,
        state: locality.state,
        latitude: point.lat,
        longitude: point.lon,
        shopTag,
      }),
      osmType,
      osmId,
      name,
      kind: groceryPlaceKind(shopTag, name),
      city: locality.city,
      state: locality.state,
      latitude: point.lat,
      longitude: point.lon,
      shopTag,
    });
    counts.kept += 1;
  };

  for (const node of input.nodes) {
    consider("node", node.id, node.tags, { lat: node.lat, lon: node.lon }, node.timestamp);
  }
  for (const way of input.ways) {
    const point = centroid(way.refs, points);
    consider("way", way.id, way.tags, point, way.timestamp);
  }

  return {
    places,
    counts,
    fileTimestamp: newest > 0 ? new Date(newest) : input.fallbackTimestamp,
  };
}

function centroid(
  refs: number[],
  points: Map<number, { lat: number; lon: number }>,
): { lat: number; lon: number } | null {
  if (refs.length === 0) {
    return null;
  }
  let lat = 0;
  let lon = 0;
  let seen = 0;
  for (const ref of refs) {
    const point = points.get(ref);
    if (!point) {
      return null;
    }
    lat += point.lat;
    lon += point.lon;
    seen += 1;
  }
  if (seen === 0) {
    return null;
  }
  return { lat: lat / seen, lon: lon / seen };
}

function readAttribute(source: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`, "u").exec(source);
  return match?.[1] ?? null;
}

function readTags(body: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const match of body.matchAll(/<tag\b([^>]*?)\/>/gu)) {
    const key = readAttribute(match[1] ?? "", "k");
    const value = readAttribute(match[1] ?? "", "v");
    if (key && value !== null) {
      tags[key] = value;
    }
  }
  return tags;
}

function readTimestamp(source: string): Date | null {
  const raw = readAttribute(source, "timestamp");
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseOsmXml(xml: string, fallbackTimestamp: Date): OsmGroceryExtract {
  const nodes: RawNode[] = [];
  const ways: RawWay[] = [];
  let relations = 0;
  for (const match of xml.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/gu)) {
    const attrs = match[1] ?? "";
    const id = Number(readAttribute(attrs, "id"));
    const lat = Number(readAttribute(attrs, "lat"));
    const lon = Number(readAttribute(attrs, "lon"));
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    nodes.push({
      id,
      lat,
      lon,
      tags: readTags(match[2] ?? ""),
      timestamp: readTimestamp(attrs),
    });
  }
  for (const match of xml.matchAll(/<way\b([^>]*?)(?:\/>|>([\s\S]*?)<\/way>)/gu)) {
    const attrs = match[1] ?? "";
    const id = Number(readAttribute(attrs, "id"));
    if (!Number.isFinite(id)) {
      continue;
    }
    const refs: number[] = [];
    for (const ref of (match[2] ?? "").matchAll(/<nd\b[^>]*\bref="(\d+)"/gu)) {
      refs.push(Number(ref[1]));
    }
    ways.push({
      id,
      refs,
      tags: readTags(match[2] ?? ""),
      timestamp: readTimestamp(attrs),
    });
  }
  relations = [...xml.matchAll(/<relation\b/gu)].length;
  return placesFromOsmElements({ nodes, ways, relations, fallbackTimestamp });
}

type OsmPbfItem = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  refs?: number[];
  info?: { timestamp?: number };
};

function timestampFromPbf(info: { timestamp?: number } | undefined): Date | null {
  const raw = info?.timestamp;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  const millis = raw > 1_000_000_000_000 ? raw : raw * 1000;
  const parsed = new Date(millis);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseOsmPbfFile(filePath: string, fallbackTimestamp: Date): Promise<OsmGroceryExtract> {
  const createParser = require("osm-pbf-parser") as () => Transform;
  const parser = createParser();
  const nodes: RawNode[] = [];
  const ways: RawWay[] = [];
  let relations = 0;

  return new Promise((resolve, reject) => {
    parser.on("data", (items: OsmPbfItem[]) => {
      for (const item of items) {
        if (item.type === "node" && typeof item.id === "number") {
          if (typeof item.lat !== "number" || typeof item.lon !== "number") {
            continue;
          }
          nodes.push({
            id: item.id,
            lat: item.lat,
            lon: item.lon,
            tags: item.tags ?? {},
            timestamp: timestampFromPbf(item.info),
          });
        } else if (item.type === "way" && typeof item.id === "number") {
          ways.push({
            id: item.id,
            refs: item.refs ?? [],
            tags: item.tags ?? {},
            timestamp: timestampFromPbf(item.info),
          });
        } else if (item.type === "relation") {
          relations += 1;
        }
      }
    });
    parser.on("error", reject);
    parser.on("end", () => {
      resolve(placesFromOsmElements({ nodes, ways, relations, fallbackTimestamp }));
    });
    createReadStream(filePath).pipe(parser);
  });
}

export async function readOsmGroceryExtract(filePath: string): Promise<OsmGroceryExtract> {
  const fallbackTimestamp = statSync(filePath).mtime;
  const lower = basename(filePath).toLowerCase();
  if (lower.endsWith(".osm.pbf") || lower.endsWith(".pbf")) {
    return parseOsmPbfFile(filePath, fallbackTimestamp);
  }
  return parseOsmXml(readFileSync(filePath, "utf8"), fallbackTimestamp);
}

const UPSERT_CHUNK = 500;

export async function loadOsmGroceryFile(input: {
  filePath: string;
  dryRun: boolean;
}): Promise<OsmGroceryLoadSummary> {
  const extract = await readOsmGroceryExtract(input.filePath);
  const base = {
    ...extract.counts,
    filePath: input.filePath,
    fileTimestamp: extract.fileTimestamp.toISOString(),
    dryRun: input.dryRun,
    wouldInsert: 0,
    wouldUpdate: 0,
    wouldMarkMissing: 0,
    wouldClose: 0,
    inserted: 0,
    updated: 0,
    markedMissing: 0,
    closed: 0,
    wrote: false,
  };
  if (extract.places.length === 0) {
    return base;
  }

  const pool = getDbPool();
  const ids = extract.places.map((place) => place.id);
  const existing = await pool.query<{
    existing_count: number;
    missing_count: number;
    close_count: number;
  }>(
    `
      select
        (select count(*)::int from osm_grocery_places where id = any($1::text[])) as existing_count,
        (
          select count(*)::int
          from osm_grocery_places
          where source_name = $2
            and not (id = any($1::text[]))
        ) as missing_count,
        (
          select count(*)::int
          from osm_grocery_places
          where source_name = $2
            and closed_at is null
            and consecutive_misses + 1 >= 2
            and not (id = any($1::text[]))
        ) as close_count
    `,
    [ids, OSM_EXTRACT_SOURCE],
  );
  const row = existing.rows[0];
  const existingCount = Number(row?.existing_count ?? 0);
  base.wouldInsert = extract.places.length - existingCount;
  base.wouldUpdate = existingCount;
  base.wouldMarkMissing = Number(row?.missing_count ?? 0);
  base.wouldClose = Number(row?.close_count ?? 0);
  if (input.dryRun) {
    return base;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (let index = 0; index < extract.places.length; index += UPSERT_CHUNK) {
      const chunk = extract.places.slice(index, index + UPSERT_CHUNK);
      await client.query(
        `
          insert into osm_grocery_places (
            id, osm_type, osm_id, name, kind, city, state,
            latitude, longitude, shop_tag, source_name, file_timestamp,
            consecutive_misses, closed_at
          )
          select
            id, osm_type, osm_id, name, kind, city, state,
            latitude, longitude, shop_tag, $11, $12::timestamptz, 0, null
          from unnest(
            $1::text[], $2::text[], $3::bigint[], $4::text[], $5::text[],
            $6::text[], $7::text[], $8::numeric[], $9::numeric[], $10::text[]
          ) as row(
            id, osm_type, osm_id, name, kind, city, state,
            latitude, longitude, shop_tag
          )
          on conflict (id) do update set
            osm_type = excluded.osm_type,
            osm_id = excluded.osm_id,
            name = excluded.name,
            kind = excluded.kind,
            city = excluded.city,
            state = excluded.state,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            shop_tag = excluded.shop_tag,
            source_name = excluded.source_name,
            file_timestamp = excluded.file_timestamp,
            consecutive_misses = 0,
            closed_at = null,
            updated_at = now()
        `,
        [
          chunk.map((place) => place.id),
          chunk.map((place) => place.osmType),
          chunk.map((place) => place.osmId),
          chunk.map((place) => place.name),
          chunk.map((place) => place.kind),
          chunk.map((place) => place.city),
          chunk.map((place) => place.state),
          chunk.map((place) => place.latitude),
          chunk.map((place) => place.longitude),
          chunk.map((place) => place.shopTag),
          OSM_EXTRACT_SOURCE,
          extract.fileTimestamp.toISOString(),
        ],
      );
    }
    const missed = await client.query(
      `
        update osm_grocery_places
        set consecutive_misses = consecutive_misses + 1
        where source_name = $2
          and not (id = any($1::text[]))
      `,
      [ids, OSM_EXTRACT_SOURCE],
    );
    const closed = await client.query(
      `
        update osm_grocery_places
        set closed_at = now()
        where source_name = $1
          and consecutive_misses >= 2
          and closed_at is null
      `,
      [OSM_EXTRACT_SOURCE],
    );
    await client.query("commit");
    base.inserted = base.wouldInsert;
    base.updated = base.wouldUpdate;
    base.markedMissing = missed.rowCount ?? 0;
    base.closed = closed.rowCount ?? 0;
    base.wrote = true;
    return base;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function formatOsmGroceryLoadSummary(summary: OsmGroceryLoadSummary): string {
  const lines = [
    `File: ${summary.filePath}`,
    `File timestamp: ${summary.fileTimestamp}`,
    `Kept: ${summary.kept}`,
    `Skipped convenience: ${summary.skippedConvenience}`,
    `Skipped fuel: ${summary.skippedFuel}`,
    `Skipped other: ${summary.skippedOther}`,
    `Skipped without a point: ${summary.skippedWithoutPoint}`,
    `Skipped relations: ${summary.skippedRelations}`,
    `Would insert: ${summary.wouldInsert}`,
    `Would update: ${summary.wouldUpdate}`,
    `Would mark missing: ${summary.wouldMarkMissing}`,
    `Would close: ${summary.wouldClose}`,
  ];
  if (summary.dryRun) {
    lines.push("Dry run: no rows written.");
  } else if (!summary.wrote) {
    lines.push("Nothing written. An empty file is left alone.");
  } else {
    lines.push(
      `Wrote ${summary.inserted} new and ${summary.updated} updated. Marked ${summary.markedMissing} missing. Closed ${summary.closed}.`,
    );
  }
  return lines.join("\n");
}
