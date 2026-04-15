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
    (v) => v.startsWith("https://discord.com/api/webhooks/"),
    "webhook URL must start with https://discord.com/api/webhooks/ (discordapp.com is deprecated — recreate the webhook)"
  );

export const channelIdSchema = z.string().regex(/^\d{17,20}$/, "channel ID must be a Discord snowflake (17-20 digits)");

// Discord bot tokens are 3 base64url segments joined by "." — typically ~60–72 chars.
// Reject anything shorter or containing whitespace.
export const botTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9._-]{50,}$/, "bot token looks invalid (expected >=50 chars, base64url+dots)");

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
    throw new DiscordOpsError(
      parsed.error.issues[0]?.message ?? "bot token looks invalid",
      { code: ErrorCodes.CONFIG }
    );
  }
}
