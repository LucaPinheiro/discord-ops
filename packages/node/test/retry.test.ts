import { describe, expect, it } from "vitest";
import { computeBackoff, isRetryableStatus, resolveRetry } from "../src/retry.js";

describe("retry", () => {
  describe("resolveRetry", () => {
    it("applies defaults", () => {
      expect(resolveRetry()).toEqual({ maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 5000 });
    });
    it("respects overrides", () => {
      expect(resolveRetry({ maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000 })).toEqual({
        maxAttempts: 5,
        baseDelayMs: 100,
        maxDelayMs: 1000,
      });
    });
    it("never returns maxAttempts < 1", () => {
      expect(resolveRetry({ maxAttempts: 0 }).maxAttempts).toBe(1);
    });
  });

  describe("isRetryableStatus", () => {
    it("is true for 429", () => {
      expect(isRetryableStatus(429)).toBe(true);
    });
    it("is true for 5xx", () => {
      expect(isRetryableStatus(500)).toBe(true);
      expect(isRetryableStatus(502)).toBe(true);
      expect(isRetryableStatus(599)).toBe(true);
    });
    it("is false for 4xx (non-429)", () => {
      expect(isRetryableStatus(400)).toBe(false);
      expect(isRetryableStatus(401)).toBe(false);
      expect(isRetryableStatus(404)).toBe(false);
    });
    it("is false for 2xx and 3xx", () => {
      expect(isRetryableStatus(200)).toBe(false);
      expect(isRetryableStatus(301)).toBe(false);
    });
  });

  describe("computeBackoff", () => {
    const cfg = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 };
    it("returns value within cap", () => {
      for (let i = 0; i < 50; i++) {
        const v = computeBackoff(3, cfg);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1000);
      }
    });
    it("honors retryAfter", () => {
      expect(computeBackoff(1, cfg, 250)).toBe(250);
    });
    it("caps retryAfter at maxDelayMs", () => {
      expect(computeBackoff(1, cfg, 10_000)).toBe(1000);
    });
  });
});
