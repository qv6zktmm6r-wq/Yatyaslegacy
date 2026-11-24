"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

export default function PendingPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function retryClaim(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: claimError } = await supabase.rpc(
      "claim_verified_membership",
      {
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
      },
    );
    setBusy(false);
    if (claimError) {
      setError(claimError.message);
      return;
    }
    if (data && typeof data === "object" && (data as { matched?: boolean }).matched) {
      router.push("/feed");
      router.refresh();
      return;
    }
    setError(
      "Still no match. Use the exact email and name from your entrance payment, or become a member first.",
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.92)] p-6 shadow-sm">
        <BrandMark subtitle="Verification needed" />
        <h1 className="sr-only">Verification needed</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
          The Member Hub is for paid association members. Your login must match
          the email and first / last name from your entrance payment. If you have
          not paid yet, become a member first. If you just paid, wait a minute
          and claim below.
        </p>

        <form onSubmit={retryClaim} className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)]"
            />
            <input
              required
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)]"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--olive-deep)] px-4 py-2.5 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
          >
            {busy ? "Checking…" : "Claim verified membership"}
          </button>
        </form>

        <p className="mt-4 text-sm text-[var(--ink-soft)]">
          <a
            className="font-medium text-[var(--olive-deep)] underline"
            href="/pay"
          >
            Become a member
          </a>
          {" · "}
          Questions:{" "}
          <a
            className="font-medium text-[var(--olive-deep)] underline"
            href="mailto:board@yatyasassociation.com"
          >
            board@yatyasassociation.com
          </a>
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 w-full rounded-lg border border-[var(--rule)] px-4 py-2.5 text-sm font-semibold text-[var(--charcoal)]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
