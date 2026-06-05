import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  insertCustomerFeedback,
  listRecentCustomerFeedback,
} from "@/lib/feedback/feedback-repository";

describe("customer_feedback repository (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query("delete from customer_feedback where note like 'integration:%'");
    await resetDbPoolForTests();
  });

  it("inserts and lists recent sanitized feedback rows", async () => {
    const id = await insertCustomerFeedback({
      issueType: "wrong_price",
      chainLabel: "Kroger",
      productDescription: "chicken thighs",
      note: "integration: shelf tag mismatch",
    });

    expect(id).toBeGreaterThan(0);

    const rows = await listRecentCustomerFeedback(5);
    const saved = rows.find((row) => row.id === id);

    expect(saved).toMatchObject({
      issueType: "wrong_price",
      chainLabel: "Kroger",
      productDescription: "chicken thighs",
      note: "integration: shelf tag mismatch",
    });
    expect(saved?.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
