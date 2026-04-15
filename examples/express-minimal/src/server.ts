/**
 * Minimal Express example for discord-ops.
 *
 * POST /signup { email, plan } → stores a user (fake) and fires a Discord alert.
 *
 * Set DISCORD_WEBHOOK_SIGNUP in your .env before running.
 */
import express from "express";
import { createNotifier } from "discord-ops-alert";

const app = express();
app.use(express.json());

const notify = createNotifier({
  mode: "webhook",
  webhooks: {
    signup: process.env.DISCORD_WEBHOOK_SIGNUP,
    error: process.env.DISCORD_WEBHOOK_ERROR,
  },
  // Uncomment to test locally without NODE_ENV=production:
  // enabledIn: ["development", "production"],
});

app.post("/signup", async (req, res) => {
  const { email, plan } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "email required" });

  // ... your real signup logic here ...
  const userId = `user_${Date.now()}`;

  // Fire-and-forget: does not block the response.
  notify({
    topic: "signup",
    message: `:tada: New user **${email}** on plan \`${plan ?? "free"}\` (id: ${userId})`,
  });

  res.status(201).json({ id: userId, email });
});

// Example of notifying on unhandled errors.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  notify({
    topic: "error",
    message: `:rotating_light: ${err.name}: ${err.message}`,
  });
  res.status(500).json({ error: "internal_error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`express-minimal listening on :${port}`);
});
