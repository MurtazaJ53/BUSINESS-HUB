import { AuthLogin } from "@/components/auth-login";

export const metadata = {
  title: "Sign In | Business Hub Cloud",
  description: "Sign in to access Business Hub POS terminal, inventory, and ledger",
};

/**
 * Why the visitor was sent here, set by getSession() in lib/admin-api.ts.
 *
 * Only "expired" is routine. The other three mean the server could not talk to
 * the API, and saying so beats a blank page: the deployed site was returning
 * "This page couldn't load" with the real cause visible only in a container
 * log.
 */
const REASONS: Record<string, string> = {
  expired: "Your session has ended. Please sign in again.",
  throttled:
    "Too many requests from this server in the last hour. Wait a few minutes, then sign in again.",
  upstream:
    "The Business Hub API rejected this server's request. Sign in again — if this keeps happening, check the API container.",
  offline:
    "This server could not reach the Business Hub API. Check that the api container is running.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;

  return (
    <>
      {notice && (
        <div
          role="status"
          className="mx-auto mt-4 max-w-md rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3 text-xs font-bold text-[var(--warning-strong)]"
        >
          {notice}
        </div>
      )}
      <AuthLogin />
    </>
  );
}
