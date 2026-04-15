/**
 * discord-ops — plug-and-play Discord alerts for your SaaS backend.
 *
 * Quick start (webhook mode):
 *   import { createNotifier } from "discord-ops";
 *   const notify = createNotifier({
 *     mode: "webhook",
 *     webhooks: { login: process.env.DISCORD_WEBHOOK_LOGIN },
 *   });
 *   notify({ topic: "login", message: "User X signed in" });
 */
export { createNotifier } from "./notifier.js";
export { DiscordOpsError, ErrorCodes, type ErrorCode } from "./errors.js";
export { defaultLogger, silentLogger } from "./logger.js";
export { MAX_MESSAGE_LENGTH } from "./validation.js";
export type {
  BotOptions,
  CommonOptions,
  Environment,
  Logger,
  Notifier,
  NotifierOptions,
  NotifyInput,
  NotifyResult,
  RetryConfig,
  WebhookOptions,
} from "./types.js";
