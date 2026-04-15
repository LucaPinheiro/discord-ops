# discord-ops

> Plug-and-play Discord alerts for your SaaS backend. Fire-and-forget, zero infra, webhook or bot.

```bash
npm install discord-ops-alert
```

```ts
import { createNotifier } from "discord-ops-alert";

const notify = createNotifier({
  mode: "webhook",
  webhooks: { signup: process.env.DISCORD_WEBHOOK_SIGNUP },
});

notify({ topic: "signup", message: `New user: ${user.email}` });
```

Full docs, setup guides and examples: **[github.com/LucaPinheiro/discord-ops](https://github.com/LucaPinheiro/discord-ops)**.

## License

MIT
