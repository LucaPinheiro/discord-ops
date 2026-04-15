# Contributing

Thanks for considering a contribution!

## Getting started

```bash
git clone https://github.com/lucapgomes/discord-ops.git
cd discord-ops
npm install
npm run test:run
npm run build
```

Node 18+ is required (the SDK uses native `fetch`).

## Project layout

```
packages/node/        the published SDK (npm: discord-ops)
examples/             runnable demos, not published
docs/                 user-facing docs
llms.txt              machine-readable guide for coding assistants
```

## Submitting a change

1. Fork + branch off `main`.
2. Add a test for any behavior change in `packages/node/test`.
3. Run `npm run typecheck && npm run test:run && npm run build`.
4. Open a PR describing the *why*, not just the *what*.

## Scope guardrails

`discord-ops` intentionally stays small. These are in scope:

- Reliable message delivery (retry, timeout, backoff)
- Validation and typed topics
- Small, zero-config DX

These are out of scope (they belong in a richer library like `discord.js`):

- Slash commands, reactions, threads, voice
- Message reading or bot event loops
- Gateway / WebSocket connections

When in doubt, open an issue before coding.

## Code style

- TypeScript strict. No `any` without a comment explaining why.
- No new runtime dependencies without discussion — current deps are `zod` only.
- Tests use vitest with a local `fetch-mock` helper. No real network in unit tests.

## Releasing

Maintainers only. Bump version in `packages/node/package.json`, tag, `npm publish` from the built artifact.
