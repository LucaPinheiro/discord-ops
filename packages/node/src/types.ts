/**
 * Public types for discord-ops.
 */

export type Environment = "development" | "test" | "homologation" | "staging" | "production";

export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface RetryConfig {
  /** Max attempts including the first one. Default 3. */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff. Default 250. */
  baseDelayMs?: number;
  /** Max delay cap in ms. Default 5000. */
  maxDelayMs?: number;
}

export interface RetryEvent {
  attempt: number;
  nextDelayMs: number;
  reason: "network" | "timeout" | "status";
  status?: number;
  error?: Error;
}

export interface CommonOptions {
  /**
   * Environments in which notifications actually fire.
   * In other environments, notify() becomes a no-op (logged at debug level).
   * Default: ['production'].
   */
  enabledIn?: Environment[];
  /**
   * Current environment. Defaults to process.env.NODE_ENV coerced to Environment,
   * falling back to 'development'.
   */
  environment?: Environment;
  /** Request timeout in ms. Default 5000. */
  timeoutMs?: number;
  /** Retry config. */
  retry?: RetryConfig;
  /** Custom logger. Default: console wrapper. */
  logger?: Logger;
  /**
   * If true, notify() returns a Promise that resolves/rejects on completion.
   * If false (default), notify() returns void and errors are swallowed to the logger.
   */
  awaitByDefault?: boolean;
  /**
   * Called when a notification fails in fire-and-forget mode. Without this,
   * failures are only visible via the logger — easy to miss in production.
   * The error is already logged before this runs; exceptions thrown here
   * are swallowed to avoid cascading failures.
   */
  onError?: (error: DiscordOpsErrorLike, input: NotifyInput) => void;
  /**
   * Called before each retry (both transient HTTP status and network errors).
   * Useful for metrics / detecting rate-limit pressure in real time.
   */
  onRetry?: (event: RetryEvent) => void;
}

/**
 * Shape-only type alias so consumers don't need to import the concrete
 * DiscordOpsError class just to type an onError callback.
 */
export interface DiscordOpsErrorLike extends Error {
  code: string;
  status?: number;
}

export interface WebhookOptions<TTopics extends string = string> extends CommonOptions {
  mode: "webhook";
  /** Map of topic name to full Discord webhook URL. */
  webhooks: Record<TTopics, string | undefined>;
  /** Optional override for the username shown in Discord. */
  defaultUsername?: string;
  /** Optional override for avatar URL shown in Discord. */
  defaultAvatarUrl?: string;
}

export interface BotOptions<TTopics extends string = string> extends CommonOptions {
  mode: "bot";
  /** Discord bot token (Bot <token>). Never log this. */
  token: string;
  /** Map of topic name to Discord channel ID. */
  channels: Record<TTopics, string | undefined>;
}

export type NotifierOptions<TTopics extends string = string> =
  | WebhookOptions<TTopics>
  | BotOptions<TTopics>;

export interface NotifyInput<TTopics extends string = string> {
  topic: TTopics;
  message: string;
  /** Override username (webhook mode only). */
  username?: string;
  /** Override avatar URL (webhook mode only). */
  avatarUrl?: string;
  /**
   * Optional AbortSignal. If aborted, pending request is cancelled
   * and notify() rejects/returns an error. In fire-and-forget mode,
   * aborted calls surface via onError / logger.
   */
  signal?: AbortSignal;
}

export interface NotifyResult {
  ok: boolean;
  attempts: number;
  messageId?: string;
  error?: string;
}

export type Notifier<TTopics extends string = string> = {
  (input: NotifyInput<TTopics>): void;
  /** Same as calling the notifier, but returns a Promise you can await. */
  async: (input: NotifyInput<TTopics>) => Promise<NotifyResult>;
};
