import { z } from "zod";
import { DiscordOpsError, ErrorCodes } from "./errors.js";

/** Discord message content limit. */
export const MAX_MESSAGE_LENGTH = 2000;

export const notifyInputSchema = z.object({
  topic: z.string().min(1, "topic is required"),
  message: z
    .string()
    .min(1, "message must be non-empty")
    .max(MAX_MESSAGE_LENGTH, `message exceeds Discord's ${MAX_MESSAGE_LENGTH} char limit`),
  username: z.string().max(80).optional(),
  avatarUrl: z.string().url().optional(),
});

export const webhookUrlSchema = z
  .string()
  .url()
  .refine(
    (v) => v.startsWith("https://discord.com/api/webhooks/") || v.startsWith("https://discordapp.com/api/webhooks/"),
    "webhook URL must be a Discord webhook URL (https://discord.com/api/webhooks/...)"
  );

export const channelIdSchema = z.string().regex(/^\d{17,20}$/, "channel ID must be a Discord snowflake (17-20 digits)");

export const botTokenSchema = z.string().min(10, "bot token looks invalid");

export function validateWebhookUrl(url: string): void {
  const parsed = webhookUrlSchema.safeParse(url);
  if (!parsed.success) {
    throw new DiscordOpsError(parsed.error.issues[0]?.message ?? "invalid webhook URL", {
      code: ErrorCodes.CONFIG,
    });
  }
}

export function validateChannelId(id: string): void {
  const parsed = channelIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new DiscordOpsError(parsed.error.issues[0]?.message ?? "invalid channel ID", {
      code: ErrorCodes.CONFIG,
    });
  }
}

export function validateBotToken(token: string): void {
  const parsed = botTokenSchema.safeParse(token);
  if (!parsed.success) {
    throw new DiscordOpsError("bot token is required", { code: ErrorCodes.CONFIG });
  }
}
