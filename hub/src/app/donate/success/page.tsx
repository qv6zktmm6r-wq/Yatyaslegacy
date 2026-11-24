import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function DonateSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
      <BrandMark />
      <h1 className="mt-8 font-[family-name:var(--font-display-face)] text-3xl font-semibold text-[var(--ink)]">
        Thank you
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
        Your gift strengthens scholarships, gatherings, and the living record of
        the tracks community. A receipt will come from Stripe if you left an
        email.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          className="rounded-md bg-[var(--gold)] px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[var(--charcoal)]"
          href="https://yatyasassociation.com/"
        >
          Return to the site
        </Link>
        <Link
          className="text-center text-sm text-[var(--ink-soft)] underline underline-offset-2"
          href="/donate"
        >
          Give again
        </Link>
      </div>
    </main>
  );
}
