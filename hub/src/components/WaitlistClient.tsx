"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { requestWelcomeEmail } from "@/lib/welcomeEmailClient";
import { MembershipTag } from "@/components/MembershipTag";

export type WaitlistRow = {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  service_status: string;
  unit: string;
  years: string;
  platform: string;
  message: string;
  status: string;
  membership_tag: string | null;
  created_at: string;
};

export function WaitlistClient({ initialRows }: { initialRows: WaitlistRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function inviteToPay(row: WaitlistRow) {
    setBusyId(row.id);
    setError(null);
    setNote(null);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: row.email,
        firstName: row.first_name || row.full_name.split(/\s+/)[0] || "",
        lastName:
          row.last_name ||
          row.full_name.split(/\s+/).slice(1).join(" ") ||
          "",
        applicationId: row.id,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };
    setBusyId(null);
    if (!data.ok || !data.url) {
      setError(
        data.error ||
          "Stripe pay link unavailable. Finish bank + keys, or use Board roster override.",
      );
      return;
    }
    setNote(
      `Pay link ready for ${row.full_name}. Number issues only after payment clears.`,
    );
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function promote(row: WaitlistRow) {
    setBusyId(row.id);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "promote_first_wave_application",
      { p_application_id: row.id, p_membership_tag: null },
    );
    if (rpcError) {
      setBusyId(null);
      setError(rpcError.message);
      return;
    }
    const result = data as {
      ok?: boolean;
      membership_tag?: string;
      email?: string;
      display_name?: string;
      error?: string;
    };
    if (!result?.ok) {
      setBusyId(null);
      setError(result?.error || "Promote failed");
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: "accepted",
              membership_tag: result.membership_tag || null,
            }
          : r,
      ),
    );

    if (result.email && result.membership_tag) {
      const mail = await requestWelcomeEmail({
        email: result.email,
        displayName: result.display_name || row.full_name,
        membershipTag: result.membership_tag,
      });
      if (mail.ok) {
        setNote(
          mail.mode === "dry-run"
            ? `Added ${result.membership_tag} (welcome letter dry-run).`
            : `Added ${result.membership_tag} and sent welcome letter.`,
        );
      } else {
        setNote(`Added ${result.membership_tag}. Letter: ${mail.error}`);
      }
    } else {
      setNote(`Added ${result.membership_tag || "member"} to verified roster.`);
    }

    setBusyId(null);
    router.refresh();
  }

  async function reject(row: WaitlistRow, asDuplicate = false) {
    setBusyId(row.id);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(
      "reject_first_wave_application",
      { p_application_id: row.id, p_as_duplicate: asDuplicate },
    );
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setNote(asDuplicate ? "Marked duplicate." : "Application declined.");
    router.refresh();
  }

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          First Wave waitlist
        </h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Preferred path: <strong>Invite to pay</strong> — Checkout holds a seat;
          the next public number issues only after entrance clears.{" "}
          <strong>Roster without payment</strong> is the Board exception path
          (no Stripe).
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="rounded-xl border border-[var(--gold)]/40 bg-[rgba(176,141,62,0.12)] p-3 text-sm text-[var(--olive-deep)]">
          {note}
        </p>
      ) : null}

      <ul className="space-y-2">
        {pending.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] px-4 py-3 text-sm"
          >
            <div className="font-semibold text-[var(--charcoal)]">
              {row.full_name}
            </div>
            <p className="text-xs text-[var(--ink-soft)]">
              {row.email}
              {row.phone ? ` · ${row.phone}` : ""}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              {row.service_status}
              {row.unit ? ` · ${row.unit}` : ""}
              {row.years ? ` · ${row.years}` : ""}
              {row.platform ? ` · ${row.platform}` : ""}
            </p>
            {row.message ? (
              <p className="mt-2 whitespace-pre-wrap text-[var(--ink)]">
                {row.message}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void inviteToPay(row)}
                className="rounded-lg bg-[var(--olive-deep)] px-2.5 py-1.5 text-xs font-semibold text-[var(--parchment)] disabled:opacity-50"
              >
                {busyId === row.id ? "…" : "Invite to pay"}
              </button>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void promote(row)}
                className="rounded-lg border border-[var(--olive)] px-2.5 py-1.5 text-xs font-semibold text-[var(--olive-deep)] disabled:opacity-50"
              >
                Roster without payment
              </button>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void reject(row, false)}
                className="rounded-lg border border-[var(--rule)] px-2.5 py-1.5 text-xs font-medium text-[var(--charcoal)] disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void reject(row, true)}
                className="rounded-lg border border-[var(--rule)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-soft)] disabled:opacity-50"
              >
                Duplicate
              </button>
            </div>
          </li>
        ))}
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No pending waitlist applications.</p>
        ) : null}
      </ul>

      {rows.some((r) => r.status === "accepted" && r.membership_tag) ? (
        <div className="text-xs text-[var(--ink-soft)]">
          Recently accepted:{" "}
          {rows
            .filter((r) => r.status === "accepted" && r.membership_tag)
            .slice(0, 5)
            .map((r) => (
              <span key={r.id} className="mr-2 inline-flex items-center gap-1">
                {r.full_name} <MembershipTag tag={r.membership_tag} />
              </span>
            ))}
        </div>
      ) : null}
    </section>
  );
}
