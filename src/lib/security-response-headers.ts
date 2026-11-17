/**
 * Browser response headers for every route.
 * Next.js applies `SECURITY_HEADER_SOURCE` from `next.config.ts`.
 * The content-security policy is report-only: browsers log mismatches and
 * still load the page. There is no report-uri and no report-to endpoint.
 */

export const SECURITY_HEADER_SOURCE = "/(.*)";

/**
 * Origins the shopper's browser actually loads, plus the keywords those loads need.
 * Server-side fetches (retailers, Flipp, Overpass, census, geocoding) are not
 * included: the content-security policy does not apply to them.
 */
export function contentSecurityPolicyReportOnly(): string {
  const directives = [
    "default-src 'self'",
    // Next.js scripts are same-origin. The App Router also injects an inline
    // bootstrap script, so 'unsafe-inline' matches what the page already runs.
    // Cloudflare Web Analytics loads beacon.min.js from static.cloudflareinsights.com.
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    // Same-origin API calls, plus the beacon's own endpoint. The script posts
    // to https://cloudflareinsights.com/cdn-cgi/rum and may also call back to
    // the static host it was loaded from.
    "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com",
    // Map tiles: Leaflet uses a/b/c.tile.openstreetmap.org.
    // TheMealDB publishes meal photos on www.themealdb.com (the strMealThumb
    // host). Recipe links on the card use that same host; photos are not
    // rendered today, and this origin is listed so a photo would be allowed
    // to load when one is shown.
    // data: and blob: cover small inline images. Leaflet's control sprites
    // are bundled and served from this origin ('self').
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://www.themealdb.com",
    // No web-font host. The UI uses system fonts only (see globals.css).
    "font-src 'self'",
    // React style attributes and Leaflet's inline marker positioning.
    "style-src 'self' 'unsafe-inline'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
  ];

  return directives.join("; ");
}

export function securityResponseHeaders(): Array<{ key: string; value: string }> {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    // Geolocation is the shopper location path and is limited to this origin.
    // Camera and microphone stay off; the site does not use them.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(self)",
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicyReportOnly(),
    },
  ];
}

/** True when a next.config `source` pattern applies to a URL path. */
export function securityHeaderSourceMatches(source: string, pathname: string): boolean {
  const expression = source.replace(/\(\.\*\)/g, "(.*)");
  return new RegExp(`^${expression}$`).test(pathname);
}
