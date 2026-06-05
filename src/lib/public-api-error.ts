import { NextResponse } from "next/server";
import { logServerError } from "@/lib/server-log";

export function publicApiErrorResponse(
  scope: string,
  error: unknown,
  userMessage: string,
  status = 500,
) {
  logServerError(scope, error);
  return NextResponse.json({ ok: false, error: userMessage }, { status });
}
