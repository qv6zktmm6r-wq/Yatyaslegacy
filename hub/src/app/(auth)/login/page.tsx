"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") || "/feed";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/feed";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function sendReset() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      },
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice("Check your email for a link to set or reset your password.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-ink-soft">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-[var(--rule)] bg-white/70 px-3 py-2 outline-none focus:border-[var(--olive)]"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-ink-soft">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-[var(--rule)] bg-white/70 px-3 py-2 outline-none focus:border-[var(--olive)]"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-[var(--olive-deep)]" role="status">
          {notice}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[var(--olive-deep)] px-4 py-2.5 font-medium text-[var(--parchment)] transition hover:bg-[var(--olive)] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => void sendReset()}
        className="w-full text-sm text-[var(--olive-deep)] underline disabled:opacity-60"
      >
        Email me a password link
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-lg border border-[var(--rule)] bg-[rgba(255,252,245,0.88)] p-6 shadow-sm">
        <BrandMark subtitle="Member Hub sign in" />
        <p className="mt-3 text-sm text-[var(--ink-soft)]">
          Paid members only. Create a Hub login after your entrance payment —
          use the same email and name so the Association recognizes you.
        </p>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-5 text-center text-sm text-[var(--ink-soft)]">
          Paid member?{" "}
          <Link href="/signup" className="font-medium text-[var(--olive-deep)] underline">
            Create your login
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-[var(--ink-soft)]">
          Not a member yet?{" "}
          <Link href="/pay" className="font-medium text-[var(--olive-deep)] underline">
            Become a member
          </Link>
        </p>
      </div>
    </div>
  );
}
