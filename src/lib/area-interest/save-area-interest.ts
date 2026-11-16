"use client";

import { trackClientEventOnce } from "@/lib/analytics/track-client-event";

const STORAGE_KEY = "yum4less_area_interest_zips";
const pending = new Set<string>();

export type SaveAreaInterestResult = "saved" | "already" | "failed";

/** One save per ZIP per browser session. The database still counts later sessions. */
export async function saveAreaInterest(zip: string): Promise<SaveAreaInterestResult> {
  if (!/^\d{5}$/.test(zip)) {
    return "failed";
  }

  const saved = readSavedZips();
  if (saved.has(zip) || pending.has(zip)) {
    return "already";
  }

  pending.add(zip);
  try {
    const response = await fetch("/api/area-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    if (!response.ok || body?.ok !== true) {
      return "failed";
    }

    saved.add(zip);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...saved]));
    trackClientEventOnce("area_interest_saved", zip, { zip });
    return "saved";
  } catch {
    return "failed";
  } finally {
    pending.delete(zip);
  }
}

export function hasSavedAreaInterest(zip: string): boolean {
  return readSavedZips().has(zip);
}

function readSavedZips(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((entry) => typeof entry === "string" && /^\d{5}$/.test(entry)));
  } catch {
    return new Set();
  }
}
