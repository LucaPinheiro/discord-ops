import type { RetryConfig } from "./types.js";

export interface ResolvedRetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export function resolveRetry(cfg?: RetryConfig): ResolvedRetryConfig {
  return {
    maxAttempts: Math.max(1, cfg?.maxAttempts ?? 3),
    baseDelayMs: Math.max(0, cfg?.baseDelayMs ?? 250),
    maxDelayMs: Math.max(0, cfg?.maxDelayMs ?? 5000),
  };
}

/**
 * Exponential backoff with jitter.
 * attempt is 1-indexed. Returns ms to wait before the next try.
 */
export function computeBackoff(attempt: number, cfg: ResolvedRetryConfig, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined && retryAfterMs >= 0) {
    return Math.min(retryAfterMs, cfg.maxDelayMs);
  }
  const exp = cfg.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exp, cfg.maxDelayMs);
  // Full jitter: random between 0 and capped.
  const jitter = Math.floor(Math.random() * capped);
  return jitter;
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
