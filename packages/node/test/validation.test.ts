import { describe, expect, it } from "vitest";
import {
  channelIdSchema,
  notifyInputSchema,
  validateBotToken,
  validateChannelId,
  validateWebhookUrl,
  webhookUrlSchema,
} from "../src/validation.js";
import { DiscordOpsError } from "../src/errors.js";

describe("validation", () => {
  describe("notifyInputSchema", () => {
    it("accepts valid input", () => {
      expect(notifyInputSchema.safeParse({ topic: "login", message: "hi" }).success).toBe(true);
    });

    it("rejects empty message", () => {
      expect(notifyInputSchema.safeParse({ topic: "login", message: "" }).success).toBe(false);
    });

    it("rejects message over 2000 chars", () => {
      expect(notifyInputSchema.safeParse({ topic: "login", message: "x".repeat(2001) }).success).toBe(false);
    });

    it("rejects missing topic", () => {
      expect(notifyInputSchema.safeParse({ topic: "", message: "hi" }).success).toBe(false);
    });

    it("validates avatarUrl as URL", () => {
      expect(
        notifyInputSchema.safeParse({ topic: "x", message: "y", avatarUrl: "not-a-url" }).success
      ).toBe(false);
      expect(
        notifyInputSchema.safeParse({ topic: "x", message: "y", avatarUrl: "https://i.imgur.com/x.png" }).success
      ).toBe(true);
    });
  });

  describe("webhookUrlSchema", () => {
    it("accepts valid discord webhook URL", () => {
      expect(webhookUrlSchema.safeParse("https://discord.com/api/webhooks/123/abc").success).toBe(true);
      expect(webhookUrlSchema.safeParse("https://discordapp.com/api/webhooks/123/abc").success).toBe(true);
    });

    it("rejects non-discord URLs", () => {
      expect(webhookUrlSchema.safeParse("https://example.com/webhook").success).toBe(false);
    });

    it("rejects non-URLs", () => {
      expect(webhookUrlSchema.safeParse("not-a-url").success).toBe(false);
    });
  });

  describe("channelIdSchema", () => {
    it("accepts 17-20 digit snowflakes", () => {
      expect(channelIdSchema.safeParse("12345678901234567").success).toBe(true);
      expect(channelIdSchema.safeParse("12345678901234567890").success).toBe(true);
    });

    it("rejects short or non-numeric", () => {
      expect(channelIdSchema.safeParse("123").success).toBe(false);
      expect(channelIdSchema.safeParse("abcdefghijklmnopqrst").success).toBe(false);
    });
  });

  describe("imperative validators", () => {
    it("validateWebhookUrl throws on invalid", () => {
      expect(() => validateWebhookUrl("https://example.com")).toThrow(DiscordOpsError);
    });

    it("validateWebhookUrl passes on valid", () => {
      expect(() => validateWebhookUrl("https://discord.com/api/webhooks/1/a")).not.toThrow();
    });

    it("validateChannelId throws on invalid", () => {
      expect(() => validateChannelId("abc")).toThrow(DiscordOpsError);
    });

    it("validateBotToken throws on empty", () => {
      expect(() => validateBotToken("")).toThrow(DiscordOpsError);
    });
  });
});
