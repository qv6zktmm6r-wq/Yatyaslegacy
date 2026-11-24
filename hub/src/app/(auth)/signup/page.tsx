"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [waveNote, setWaveNote] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.rpc("registration_status").then(({ data }) => {
      if (!data || typeof data !== "object") return;
      const s = data as {
        registrations_open?: boolean;
        wave_label?: string;
        seats_remaining?: number;
        tag_cap?: number;
      };
      if (s.registrations_open === false) {
        setWaveNote(
          `${s.wave_label || "This wave"} is full. If you are already on the verified roster, you can still create your login below.`,
        );
      } else if (typeof s.seats_remaining === "number") {
        setWaveNote(
          `${s.wave_label || "First Wave"}: ${s.seats_remaining} of ${s.tag_cap ?? 100} seats remaining.`,
        );
      }
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setLoading(false);
      setError("First and last name are required to match your verified membership.");
      return;
    }

    const supabase = createClient();
    const displayName = `${first} ${last}`;
    const { data, error: signError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName,
          first_name: first,
          last_name: last,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/feed`,
      },
    });

    if (signError) {
      setLoading(false);
      setError(signError.message);
      return;
    }

    if (!data.session) {
      setLoading(false);
      setNotice(
        "Check your email to confirm. After confirming, we’ll match your verified membership (email + name) and place your FW tag on your profile.",
      );
      return;
    }

    const { data: claim, error: claimError } = await supabase.rpc(
      "claim_verified_membership",
      {
        p_first_name: first,
        p_last_name: last,
      },
    );

    setLoading(false);
    if (claimError) {
      setError(claimError.message);
      return;
    }

    const matched =
      claim && typeof claim === "object" && (claim as { matched?: boolean }).matched;
    if (matched) {
      const tag = (claim as { membership_tag?: string }).membership_tag;
      router.push("/feed");
      router.refresh();
      setNotice(tag ? `Welcome — ${tag} is on your profile.` : null);
      return;
    }

    setError(
      "No verified membership matched that email and name. Ask the Board / President to add you to the verified roster first (with your FW number), then create your login again.",
    );
    router.push("/pending");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-lg border border-[var(--rule)] bg-[rgba(255,252,245,0.88)] p-6 shadow-sm">
        <BrandMark subtitle="Create member login" />
        <p className="mt-3 text-sm text-[var(--ink-soft)]">
          You must already be a verified member. Use the same email and first /
          last name on the Board roster — your membership number will already
          be on your profile.
        </p>
        {waveNote ? (
          <p className="mt-3 rounded border border-[var(--rule)] bg-white/60 px-3 py-2 text-sm text-[var(--olive-deep)]">
            {waveNote}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-ink-soft">First name</span>
              <input
                required
                maxLength={60}
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded border border-[var(--rule)] bg-white/70 px-3 py-2 outline-none focus:border-[var(--olive)]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-ink-soft">Last name</span>
              <input
                required
                maxLength={60}
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded border border-[var(--rule)] bg-white/70 px-3 py-2 outline-none focus:border-[var(--olive)]"
              />
            </label>
          </div>
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
              minLength={8}
              autoComplete="new-password"
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
            {loading ? "Verifying…" : "Create login"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-[var(--ink-soft)]">
          Already set up?{" "}
          <Link href="/login" className="font-medium text-[var(--olive-deep)] underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
