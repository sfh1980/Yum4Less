/**
 * Numeric id from a dinner's existing full-recipe page URL.
 * Anything else is dropped so the event cannot carry a title or a free-text URL.
 */
export function publicRecipePageId(url: string | undefined): string | null {
  if (!url || url.length > 200) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "www.themealdb.com") {
    return null;
  }
  if (parsed.search || parsed.hash) {
    return null;
  }

  const match = /^\/meal\/(\d{1,12})\/?$/.exec(parsed.pathname);
  return match?.[1] ?? null;
}
