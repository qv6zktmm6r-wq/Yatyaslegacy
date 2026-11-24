"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

const PRESETS = [25, 50, 100, 250] as const;

export default function DonatePage() {
  const [preset, setPreset] = useState<number | "custom">(50);
  const [custom, setCustom] = useState("50");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dollars = useMemo(() => {
    if (preset === "custom") {
      const n = Number(custom);
      return Number.isFinite(n) ? n : NaN;
    }
    return preset;
  }, [preset, custom]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/donate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim() || undefined,
        name: name.trim() || undefined,
        amountDollars: dollars,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };
    setBusy(false);
    if (!data.ok || !data.url) {
      setError(data.error || "Donation checkout is unavailable right now.");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
      <BrandMark />
      <h1 className="mt-8 font-[family-name:var(--font-display-face)] text-3xl font-semibold text-[var(--ink)]">
        Support the Association
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
        One-time gifts help scholarships, gatherings, and the programs that keep
        the tracks community connected. Not membership dues — First Wave
        entrance is separate.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            Amount
          </legend>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className={`rounded-md border px-2 py-2 text-sm font-semibold ${
                  preset === n
                    ? "border-[var(--gold)] bg-[rgba(176,141,62,0.18)] text-[var(--ink)]"
                    : "border-[var(--rule)] bg-white/40 text-[var(--ink-soft)]"
                }`}
                onClick={() => {
                  setPreset(n);
                  setCustom(String(n));
                }}
              >
                ${n}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-medium text-[var(--ink-soft)]" htmlFor="donate-custom">
            Or enter another amount (USD)
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-[var(--ink-soft)]">$</span>
            <input
              id="donate-custom"
              className="w-full rounded-md border border-[var(--rule)] bg-white/70 px-3 py-2 text-sm"
              inputMode="decimal"
              value={custom}
              onChange={(e) => {
                setPreset("custom");
                setCustom(e.target.value);
              }}
              onFocus={() => setPreset("custom")}
              min={5}
              max={5000}
              step="1"
              required
            />
          </div>
        </fieldset>

        <div>
          <label className="text-xs font-medium text-[var(--ink-soft)]" htmlFor="donate-name">
            Name <span className="font-normal">(optional)</span>
          </label>
          <input
            id="donate-name"
            className="mt-1 w-full rounded-md border border-[var(--rule)] bg-white/70 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={120}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--ink-soft)]" htmlFor="donate-email">
            Email <span className="font-normal">(optional receipt)</span>
          </label>
          <input
            id="donate-email"
            type="email"
            className="mt-1 w-full rounded-md border border-[var(--rule)] bg-white/70 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={160}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !Number.isFinite(dollars) || dollars < 5}
          className="w-full rounded-md bg-[var(--gold)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--charcoal)] disabled:opacity-60"
        >
          {busy ? "Opening checkout…" : "Continue to donate"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--ink-soft)]">
        <Link className="underline underline-offset-2" href="https://yatyasassociation.com/#support">
          Back to the Association site
        </Link>
      </p>
    </main>
  );
}
