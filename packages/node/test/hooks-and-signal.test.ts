import { describe, expect, it, vi } from "vitest";
import { createNotifier } from "../src/notifier.js";
import { silentLogger } from "../src/logger.js";
import { DiscordOpsError } from "../src/errors.js";
import { makeFetchMock } from "./fetch-mock.js";
import type { RetryEvent } from "../src/types.js";

const WEBHOOK = "https://discord.com/api/webhooks/123456789012345678/abc";

describe("onError hook (fire-and-forget)", () => {
  it("fires when send fails and the caller did not await", async () => {
    const mock = makeFetchMock([{ status: 400, body: { message: "bad" } }]);
    const onError = vi.fn();
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        retry: { baseDelayMs: 1 },
        onError,
      },
      { fetchImpl: mock.fetchImpl },
    );

    notify({ topic: "login", message: "hi" });
    await new Promise((r) => setTimeout(r, 30));

    expect(onError).toHaveBeenCalledTimes(1);
    const [err, input] = onError.mock.calls[0]!;
    expect(err).toBeInstanceOf(DiscordOpsError);
    expect((err as DiscordOpsError).code).toBe("discord_api_error");
    expect((input as { topic: string }).topic).toBe("login");
  });

  it("does not fire when send succeeds", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "ok" } }]);
    const onError = vi.fn();
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        onError,
      },
      { fetchImpl: mock.fetchImpl },
    );

    notify({ topic: "login", message: "hi" });
    await new Promise((r) => setTimeout(r, 30));
    expect(onError).not.toHaveBeenCalled();
  });

  it("swallows exceptions thrown inside the onError hook", async () => {
    const mock = makeFetchMock([{ status: 400 }]);
    const logger = { ...silentLogger, error: vi.fn() };
    const onError = () => {
      throw new Error("hook exploded");
    };
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger,
        retry: { baseDelayMs: 1 },
        onError,
      },
      { fetchImpl: mock.fetchImpl },
    );

    // Must not throw synchronously or crash the process.
    expect(() => notify({ topic: "login", message: "hi" })).not.toThrow();
    await new Promise((r) => setTimeout(r, 30));
    expect(logger.error).toHaveBeenCalledWith(
      "onError hook threw",
      expect.objectContaining({ error: "hook exploded" }),
    );
  });
});

describe("onRetry hook", () => {
  it("fires on transient status (e.g. 429) with reason=status", async () => {
    const mock = makeFetchMock([
      { status: 429, body: { retry_after: 0.01 } },
      { status: 200, body: { id: "ok" } },
    ]);
    const events: RetryEvent[] = [];
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
        onRetry: (e) => events.push(e),
      },
      { fetchImpl: mock.fetchImpl },
    );

    const res = await notify.async({ topic: "login", message: "hi" });
    expect(res.ok).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]!.reason).toBe("status");
    expect(events[0]!.status).toBe(429);
    expect(events[0]!.attempt).toBe(1);
  });

  it("fires on network error with reason=network", async () => {
    const mock = makeFetchMock([
      { throwError: Object.assign(new Error("dns fail"), { name: "TypeError" }) },
      { status: 200, body: { id: "ok" } },
    ]);
    const events: RetryEvent[] = [];
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
        onRetry: (e) => events.push(e),
      },
      { fetchImpl: mock.fetchImpl },
    );

    await notify.async({ topic: "login", message: "hi" });
    expect(events).toHaveLength(1);
    expect(events[0]!.reason).toBe("network");
    expect(events[0]!.error).toBeInstanceOf(Error);
  });
});

describe("AbortSignal support", () => {
  it("rejects with aborted code if signal already aborted", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "ok" } }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl },
    );

    const ac = new AbortController();
    ac.abort(new Error("user cancelled"));

    const res = await notify.async({ topic: "login", message: "hi", signal: ac.signal });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("aborted");
    expect(mock.calls).toHaveLength(0);
  });

  it("aborts an in-flight request when signal fires mid-flight", async () => {
    const mock = makeFetchMock([
      { delayMs: 100, status: 200, body: { id: "ok" } },
    ]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        // No retries so abort surfaces directly.
        retry: { maxAttempts: 1 },
      },
      { fetchImpl: mock.fetchImpl },
    );

    const ac = new AbortController();
    const pending = notify.async({ topic: "login", message: "hi", signal: ac.signal });
    setTimeout(() => ac.abort(new Error("cancelled mid-flight")), 10);
    const res = await pending;

    expect(res.ok).toBe(false);
    expect(res.error).toContain("aborted");
  });
});

describe("webhook URL dedup", () => {
  it("replaces existing wait= param instead of appending a duplicate", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "m" } }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: `${WEBHOOK}?wait=false&foo=bar` },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl },
    );
    await notify.async({ topic: "login", message: "hi" });

    const url = mock.calls[0]!.url;
    const params = new URL(url).searchParams;
    expect(params.getAll("wait")).toEqual(["true"]);
    expect(params.get("foo")).toBe("bar");
  });
});
