import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/feedback/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackEnabled = process.env.YUM4LESS_FEEDBACK_ENABLED;
const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;

const insertCustomerFeedback = vi.fn();
const listRecentCustomerFeedback = vi.fn();

vi.mock("@/lib/feedback/feedback-repository", () => ({
  insertCustomerFeedback: (...args: unknown[]) => insertCustomerFeedback(...args),
  listRecentCustomerFeedback: (...args: unknown[]) => listRecentCustomerFeedback(...args),
}));

describe("POST /api/feedback", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    insertCustomerFeedback.mockReset();
    listRecentCustomerFeedback.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ENABLED", originalFeedbackEnabled);
  });

  it("rejects submissions when feedback is disabled", async () => {
    delete process.env.YUM4LESS_FEEDBACK_ENABLED;

    const response = await POST(
      buildFeedbackRequest({
        issueType: "general",
        note: "helpful app",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Feedback is not enabled on this server.",
    });
    expect(insertCustomerFeedback).not.toHaveBeenCalled();
  });

  it("stores validated feedback when enabled", async () => {
    process.env.YUM4LESS_FEEDBACK_ENABLED = "1";
    insertCustomerFeedback.mockResolvedValue(42);

    const response = await POST(
      buildFeedbackRequest({
        issueType: "wrong_price",
        chainLabel: "Kroger",
        productDescription: "ground beef",
        note: "shelf tag was higher",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, id: 42 });
    expect(insertCustomerFeedback).toHaveBeenCalledWith({
      issueType: "wrong_price",
      chainLabel: "Kroger",
      productDescription: "ground beef",
      note: "shelf tag was higher",
    });
  });

  it("rejects forbidden payload fields when enabled", async () => {
    process.env.YUM4LESS_FEEDBACK_ENABLED = "1";

    const response = await POST(
      buildFeedbackRequest({
        issueType: "general",
        mealTitle: "Taco night",
        note: "test",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Feedback payload includes disallowed data.",
    });
    expect(insertCustomerFeedback).not.toHaveBeenCalled();
  });
});

describe("GET /api/feedback", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    listRecentCustomerFeedback.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ENABLED", originalFeedbackEnabled);
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
  });

  it("returns an empty feed when feedback is disabled", async () => {
    delete process.env.YUM4LESS_FEEDBACK_ENABLED;

    const response = await GET(new Request("http://localhost/api/feedback"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      feedback: [],
      hasMore: false,
      limit: 20,
      offset: 0,
    });
    expect(listRecentCustomerFeedback).not.toHaveBeenCalled();
  });

  it("returns 401 when feedback is enabled without admin auth", async () => {
    process.env.YUM4LESS_FEEDBACK_ENABLED = "1";
    delete process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;

    const response = await GET(new Request("http://localhost/api/feedback"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
    expect(listRecentCustomerFeedback).not.toHaveBeenCalled();
  });

  it("returns recent rows when feedback is enabled and admin auth is valid", async () => {
    process.env.YUM4LESS_FEEDBACK_ENABLED = "1";
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    listRecentCustomerFeedback.mockResolvedValue({
      feedback: [
        {
          id: 1,
          receivedAt: "2026-06-04T12:00:00.000Z",
          issueType: "general",
          chainLabel: null,
          productDescription: null,
          note: "Nice work",
        },
      ],
      hasMore: false,
    });

    const response = await GET(
      new Request("http://localhost/api/feedback", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      feedback: [
        {
          id: 1,
          receivedAt: "2026-06-04T12:00:00.000Z",
          issueType: "general",
          chainLabel: null,
          productDescription: null,
          note: "Nice work",
        },
      ],
      hasMore: false,
      limit: 20,
      offset: 0,
    });
    expect(listRecentCustomerFeedback).toHaveBeenCalledWith(20, 0);
  });

  it("clamps optional limit and passes offset for owner console requests", async () => {
    process.env.YUM4LESS_FEEDBACK_ENABLED = "1";
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    listRecentCustomerFeedback.mockResolvedValue({
      feedback: [],
      hasMore: true,
    });

    const response = await GET(
      new Request("http://localhost/api/feedback?limit=999&offset=50", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      hasMore: true,
      limit: 100,
      offset: 50,
    });
    expect(listRecentCustomerFeedback).toHaveBeenCalledWith(100, 50);
  });
});

function buildFeedbackRequest(body: unknown) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
