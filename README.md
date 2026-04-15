# discord-ops

> Plug-and-play Discord alerts for your SaaS backend. Fire-and-forget, zero infra, webhook or bot.

[![npm version](https://img.shields.io/npm/v/discord-ops-alert.svg)](https://www.npmjs.com/package/discord-ops-alert)
[![license](https://img.shields.io/npm/l/discord-ops-alert.svg)](./LICENSE)
[![CI](https://github.com/LucaPinheiro/discord-ops/actions/workflows/ci.yml/badge.svg)](https://github.com/LucaPinheiro/discord-ops/actions/workflows/ci.yml)

`discord-ops` is the lightest way to get "something happened" messages from your backend into a Discord channel. Signup notifications, payment alerts, error pings — stuff that used to need Datadog, Sentry, or a PagerDuty trial. Drop it into any Node backend in two minutes.

```ts
import { createNotifier } from "discord-ops-alert";

const notify = createNotifier({
  mode: "webhook",
  webhooks: { signup: process.env.DISCORD_WEBHOOK_SIGNUP },
});

// in your create_user usecase, no await — does not block the response:
notify({ topic: "signup", message: `New user: ${user.email}` });
```

That's it. The call never throws, has a 3-second timeout, retries on 429/5xx, and drops silently outside production.

## Why this exists

Observability for MVPs and microsaas has a bad gap: `console.log` is invisible, OTEL/Datadog is overkill, and "I'll add Sentry later" means never. A Discord channel with a handful of pings is the 20% of observability that covers 80% of "did anyone sign up today?" — without the instrumentation cost.

The trade-off: you won't get dashboards, query languages, or SLO math. You will get a phone in your pocket buzzing when a user pays.

## Install

```bash
npm install discord-ops-alert
# or
pnpm add discord-ops-alert
# or
yarn add discord-ops-alert
```

Requires Node 18+ (uses native `fetch`).

## Two-minute setup (webhook)

1. In Discord, open the channel where you want alerts. `⚙️ Edit Channel → Integrations → Webhooks → New Webhook`.
2. Name it (e.g. "Signups"), optionally upload an avatar, click **Copy Webhook URL**.
3. Put the URL in your `.env`:
   ```bash
   DISCORD_WEBHOOK_SIGNUP=https://discord.com/api/webhooks/123.../abc...
   ```
4. Wire it up:
   ```ts
   import { createNotifier } from "discord-ops-alert";
   const notify = createNotifier({
     mode: "webhook",
     webhooks: { signup: process.env.DISCORD_WEBHOOK_SIGNUP },
   });
   notify({ topic: "signup", message: "It works!" });
   ```

Full walkthrough with screenshots: [docs/discord-setup.md](./docs/discord-setup.md).

## Bot mode

Webhook mode is enough for 80% of cases. Use bot mode when you want:

- a single token posting to many channels
- a consistent "online" bot identity on the server
- room to grow into slash commands / reactions later

```ts
const notify = createNotifier({
  mode: "bot",
  token: process.env.DISCORD_BOT_TOKEN,
  channels: {
    signup: "123456789012345678",
    errors: "987654321098765432",
  },
});

notify({ topic: "errors", message: "DB timeout on /checkout" });
```

Setup guide (Developer Portal, intents, OAuth, channel IDs): [docs/discord-setup.md](./docs/discord-setup.md).

## Typed topics (recommended)

```ts
enum Topic {
  SIGNUP = "signup",
  PAYMENT = "payment",
  ERROR = "error",
}

const notify = createNotifier<Topic>({
  mode: "webhook",
  webhooks: {
    [Topic.SIGNUP]: process.env.WEBHOOK_SIGNUP,
    [Topic.PAYMENT]: process.env.WEBHOOK_PAYMENT,
    [Topic.ERROR]: process.env.WEBHOOK_ERROR,
  },
});

notify({ topic: Topic.SIGNUP, message: "..." }); // autocomplete + typo-safe
```

## Fire-and-forget vs await

Default mode is fire-and-forget — `notify(...)` returns `void` and errors log instead of throw. This is what you want inside usecases and hot paths.

When you need the result (tests, scripts, delivery confirmation):

```ts
const result = await notify.async({ topic: "signup", message: "hi" });
// result.ok, result.attempts, result.messageId, result.error
```

## Configuration

```ts
createNotifier({
  mode: "webhook",                      // or "bot"
  webhooks: { ... },                    // (webhook mode) topic → URL
  token: "...",                         // (bot mode) bot token
  channels: { ... },                    // (bot mode) topic → channel ID

  // Common options:
  enabledIn: ["production"],            // default: only fires in production
  environment: "production",            // default: derived from NODE_ENV
  timeoutMs: 3000,                      // default: 3s
  retry: {
    maxAttempts: 3,                     // default: 3
    baseDelayMs: 250,                   // default: 250
    maxDelayMs: 5000,                   // default: 5s cap
  },
  logger: myPinoInstance,               // default: console
  defaultUsername: "SignupBot",         // webhook only
  defaultAvatarUrl: "https://...",      // webhook only
  awaitByDefault: false,                // default: false (fire-and-forget)
});
```

Env var reference: [docs/env-vars.md](./docs/env-vars.md).

## Examples

- [`examples/express-minimal`](./examples/express-minimal) — minimal Express signup endpoint.
- [`examples/nextjs-api-route`](./examples/nextjs-api-route) — Next.js route handler with error middleware.
- [`examples/usecase-pattern`](./examples/usecase-pattern) — clean-arch usecase with fire-and-forget notification.

## Behavior you can rely on

- **Never blocks.** Default mode returns synchronously; the HTTP call runs on the microtask queue.
- **Never throws out.** Errors hit the logger, not your caller.
- **Respects Discord rate limits.** Reads `retry_after` and `Retry-After`, retries with jittered exponential backoff.
- **Skips in dev/test.** Not shipping spam while you iterate. Toggle via `enabledIn`.
- **Validates config at init.** Bad webhook URL or channel ID throws before your server accepts traffic.
- **Small.** ~12 KB minified, zero deps besides `zod`.

## Roadmap

- Python SDK (paridade com Node)
- Embeds (cores, fields, timestamps)
- Batching / debouncing por tópico
- Sampling (`sampleRate: 0.1`)
- Optional hosted proxy (Cloudflare Workers template)

## Contributing

PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
