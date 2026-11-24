"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export type RegistrationStatus = {
  registrations_open: boolean;
  wave_label: string;
  tag_prefix: string;
  tag_cap: number;
  issued_count: number;
  next_number: number;
  seats_remaining: number;
  closed_reason: string;
  reserved_numbers?: number[];
};

export function RegistrationWavePanel({
  initial,
}: {
  initial: RegistrationStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [waveLabel, setWaveLabel] = useState("Second Wave");
  const [prefix, setPrefix] = useState("SW");
  const [cap, setCap] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase.rpc("registration_status");
    if (data && typeof data === "object") {
      setStatus(data as RegistrationStatus);
    }
    router.refresh();
  }

  async function pauseOrResume(open: boolean) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_registrations_open", {
      p_open: open,
      p_reason: open ? "" : "Paused by Board",
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await refresh();
  }

  async function reopenWave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("reopen_membership_wave", {
      p_wave_label: waveLabel.trim(),
      p_tag_prefix: prefix.trim().toUpperCase(),
      p_tag_cap: cap,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await refresh();
  }

  const nextTag =
    status.next_number <= status.tag_cap
      ? `${status.tag_prefix}-${String(status.next_number).padStart(3, "0")}`
      : "—";

  return (
    <section className="space-y-3 rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--charcoal)]">
            {status.wave_label} · registration lock
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Public numbers issue in order (skipping Board holds). At capacity,
            new roster adds stop until the Board opens a different wave.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            status.registrations_open
              ? "bg-[rgba(63,70,51,0.12)] text-[var(--olive-deep)]"
              : "bg-red-100 text-red-900"
          }`}
        >
          {status.registrations_open ? "Open" : "Closed"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-[var(--ink-soft)]">Issued</dt>
          <dd className="font-semibold text-[var(--charcoal)]">
            {status.issued_count} / {status.tag_cap}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--ink-soft)]">Remaining</dt>
          <dd className="font-semibold text-[var(--charcoal)]">
            {status.seats_remaining}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--ink-soft)]">Next tag</dt>
          <dd className="font-semibold text-[var(--charcoal)]">{nextTag}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--ink-soft)]">Prefix</dt>
          <dd className="font-semibold text-[var(--charcoal)]">
            {status.tag_prefix}-###
          </dd>
        </div>
      </dl>

      {status.reserved_numbers && status.reserved_numbers.length > 0 ? (
        <p className="text-xs text-[var(--ink-soft)]">
          Board-held (not auto-issued):{" "}
          {status.reserved_numbers
            .map((n) => `${status.tag_prefix}-${String(n).padStart(3, "0")}`)
            .join(", ")}
          . Assign manually on the roster when ready (e.g. Jose FW-002, Fausto
          FW-003).
        </p>
      ) : null}

      {!status.registrations_open && status.closed_reason ? (
        <p className="text-xs text-red-900">{status.closed_reason}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status.registrations_open ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void pauseOrResume(false)}
            className="rounded-lg border border-[var(--rule)] px-3 py-2 text-xs font-semibold text-[var(--charcoal)] disabled:opacity-50"
          >
            Pause registrations
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void pauseOrResume(true)}
            className="rounded-lg border border-[var(--rule)] px-3 py-2 text-xs font-semibold text-[var(--charcoal)] disabled:opacity-50"
          >
            Resume this wave
          </button>
        )}
      </div>

      <form onSubmit={reopenWave} className="space-y-2 border-t border-[var(--rule)] pt-3">
        <p className="text-xs font-medium text-[var(--charcoal)]">
          Open a different wave
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            required
            placeholder="Wave label"
            value={waveLabel}
            onChange={(e) => setWaveLabel(e.target.value)}
            className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)]"
          />
          <input
            required
            maxLength={2}
            placeholder="Prefix (SW)"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm uppercase outline-none focus:border-[var(--olive)]"
          />
          <input
            required
            type="number"
            min={1}
            max={999}
            value={cap}
            onChange={(e) => setCap(Number(e.target.value) || 100)}
            className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--olive-deep)] px-3 py-2 text-xs font-semibold text-[var(--parchment)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Open new wave"}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
