import Script from "next/script";

type CfWebAnalyticsProps = {
  token: string | null;
};

/** Cloudflare's standard beacon. Render nothing when the owner left the token unset. */
export function CfWebAnalytics({ token }: CfWebAnalyticsProps) {
  if (!token) {
    return null;
  }

  return (
    <Script
      data-cf-beacon={JSON.stringify({ token })}
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
    />
  );
}
