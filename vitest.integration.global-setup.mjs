import { ensureTestDatabase } from "./scripts/ensure-test-db.mjs";

export default async function globalSetup() {
  await ensureTestDatabase();
}
