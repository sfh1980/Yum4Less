import { isDiscordWebhookUrl } from "@/lib/owner/morning-report";

export async function postMorningDiscord(body: string): Promise<{ ok: boolean }> {
  const url = process.env.YUM4LESS_MORNING_DISCORD_WEBHOOK_URL?.trim();
  if (!url || !isDiscordWebhookUrl(url)) {
    return { ok: false };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: body.slice(0, 1800) }),
    signal: AbortSignal.timeout(8_000),
  });
  return { ok: response.ok };
}
