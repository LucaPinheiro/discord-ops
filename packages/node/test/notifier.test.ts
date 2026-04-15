import { describe, expect, it, vi } from "vitest";
import { createNotifier } from "../src/notifier.js";
import { silentLogger } from "../src/logger.js";
import { makeFetchMock } from "./fetch-mock.js";

const WEBHOOK = "https://discord.com/api/webhooks/123456789012345678/abc";

describe("createNotifier (webhook mode)", () => {
  it("sends a message fire-and-forget and returns void", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "msgid1" } }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        retry: { baseDelayMs: 1 },
      },
      { fetchImpl: mock.fetchImpl }
    );

    const result = notify({ topic: "login", message: "hello" });
    expect(result).toBeUndefined();

    // Wait a tick for the promise to resolve
    await new Promise((r) => setTimeout(r, 10));
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]!.url).toContain(WEBHOOK);
    expect(mock.calls[0]!.body).toMatchObject({ content: "hello" });
  });

  it("async() returns NotifyResult with messageId", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "msgid2" } }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        retry: { baseDelayMs: 1 },
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "login", message: "hi" });
    expect(res.ok).toBe(true);
    expect(res.messageId).toBe("msgid2");
    expect(res.attempts).toBe(1);
  });

  it("skips when environment is not in enabledIn", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "x" } }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["production"],
        environment: "development",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "login", message: "hi" });
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(0);
    expect(mock.calls).toHaveLength(0);
  });

  it("async() returns error for unknown topic", async () => {
    const mock = makeFetchMock([{ status: 200 }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "unknown-topic", message: "hi" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("no webhook URL configured");
  });

  it("validates config at init (bad webhook URL throws)", () => {
    expect(() =>
      createNotifier({
        mode: "webhook",
        webhooks: { login: "https://example.com/not-a-webhook" },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      })
    ).toThrow(/webhook URL/);
  });

  it("validates message length", async () => {
    const mock = makeFetchMock([{ status: 200 }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "login", message: "x".repeat(2001) });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("2000 char limit");
    expect(mock.calls).toHaveLength(0);
  });

  it("retries on 429 with retry_after and eventually succeeds", async () => {
    const mock = makeFetchMock([
      { status: 429, body: { retry_after: 0.01 }, headers: { "retry-after": "0" } },
      { status: 200, body: { id: "ok" } },
    ]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "login", message: "hi" });
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(2);
    expect(mock.callCount).toBe(2);
  });

  it("fails fast on 400", async () => {
    const mock = makeFetchMock([{ status: 400, body: { message: "bad" } }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 },
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "login", message: "hi" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("discord_api_error");
    expect(mock.callCount).toBe(1);
  });

  it("gives up after maxAttempts on persistent 500", async () => {
    const mock = makeFetchMock([
      { status: 500 },
      { status: 500 },
      { status: 500 },
    ]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
        retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "login", message: "hi" });
    expect(res.ok).toBe(false);
    expect(mock.callCount).toBe(3);
  });

  it("fire-and-forget swallows errors", async () => {
    const mock = makeFetchMock([{ status: 400 }]);
    const logger = { ...silentLogger, error: vi.fn() };
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger,
        retry: { baseDelayMs: 1 },
      },
      { fetchImpl: mock.fetchImpl }
    );

    // Should not throw synchronously
    expect(() => notify({ topic: "login", message: "hi" })).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));
    expect(logger.error).toHaveBeenCalled();
  });

  it("applies defaultUsername and allows per-call override", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "1" } }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        defaultUsername: "DefaultBot",
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl }
    );

    await notify.async({ topic: "login", message: "hi" });
    expect((mock.calls[0]!.body as any).username).toBe("DefaultBot");

    mock.calls.length = 0;
    const mock2 = makeFetchMock([{ status: 200, body: { id: "2" } }]);
    const notify2 = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        defaultUsername: "DefaultBot",
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock2.fetchImpl }
    );
    await notify2.async({ topic: "login", message: "hi", username: "OverrideBot" });
    expect((mock2.calls[0]!.body as any).username).toBe("OverrideBot");
  });

  it("adds wait=true to webhook URL for messageId", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "m" } }]);
    const notify = createNotifier(
      {
        mode: "webhook",
        webhooks: { login: WEBHOOK },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl }
    );
    await notify.async({ topic: "login", message: "hi" });
    expect(mock.calls[0]!.url).toContain("wait=true");
  });
});

describe("createNotifier (bot mode)", () => {
  it("sends to channel with Authorization header", async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: "msgbot" } }]);
    const notify = createNotifier(
      {
        mode: "bot",
        token: "my-super-secret-token-value",
        channels: { login: "12345678901234567" },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "login", message: "hi" });
    expect(res.ok).toBe(true);
    expect(res.messageId).toBe("msgbot");
    expect(mock.calls[0]!.url).toBe("https://discord.com/api/v10/channels/12345678901234567/messages");
    expect(mock.calls[0]!.headers["Authorization"]).toBe("Bot my-super-secret-token-value");
  });

  it("rejects invalid channel ID at init", () => {
    expect(() =>
      createNotifier({
        mode: "bot",
        token: "my-super-secret-token-value",
        channels: { login: "abc" },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      })
    ).toThrow(/snowflake/);
  });

  it("async fails gracefully with unknown topic", async () => {
    const mock = makeFetchMock([{ status: 200 }]);
    const notify = createNotifier(
      {
        mode: "bot",
        token: "my-super-secret-token-value",
        channels: { login: "12345678901234567" },
        enabledIn: ["test"],
        environment: "test",
        logger: silentLogger,
      },
      { fetchImpl: mock.fetchImpl }
    );

    const res = await notify.async({ topic: "other", message: "x" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("no channel ID");
  });
});
