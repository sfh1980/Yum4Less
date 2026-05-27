import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export type WeeklyAdCapturePayload = {
  chain: WeeklyAdChain;
  zipCode: string;
  sourceUrl: string;
  html: string;
  networkJsonBodies?: string[];
  errorMessage?: string;
};

export function shouldCaptureWeeklyAdArtifacts() {
  return process.env.YUM4LESS_WEEKLY_AD_CAPTURE === "1";
}

export function captureWeeklyAdArtifacts(input: WeeklyAdCapturePayload) {
  if (!shouldCaptureWeeklyAdArtifacts()) {
    return undefined;
  }

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const captureDir = join(
    process.cwd(),
    "captures",
    "weekly-ad",
    input.chain,
    timestamp,
  );
  mkdirSync(captureDir, { recursive: true });

  writeFileSync(join(captureDir, "page.html"), input.html, "utf8");
  writeFileSync(
    join(captureDir, "meta.json"),
    JSON.stringify(
      {
        chain: input.chain,
        zipCode: input.zipCode,
        sourceUrl: input.sourceUrl,
        errorMessage: input.errorMessage,
        capturedAt: new Date().toISOString(),
        networkPayloadCount: input.networkJsonBodies?.length ?? 0,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (input.networkJsonBodies?.length) {
    writeFileSync(
      join(captureDir, "network.json"),
      JSON.stringify(input.networkJsonBodies, null, 2),
      "utf8",
    );
  }

  return captureDir;
}
