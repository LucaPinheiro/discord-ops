# express-minimal

Minimal Express app using `discord-ops-alert`.

```bash
npm install
export DISCORD_WEBHOOK_SIGNUP="https://discord.com/api/webhooks/.../..."
export NODE_ENV=production   # or set enabledIn in server.ts
npm run dev

curl -X POST http://localhost:3000/signup \
  -H 'content-type: application/json' \
  -d '{"email":"luca@example.com","plan":"pro"}'
```

A message should appear in the linked Discord channel within a second.
