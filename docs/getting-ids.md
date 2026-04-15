# Getting Discord IDs

Discord uses "snowflake" IDs (17-20 digit numbers) everywhere. You'll need them in bot mode for channels, and in general for debugging.

## Enable Developer Mode

This is the only non-obvious step. Once enabled, every right-click menu gets an extra "Copy ID" option.

1. Open Discord (desktop or web).
2. Click the gear icon next to your username → opens **User Settings**.
3. Scroll down the left sidebar → **Advanced**.
4. Toggle **Developer Mode** on.

Close the settings dialog.

## Copy a channel ID

Right-click the channel in the sidebar → **Copy Channel ID**. You'll get something like `123456789012345678`.

## Copy a server (guild) ID

Right-click the server icon in the leftmost sidebar → **Copy Server ID**.

## Copy a user ID

Right-click a user in the member list → **Copy User ID**.

## Copy a message ID

Right-click a message → **Copy Message ID**.

## Sanity check

Channel IDs are 17-20 digit numbers. If you copied something that starts with `https://` or contains letters, you grabbed the wrong thing — that's the URL or invite code, not the ID.

`discord-ops` validates channel IDs at notifier creation time and throws a `DiscordOpsError` with code `config_error` if the format is wrong.
