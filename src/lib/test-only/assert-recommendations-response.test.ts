import { describe, expect, it } from "vitest";
import {
  assertRecommendationsHaveMeals,
  assertRecommendationsHttpOk,
} from "@/lib/test-only/assert-recommendations-response";

describe("assertRecommendationsHttpOk (Wave 1a proof-of-catch)", () => {
  it("accepts HTTP 200", () => {
    expect(() => assertRecommendationsHttpOk({ status: 200 })).not.toThrow();
    expect(() =>
      assertRecommendationsHttpOk({ status: 200, okBody: { ok: true } }),
    ).not.toThrow();
  });

  it("fails loud on 429 instead of resembling a wait timeout", () => {
    expect(() =>
      assertRecommendationsHttpOk({
        status: 429,
        okBody: { ok: false, error: "Too many requests" },
      }),
    ).toThrow(/rate limited \(HTTP 429\).*Too many requests/i);
  });

  it("fails loud on 5xx", () => {
    expect(() => assertRecommendationsHttpOk({ status: 503 })).toThrow(
      /server error \(HTTP 503\)/i,
    );
  });

  it("fails loud on 4xx", () => {
    expect(() =>
      assertRecommendationsHttpOk({
        status: 400,
        okBody: { ok: false, error: "Invalid payload" },
      }),
    ).toThrow(/client error \(HTTP 400\).*Invalid payload/i);
  });

  it("fails loud when HTTP 200 body says ok:false", () => {
    expect(() =>
      assertRecommendationsHttpOk({
        status: 200,
        okBody: { ok: false, error: "Market unavailable" },
      }),
    ).toThrow(/HTTP 200 but ok:false.*Market unavailable/i);
  });
});

describe("assertRecommendationsHaveMeals (Wave 1b proof-of-catch)", () => {
  it("accepts a non-empty recommendations list", () => {
    expect(() =>
      assertRecommendationsHaveMeals({
        ok: true,
        experience: { recommendations: [{ title: "Pasta" }] },
      }),
    ).not.toThrow();
  });

  it("fails loud on ok-but-empty meals instead of hanging on accordion", () => {
    expect(() =>
      assertRecommendationsHaveMeals({
        ok: true,
        experience: { recommendations: [] },
      }),
    ).toThrow(/0 recipes.*accordion will never appear/i);
  });

  it("fails loud when recommendations are missing", () => {
    expect(() => assertRecommendationsHaveMeals({ ok: true, experience: {} })).toThrow(
      /0 recipes/i,
    );
  });
});
