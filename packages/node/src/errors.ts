/**
 * Error thrown by the SDK. In fire-and-forget mode these never leak out — they
 * are logged. When using `notifier.async()` they reject the returned Promise.
 */
export class DiscordOpsError extends Error {
  override readonly name = "DiscordOpsError";
  readonly code: string;
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(message: string, options: { code: string; status?: number; cause?: unknown } = { code: "unknown" }) {
    super(message);
    this.code = options.code;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export const ErrorCodes = {
  VALIDATION: "validation_error",
  CONFIG: "config_error",
  TIMEOUT: "timeout",
  NETWORK: "network_error",
  RATE_LIMITED: "rate_limited",
  DISCORD_API: "discord_api_error",
  UNKNOWN: "unknown",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
