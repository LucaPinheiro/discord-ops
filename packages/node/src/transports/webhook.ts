import { DiscordOpsError, ErrorCodes } from "../errors.js";
import { executeRequest } from "../http.js";
import type { Logger, NotifyInput, RetryConfig, RetryEvent, WebhookOptions } from "../types.js";
import { validateWebhookUrl } from "../validation.js";

export interface WebhookTransportDeps {
  fetchImpl?: typeof fetch;
  logger: Logger;
  timeoutMs: number;
  retry?: RetryConfig;
  signal?: AbortSignal;
  onRetry?: (event: RetryEvent) => void;
}

export interface ResolvedWebhookConfig<TTopics extends string> {
  webhooks: Record<TTopics, string | undefined>;
  defaultUsername?: string;
  defaultAvatarUrl?: string;
}

export function resolveWebhookConfig<TTopics extends string>(
  options: WebhookOptions<TTopics>
): ResolvedWebhookConfig<TTopics> {
  const webhooks = {} as Record<TTopics, string | undefined>;
  for (const [topic, url] of Object.entries(options.webhooks) as [TTopics, string | undefined][]) {
    if (url !== undefined) {
      validateWebhookUrl(url);
    }
    webhooks[topic] = url;
  }
  return {
    webhooks,
    defaultUsername: options.defaultUsername,
    defaultAvatarUrl: options.defaultAvatarUrl,
  };
}

export async function sendViaWebhook<TTopics extends string>(
  input: NotifyInput<TTopics>,
  cfg: ResolvedWebhookConfig<TTopics>,
  deps: WebhookTransportDeps
): Promise<{ attempts: number; messageId?: string }> {
  const url = cfg.webhooks[input.topic];
  if (!url) {
    throw new DiscordOpsError(`no webhook URL configured for topic "${input.topic}"`, {
      code: ErrorCodes.CONFIG,
    });
  }

  const body: Record<string, unknown> = { content: input.message };
  const username = input.username ?? cfg.defaultUsername;
  const avatarUrl = input.avatarUrl ?? cfg.defaultAvatarUrl;
  if (username) body.username = username;
  if (avatarUrl) body.avatar_url = avatarUrl;

  // wait=true so Discord returns the created message (including id).
  // Use URL object to avoid dup params if caller already has ?wait= in their URL.
  const parsed = new URL(url);
  parsed.searchParams.set("wait", "true");
  const finalUrl = parsed.toString();

  const resp = await executeRequest(
    {
      url: finalUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "discord-ops (https://github.com/LucaPinheiro/discord-ops)",
      },
      body,
    },
    {
      fetchImpl: deps.fetchImpl,
      logger: deps.logger,
      timeoutMs: deps.timeoutMs,
      retry: deps.retry,
      signal: deps.signal,
      onRetry: deps.onRetry,
    }
  );

  const messageId = typeof resp.data === "object" && resp.data !== null && "id" in resp.data ? String(resp.data.id) : undefined;
  return { attempts: resp.attempts, messageId };
}
