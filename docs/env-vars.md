# Environment variables

`discord-ops` itself reads **no** environment variables directly — you pass everything through `createNotifier(...)`. This doc is a suggested convention for the envs you'll typically put in `.env` and feed into the notifier.

## Webhook mode

```bash
# .env
DISCORD_WEBHOOK_SIGNUP=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_ERRORS=https://discord.com/api/webhooks/.../...
DISCORD_WEBHOOK_PAYMENTS=https://discord.com/api/webhooks/.../...
```

```ts
const notify = createNotifier({
  mode: "webhook",
  webhooks: {
    signup: process.env.DISCORD_WEBHOOK_SIGNUP,
    errors: process.env.DISCORD_WEBHOOK_ERRORS,
    payments: process.env.DISCORD_WEBHOOK_PAYMENTS,
  },
});
```

## Bot mode

```bash
# .env
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CHANNEL_SIGNUP=123456789012345678
DISCORD_CHANNEL_ERRORS=987654321098765432
DISCORD_CHANNEL_PAYMENTS=111222333444555666
```

```ts
const notify = createNotifier({
  mode: "bot",
  token: process.env.DISCORD_BOT_TOKEN,
  channels: {
    signup: process.env.DISCORD_CHANNEL_SIGNUP,
    errors: process.env.DISCORD_CHANNEL_ERRORS,
    payments: process.env.DISCORD_CHANNEL_PAYMENTS,
  },
});
```

## Environment gating

Notifications only fire in `production` by default. Your app's `NODE_ENV` is read automatically.

```bash
NODE_ENV=production   # enables notifications
NODE_ENV=development  # dropped silently (debug logged)
NODE_ENV=test         # dropped silently
```

Override if you want to fire in staging too:

```ts
createNotifier({
  mode: "webhook",
  webhooks: { ... },
  enabledIn: ["production", "staging"],
});
```

## Security checklist

- Never commit `.env` or webhook URLs / bot tokens. Add `.env` to `.gitignore`.
- Don't log `process.env.DISCORD_BOT_TOKEN` or webhook URLs — they're as sensitive as DB credentials.
- Rotate immediately on leak: regenerate the webhook in the Discord UI, or reset the bot token in the Developer Portal.
- Webhook URL leaked = anyone can post to that one channel. Bot token leaked = anyone can impersonate your bot across every server it's in. Treat accordingly.
