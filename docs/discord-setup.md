# Discord setup

Two trails depending on which mode you want: **webhook** (fast, recommended) or **bot** (more power, more setup).

---

## Trail A — Webhook (5 steps, no bot)

A webhook is a Discord-managed endpoint tied to a single channel. No Developer Portal, no OAuth, no intents.

### 1. Open the channel settings

In your server, hover the target channel in the sidebar and click the gear icon (`Edit Channel`).

### 2. Go to Integrations → Webhooks

Left sidebar of the channel settings dialog.

### 3. New Webhook

Click **New Webhook**. Give it a name (this is what Discord will display as the author of messages — e.g. "Signups", "Errors", "PaymentBot"). Optionally upload an avatar.

### 4. Copy Webhook URL

Click **Copy Webhook URL**. The URL looks like:

```
https://discord.com/api/webhooks/1234567890123456789/abc-xyz-long-secret-token
```

Treat this URL as a secret. Anyone with it can post to the channel.

### 5. Use it

```bash
# .env
DISCORD_WEBHOOK_SIGNUP=https://discord.com/api/webhooks/.../...
```

```ts
import { createNotifier } from "discord-ops";

const notify = createNotifier({
  mode: "webhook",
  webhooks: { signup: process.env.DISCORD_WEBHOOK_SIGNUP },
});

notify({ topic: "signup", message: "Hello from discord-ops!" });
```

Repeat steps 1-4 for each channel you want to post to (one webhook per channel).

### Customizing appearance

The name and avatar configured at webhook creation are defaults. You can override per message:

```ts
notify({
  topic: "signup",
  message: "new user",
  username: "OrdersBot",
  avatarUrl: "https://i.imgur.com/your-avatar.png",
});
```

Or set defaults at the notifier level:

```ts
createNotifier({
  mode: "webhook",
  webhooks: { signup: "..." },
  defaultUsername: "SaaSBot",
  defaultAvatarUrl: "https://...",
});
```

---

## Trail B — Bot (one token, many channels)

Use a bot when you have multiple channels and prefer a single token, or when you want your bot to appear "online" in the server with a persistent identity.

### 1. Create an Application

Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application** → name it.

### 2. Add a Bot user

Left sidebar → **Bot** → **Add Bot** → **Yes, do it!**.

Click **Reset Token** → **Copy** the token. This is the secret — treat it like a DB password.

```bash
# .env
DISCORD_BOT_TOKEN=your-bot-token-here
```

> **Intents**: for sending messages you do **not** need privileged intents. Leave "Message Content Intent" off unless you plan to read incoming messages.

### 3. Generate the invite URL

Left sidebar → **OAuth2 → URL Generator**.

Check the scopes:
- `bot`

Check the bot permissions:
- **Send Messages** (required)
- **Embed Links** (recommended, for future embed support)
- **Attach Files** (optional)

Copy the generated URL at the bottom of the page.

### 4. Invite the bot into your server

Open the URL in a browser. Select your server from the dropdown, confirm the permissions, click **Authorize**.

The bot now appears in the server's member list (offline until your backend talks to the Discord API).

### 5. Get channel IDs

In Discord, enable Developer Mode: **User Settings → Advanced → Developer Mode**.

Then right-click any channel → **Copy Channel ID**. You'll get a 17-20 digit number like `123456789012345678`.

Do this for each channel the bot will post into.

### 6. Wire up

```bash
# .env
DISCORD_BOT_TOKEN=...
CHANNEL_SIGNUP=123456789012345678
CHANNEL_ERRORS=987654321098765432
```

```ts
import { createNotifier } from "discord-ops";

const notify = createNotifier({
  mode: "bot",
  token: process.env.DISCORD_BOT_TOKEN,
  channels: {
    signup: process.env.CHANNEL_SIGNUP,
    errors: process.env.CHANNEL_ERRORS,
  },
});

notify({ topic: "signup", message: "Hello from the bot!" });
```

### Required permissions in the channel

If messages don't arrive, double-check: channel settings → **Permissions** → the bot (or a role it has) needs at least **View Channel** and **Send Messages**.

---

## Which should I use?

| | Webhook | Bot |
|---|---|---|
| Setup time | 30 seconds | 5 minutes |
| Identity | Per-webhook | Single bot across channels |
| Permissions | Just create in channel | OAuth invite + channel perms |
| Token scope | Per-channel | Server-wide |
| Future features (slash commands, reactions) | ❌ | ✅ |
| Recommended for alerts | ✅ | Also fine |

Start with webhook. Migrate to bot later by changing config — your `notify()` calls stay identical.
