import { createNotifier } from "discord-ops";

/**
 * Shared notifier, created once at process startup.
 *
 * Mirrors the clickcar pattern: a single `notify` exported from the shared/utils
 * layer and imported into every usecase that needs it.
 */
export enum Topic {
  LOGIN = "login",
  SIGNUP = "signup",
  PAYMENT = "payment",
  ERROR = "error",
}

export const notify = createNotifier<Topic>({
  mode: "webhook",
  webhooks: {
    [Topic.LOGIN]: process.env.DISCORD_WEBHOOK_LOGIN,
    [Topic.SIGNUP]: process.env.DISCORD_WEBHOOK_SIGNUP,
    [Topic.PAYMENT]: process.env.DISCORD_WEBHOOK_PAYMENT,
    [Topic.ERROR]: process.env.DISCORD_WEBHOOK_ERROR,
  },
});
