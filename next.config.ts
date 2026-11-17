import type { NextConfig } from "next";
import {
  SECURITY_HEADER_SOURCE,
  securityResponseHeaders,
} from "./src/lib/security-response-headers";

const nextConfig: NextConfig = {
  // Minimal production image via `next build` → `.next/standalone` (Docker).
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: SECURITY_HEADER_SOURCE,
        headers: securityResponseHeaders(),
      },
    ];
  },
};

export default nextConfig;
