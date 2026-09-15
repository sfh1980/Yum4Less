import type { MetadataRoute } from "next";

/**
 * Website SEO robots.txt (not scrape-compliance M128).
 * Hides the key-gated owner console and API routes from well-behaved crawlers.
 * Does not lock /owner — admin key remains the access control.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/owner", "/api/"],
    },
  };
}
