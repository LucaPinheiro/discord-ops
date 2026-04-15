import { createUserUsecase } from "./create_user_usecase.js";

async function main() {
  const user = await createUserUsecase({
    email: "luca@example.com",
    name: "Luca",
    plan: "pro",
  });
  console.log("created", user);
  // Give the fire-and-forget notification a moment to flush before exit.
  await new Promise((r) => setTimeout(r, 1000));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
