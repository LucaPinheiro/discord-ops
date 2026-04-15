import { DiscordOpsError, ErrorCodes } from "./errors.js";
import { defaultLogger } from "./logger.js";
import type {
  Environment,
  Notifier,
  NotifierOptions,
  NotifyInput,
  NotifyResult,
} from "./types.js";
import { resolveBotConfig, sendViaBot, type ResolvedBotConfig } from "./transports/bot.js";
import { resolveWebhookConfig, sendViaWebhook, type ResolvedWebhookConfig } from "./transports/webhook.js";
import { notifyInputSchema } from "./validation.js";

const DEFAULT_ENABLED_IN: Environment[] = ["production"];
const DEFAULT_TIMEOUT_MS = 5000;

export interface InternalFactoryDeps {
  fetchImpl?: typeof fetch;
}

/**
 * Creates a notifier tied to a given configuration.
 *
 * Fire-and-forget by default: calling `notify({...})` returns void and errors
 * are logged rather than thrown. Use `notify.async({...})` to await the result.
 */
export function createNotifier<TTopics extends string = string>(
  options: NotifierOptions<TTopics>,
  internal: InternalFactoryDeps = {}
): Notifier<TTopics> {
  const logger = options.logger ?? defaultLogger;
  const environment: Environment = options.environment ?? coerceEnv(process.env.NODE_ENV);
  const enabledIn = options.enabledIn ?? DEFAULT_ENABLED_IN;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retry = options.retry;
  const awaitByDefault = options.awaitByDefault ?? false;
  const onError = options.onError;
  const onRetry = options.onRetry;

  // Resolve transport config up-front so config errors throw at init time,
  // not at first notify().
  let webhookCfg: ResolvedWebhookConfig<TTopics> | undefined;
  let botCfg: ResolvedBotConfig<TTopics> | undefined;
  if (options.mode === "webhook") {
    webhookCfg = resolveWebhookConfig(options);
  } else {
    botCfg = resolveBotConfig(options);
  }

  const send = async (input: NotifyInput<TTopics>): Promise<NotifyResult> => {
    // Validate input.
    const parsed = notifyInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new DiscordOpsError(parsed.error.issues[0]?.message ?? "invalid notify input", {
        code: ErrorCodes.VALIDATION,
      });
    }

    if (!enabledIn.includes(environment)) {
      logger.debug("notification skipped (environment not enabled)", {
        environment,
        topic: input.topic,
      });
      return { ok: true, attempts: 0 };
    }

    try {
      const result = webhookCfg
        ? await sendViaWebhook(input, webhookCfg, {
            fetchImpl: internal.fetchImpl,
            logger,
            timeoutMs,
            retry,
            signal: input.signal,
            onRetry,
          })
        : await sendViaBot(input, botCfg!, {
            fetchImpl: internal.fetchImpl,
            logger,
            timeoutMs,
            retry,
            signal: input.signal,
            onRetry,
          });

      logger.info("notification sent", {
        topic: input.topic,
        attempts: result.attempts,
        messageId: result.messageId,
      });
      return { ok: true, attempts: result.attempts, messageId: result.messageId };
    } catch (err) {
      const ops = err instanceof DiscordOpsError ? err : new DiscordOpsError(
        err instanceof Error ? err.message : String(err),
        { code: ErrorCodes.UNKNOWN, cause: err }
      );
      logger.error("notification failed", {
        topic: input.topic,
        code: ops.code,
        status: ops.status,
        message: ops.message,
      });
      throw ops;
    }
  };

  const notifier = ((input: NotifyInput<TTopics>): void | Promise<NotifyResult> => {
    if (awaitByDefault) {
      return send(input);
    }
    // Fire and forget: swallow errors to logger + optional onError callback.
    send(input).catch((err) => {
      if (onError) {
        try {
          onError(err as DiscordOpsError, input);
        } catch (hookErr) {
          logger.error("onError hook threw", {
            error: hookErr instanceof Error ? hookErr.message : String(hookErr),
          });
        }
      }
    });
    return;
  }) as Notifier<TTopics>;

  notifier.async = async (input: NotifyInput<TTopics>): Promise<NotifyResult> => {
    try {
      return await send(input);
    } catch (err) {
      const ops = err instanceof DiscordOpsError ? err : new DiscordOpsError("unknown error", { code: ErrorCodes.UNKNOWN, cause: err });
      return {
        ok: false,
        attempts: 0,
        error: `${ops.code}: ${ops.message}`,
      };
    }
  };

  return notifier;
}

function coerceEnv(nodeEnv: string | undefined): Environment {
  const v = (nodeEnv ?? "").toLowerCase();
  if (v === "production" || v === "prod") return "production";
  if (v === "staging") return "staging";
  if (v === "homologation" || v === "homolog" || v === "hml") return "homologation";
  if (v === "test") return "test";
  return "development";
}
