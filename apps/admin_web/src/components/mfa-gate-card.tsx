import Link from "next/link";

export function MfaGateCard({
  href,
  enabled,
  title,
}: {
  href: string;
  enabled: boolean;
  title: string;
}) {
  return (
    <section className="panel-soft rounded-[28px] px-6 py-8 text-center">
      <p className="eyebrow">Security checkpoint</p>
      <h2 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">
        {enabled ? "Verify MFA to continue" : "Set up MFA to continue"}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
        {enabled
          ? `${title} is protected by an owner/admin MFA step-up check. Open Security, verify your current code, then return here.`
          : `${title} now requires MFA for owner/admin access. Open Security, enroll an authenticator app, then verify your code to unlock this surface.`}
      </p>
      <div className="mt-6">
        <Link
          href={href}
          className="inline-flex rounded-full border border-[rgba(92,174,254,0.22)] bg-[rgba(10,36,68,0.82)] px-5 py-2.5 text-sm font-semibold text-[var(--accent)] transition-transform duration-150 hover:-translate-y-0.5"
        >
          Open security
        </Link>
      </div>
    </section>
  );
}
