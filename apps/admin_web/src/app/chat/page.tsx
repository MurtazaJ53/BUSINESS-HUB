import { redirect } from "next/navigation";

/**
 * Retired.
 *
 * This page rendered a fully mocked team chat: seeded channels and messages,
 * with anything typed kept in React state and lost on refresh. There is no
 * chat API on the backend and no chat feature in the mobile app, so it
 * advertised something the product does not do.
 *
 * It was never linked from the navigation. The previous implementation is in
 * git history (commit 76769d9) if team chat is ever built for real.
 */
export default function ChatPage() {
  redirect("/");
}
