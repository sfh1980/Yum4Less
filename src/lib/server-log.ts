export type ServerLogContext = Record<string, string | number | boolean | undefined>;

function serializeError(error: unknown): { message: string; name?: string } {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }

  return { message: String(error) };
}

/** Structured server-side error log (no PII; safe for production stderr). */
export function logServerError(
  scope: string,
  error: unknown,
  context?: ServerLogContext,
) {
  const payload = {
    level: "error" as const,
    scope,
    ...serializeError(error),
    ...context,
    at: new Date().toISOString(),
  };

  console.error(JSON.stringify(payload));
}
