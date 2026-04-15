# usecase-pattern

Clean-architecture style: one shared `notify` wired at startup, imported into each usecase, called fire-and-forget.

This mirrors the pattern used in the clickcar backend that inspired `discord-ops`.

```bash
npm install
export DISCORD_WEBHOOK_SIGNUP="https://..."
export NODE_ENV=production
npm run dev
```
