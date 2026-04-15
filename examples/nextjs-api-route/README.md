# nextjs-api-route

Next.js App Router example using a route handler.

```ts
// app/api/signup/route.ts
import { NextResponse } from "next/server";
import { notify } from "@/lib/notify";

export async function POST(req: Request) {
  const { email } = await req.json();

  // ... create user ...

  notify({ topic: "signup", message: `New user: ${email}` });

  return NextResponse.json({ ok: true });
}
```

```ts
// lib/notify.ts
import { createNotifier } from "discord-ops-alert";

export const notify = createNotifier({
  mode: "webhook",
  webhooks: {
    signup: process.env.DISCORD_WEBHOOK_SIGNUP,
    error: process.env.DISCORD_WEBHOOK_ERROR,
  },
});
```

For Vercel deployments, note that fire-and-forget calls may be cut off when the function returns. If delivery matters, either `await notify.async(...)` or use `waitUntil` (Vercel Edge/Node):

```ts
import { waitUntil } from "@vercel/functions";

waitUntil(notify.async({ topic: "signup", message: "..." }));
```
