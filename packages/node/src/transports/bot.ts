import { DiscordOpsError, ErrorCodes } from "../errors.js";
import { executeRequest } from "../http.js";
import type { BotOptions, Logger, NotifyInput, RetryConfig } from "../types.js";
import { validateBotToken, validateChannelId } from "../validation.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export interface BotTransportDeps {
  fetchImpl?: typeof fetch;
  logger: Logger;
  timeoutMs: number;
  retry?: RetryConfig;
}

export interface ResolvedBotConfig<TTopics extends string> {
  token: string;
  channels: Record<TTopics, string | undefined>;
}

export function resolveBotConfig<TTopics extends string>(options: BotOptions<TTopics>): ResolvedBotConfig<TTopics> {
  validateBotToken(options.token);
  const channels = {} as Record<TTopics, string | undefined>;
  for (const [topic, id] of Object.entries(options.channels) as [TTopics, string | undefined][]) {
    if (id !== undefined) {
      validateChannelId(id);
    }
    channels[topic] = id;
  }
  return { token: options.token, channels };
}

export async function sendViaBot<TTopics extends string>(
  input: NotifyInput<TTopics>,
  cfg: ResolvedBotConfig<TTopics>,
  deps: BotTransportDeps
): Promise<{ attempts: number; messageId?: string }> {
  const channelId = cfg.channels[input.topic];
  if (!channelId) {
    throw new DiscordOpsError(`no channel ID configured for topic "${input.topic}"`, {
      code: ErrorCodes.CONFIG,
    });
  }

  if (input.username || input.avatarUrl) {
    deps.logger.warn("username/avatarUrl overrides are ignored in bot mode (webhook only)");
  }

  const resp = await executeRequest(
    {
      url: `${DISCORD_API_BASE}/channels/${channelId}/messages`,
      method: "POST",
      headers: {
        Authorization: `Bot ${cfg.token}`,
        "Content-Type": "application/json",
        "User-Agent": "discord-ops (https://github.com/lucapgomes/discord-ops)",
      },
      body: { content: input.message },
    },
    {
      fetchImpl: deps.fetchImpl,
      logger: deps.logger,
      timeoutMs: deps.timeoutMs,
      retry: deps.retry,
    }
  );

  const messageId = typeof resp.data === "object" && resp.data !== null && "id" in resp.data ? String(resp.data.id) : undefined;
  return { attempts: resp.attempts, messageId };
}
