"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice("Password updated. Taking you to the Hub…");
    router.push("/feed");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-lg border border-[var(--rule)] bg-[rgba(255,252,245,0.88)] p-6 shadow-sm">
        <BrandMark subtitle="Set a new password" />
        <p className="mt-3 text-sm text-[var(--ink-soft)]">
          Choose a new password for your Member Hub login. Use the link from
          your email so this page can update your account securely.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">New password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-[var(--rule)] bg-white/70 px-3 py-2 outline-none focus:border-[var(--olive)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Confirm password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-[var(--ink-soft)]">
          <Link href="/login" className="font-medium text-[var(--olive-deep)] underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
