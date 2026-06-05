export function isTestDbWipeAllowed() {
  return process.env.NODE_ENV === "test";
}

export function assertTestDbWipeAllowed(operation: string) {
  if (!isTestDbWipeAllowed()) {
    throw new Error(
      `${operation} is restricted to test environments (NODE_ENV=test). Import from @/lib/test-only/price-observation-writes in integration tests only.`,
    );
  }
}
