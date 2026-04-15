import { notify, Topic } from "./notifier.js";

interface CreateUserInput {
  email: string;
  name: string;
  plan: "free" | "pro";
}

interface User {
  id: string;
  email: string;
  name: string;
  plan: "free" | "pro";
}

/**
 * Canonical fire-and-forget pattern: the notify() call sits after the
 * business logic is complete, has no `await`, and must never affect the
 * outcome of the usecase if it fails.
 */
export async function createUserUsecase(input: CreateUserInput): Promise<User> {
  // 1. Validate + persist (imagine repository, hashing, etc).
  const user: User = {
    id: `u_${Date.now()}`,
    email: input.email,
    name: input.name,
    plan: input.plan,
  };

  // 2. Do whatever else the usecase needs (emails, events, etc).

  // 3. Fire-and-forget notification. NO await on purpose:
  //    - must not block the response to the caller
  //    - must not propagate errors back up
  //    - must not change the return value
  notify({
    topic: Topic.SIGNUP,
    message: `:tada: **${user.name}** (${user.email}) signed up on \`${user.plan}\` plan`,
  });

  return user;
}
