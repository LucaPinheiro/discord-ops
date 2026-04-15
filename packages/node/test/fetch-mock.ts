/**
 * Tiny test helper to stub fetch with a scripted sequence of responses.
 */

export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  throwError?: Error;
  delayMs?: number;
}

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export function makeFetchMock(responses: MockResponse[]) {
  const calls: FetchCall[] = [];
  let idx = 0;

  const fetchImpl: typeof fetch = async (input, init) => {
    const r = responses[idx] ?? responses[responses.length - 1];
    idx++;

    const url = typeof input === "string" ? input : (input as URL).toString();
    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        headers[k] = v;
      }
    }
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, method, headers, body });

    if (r?.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, r.delayMs));
    }

    // Honor abort
    if (init?.signal?.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }

    if (r?.throwError) throw r.throwError;

    const status = r?.status ?? 200;
    const bodyStr = r?.body === undefined ? "" : typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    const respHeaders = new Headers(r?.headers ?? {});

    return new Response(bodyStr, {
      status,
      headers: respHeaders,
    });
  };

  return { fetchImpl, calls, get callCount() { return idx; } };
}
