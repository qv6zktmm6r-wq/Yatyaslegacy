"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

function PayForm() {
  const params = useSearchParams();
  // Do not prefill email from the URL (history/referrer leakage).
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState(params.get("first") || "");
  const [lastName, setLastName] = useState(params.get("last") || "");
  const [applicationId] = useState(params.get("application") || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        applicationId: applicationId || undefined,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };
    setBusy(false);
    if (!data.ok || !data.url) {
      setError(
        data.error ||
          "Checkout is not available yet. Join the First Wave waitlist and the Board will follow up.",
      );
      return;
    }
    window.location.href = data.url;
  }

  return (
    <form className="mt-6 space-y-3" onSubmit={onSubmit}>
      <div>
        <label className="text-xs font-medium text-[var(--ink-soft)]" htmlFor="pay-first">
          First name
        </label>
        <input
          id="pay-first"
          className="mt-1 w-full rounded-md border border-[var(--rule)] px-3 py-2 text-sm"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoComplete="given-name"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--ink-soft)]" htmlFor="pay-last">
          Last name
        </label>
        <input
          id="pay-last"
          className="mt-1 w-full rounded-md border border-[var(--rule)] px-3 py-2 text-sm"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          autoComplete="family-name"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-[var(--ink-soft)]" htmlFor="pay-email">
          Email
        </label>
        <input
          id="pay-email"
          type="email"
          className="mt-1 w-full rounded-md border border-[var(--rule)] px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <p className="text-xs text-[var(--ink-soft)]">
        $100 entrance (welcome package) + $5/month membership. Your FW number
        is assigned only after payment clears — this page never invents a tag.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-[var(--olive)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Opening Checkout…" : "Continue to secure Checkout"}
      </button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-center text-xs text-[var(--ink-soft)]">
        Prefer the waitlist first?{" "}
        <Link
          href="https://yatyasassociation.com/first-wave"
          className="underline"
        >
          Join First Wave
        </Link>
      </p>
    </form>
  );
}

export default function PayPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <BrandMark subtitle="First Wave entrance" />
      <div className="rounded-xl border border-[var(--rule)] bg-white p-6 shadow-sm">
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Pay entrance
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Qualifying service members only. Use the same name and email the Board
          has on file.
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-[var(--ink-soft)]">Loading…</p>}>
          <PayForm />
        </Suspense>
      </div>
    </main>
  );
}
