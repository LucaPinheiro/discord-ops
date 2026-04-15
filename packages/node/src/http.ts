import { DiscordOpsError, ErrorCodes } from "./errors.js";
import {
  computeBackoff,
  isRetryableStatus,
  resolveRetry,
  sleep,
  type ResolvedRetryConfig,
} from "./retry.js";
import type { Logger, RetryConfig } from "./types.js";

export interface HttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: unknown;
}

export interface HttpResponse {
  status: number;
  data: any;
  attempts: number;
}

export interface HttpExecutorDeps {
  fetchImpl?: typeof fetch;
  timeoutMs: number;
  retry?: RetryConfig;
  logger: Logger;
}

/**
 * Executes a single HTTP request with timeout + retries.
 * Only 429 and 5xx are retried. 4xx (other than 429) fail fast.
 * Network errors are retried up to maxAttempts.
 */
export async function executeRequest(req: HttpRequest, deps: HttpExecutorDeps): Promise<HttpResponse> {
  const retry = resolveRetry(deps.retry);
  const fetchImpl = deps.fetchImpl ?? fetch;

  let lastError: unknown;
  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    try {
      const response = await callOnce(fetchImpl, req, deps.timeoutMs);
      if (response.status >= 200 && response.status < 300) {
        return { status: response.status, data: response.data, attempts: attempt };
      }
      if (isRetryableStatus(response.status) && attempt < retry.maxAttempts) {
        const delay = extractRetryAfter(response) ?? undefined;
        const backoff = computeBackoff(attempt, retry, delay);
        deps.logger.warn("transient error, retrying", {
          status: response.status,
          attempt,
          nextDelayMs: backoff,
        });
        await sleep(backoff);
        continue;
      }
      // non-retryable or last attempt
      throw new DiscordOpsError("Discord API returned a non-successful status", {
        code: response.status === 429 ? ErrorCodes.RATE_LIMITED : ErrorCodes.DISCORD_API,
        status: response.status,
        cause: response.data,
      });
    } catch (err) {
      lastError = err;
      // Pass through DiscordOpsError raised above without re-wrapping.
      if (err instanceof DiscordOpsError) {
        if (err.code !== ErrorCodes.NETWORK && err.code !== ErrorCodes.TIMEOUT) {
          throw err;
        }
      }
      // Network / timeout — retry if attempts remain.
      if (attempt < retry.maxAttempts) {
        const backoff = computeBackoff(attempt, retry);
        deps.logger.warn("network error, retrying", {
          attempt,
          nextDelayMs: backoff,
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(backoff);
        continue;
      }
      throw normalizeError(err);
    }
  }
  // Should be unreachable.
  throw normalizeError(lastError);
}

interface RawResponse {
  status: number;
  data: any;
  headers: Headers;
}

async function callOnce(fetchImpl: typeof fetch, req: HttpRequest, timeoutMs: number): Promise<RawResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // leave as raw text
      }
    }
    return { status: response.status, data, headers: response.headers };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new DiscordOpsError(`request timed out after ${timeoutMs}ms`, {
        code: ErrorCodes.TIMEOUT,
        cause: err,
      });
    }
    throw new DiscordOpsError("network error calling Discord", {
      code: ErrorCodes.NETWORK,
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractRetryAfter(resp: RawResponse): number | undefined {
  const header = resp.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return Math.floor(seconds * 1000);
  }
  if (
    resp.data &&
    typeof resp.data === "object" &&
    "retry_after" in resp.data &&
    typeof (resp.data as any).retry_after === "number"
  ) {
    return Math.floor((resp.data as any).retry_after * 1000);
  }
  return undefined;
}

function normalizeError(err: unknown): DiscordOpsError {
  if (err instanceof DiscordOpsError) return err;
  return new DiscordOpsError("unknown error", { code: ErrorCodes.UNKNOWN, cause: err });
}

// Re-export for tests
export type { ResolvedRetryConfig };
