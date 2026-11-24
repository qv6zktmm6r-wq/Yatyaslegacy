import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function PayCancelPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <BrandMark subtitle="Checkout canceled" />
      <div className="rounded-xl border border-[var(--rule)] bg-white p-6 shadow-sm">
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          No charge was made
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Your seat hold will expire shortly. You can restart First Wave
          Checkout when you&apos;re ready — membership numbers are only issued
          after payment clears.
        </p>
        <Link
          href="https://yatyasassociation.com/first-wave"
          className="mt-6 inline-flex rounded-md bg-[var(--olive)] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to First Wave
        </Link>
      </div>
    </main>
  );
}
