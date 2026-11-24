"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { MembershipTag } from "@/components/MembershipTag";
import { requestWelcomeEmail } from "@/lib/welcomeEmailClient";

export type RosterRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  membership_tag: string;
  claimed_user_id: string | null;
  entrance_paid_at?: string | null;
  dues_status?: string | null;
  created_at: string;
};

export function RosterClient({
  initialRows,
  registrationsOpen = true,
  tagPrefix = "FW",
  nextNumber = 1,
  seatsRemaining = 100,
}: {
  initialRows: RosterRow[];
  registrationsOpen?: boolean;
  tagPrefix?: string;
  nextNumber?: number;
  seatsRemaining?: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mailNote, setMailNote] = useState<string | null>(null);
  const [mailBusy, setMailBusy] = useState<string | null>(null);
  const nextTag =
    nextNumber > 0
      ? `${tagPrefix}-${String(nextNumber).padStart(3, "0")}`
      : `${tagPrefix}-###`;

  async function sendLetter(row: RosterRow) {
    setMailBusy(row.id);
    setMailNote(null);
    setError(null);
    const result = await requestWelcomeEmail({
      email: row.email,
      displayName: `${row.first_name} ${row.last_name}`.trim(),
      membershipTag: row.membership_tag,
    });
    setMailBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.mode === "dry-run") {
      setMailNote(
        `Letter ready for ${row.membership_tag} (dry-run — add RESEND_API_KEY to send).`,
      );
      return;
    }
    setMailNote(`Welcome letter sent to ${row.email} (${row.membership_tag}).`);
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMailNote(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("add_verified_member", {
      p_email: email.trim(),
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_membership_tag: tag.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (data && typeof data === "object") {
      const row = data as RosterRow;
      setRows((prev) => [row, ...prev]);
      await sendLetter(row);
    }
    setEmail("");
    setFirstName("");
    setLastName("");
    setTag("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onAdd}
        className="space-y-3 rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4"
      >
        <h2 className="font-semibold text-[var(--charcoal)]">
          Add verified member
        </h2>
        <p className="text-xs text-[var(--ink-soft)]">
          Add them before they create a login. Leave tag blank to auto-issue the
          next public number ({nextTag}
          {registrationsOpen ? ` · ${seatsRemaining} public seats left` : ""}).
          Board-held tags (FW-005–007) must be typed in manually. FW-001–004 are already claimed.
          Adding them prepares the welcome letter with their number and a Hub
          signup link.
        </p>
        {!registrationsOpen ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-900">
            Registrations are closed. Open a new wave above before adding
            members.
          </p>
        ) : null}
        <p className="text-xs text-[var(--ink-soft)]">
          <Link
            href="/approvals/letter-preview"
            className="font-medium text-[var(--olive-deep)] underline"
          >
            Preview the welcome letter
          </Link>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            required
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={!registrationsOpen}
            className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)] disabled:opacity-50"
          />
          <input
            required
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={!registrationsOpen}
            className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)] disabled:opacity-50"
          />
        </div>
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!registrationsOpen}
          className="w-full rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)] disabled:opacity-50"
        />
        <input
          placeholder={`${tagPrefix} tag (optional, e.g. ${tagPrefix}-014)`}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          disabled={!registrationsOpen}
          className="w-full rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)] disabled:opacity-50"
        />
        {error ? (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !registrationsOpen}
          className="rounded-lg bg-[var(--olive-deep)] px-3 py-2 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to roster"}
        </button>
      </form>

      {mailNote ? (
        <p className="rounded-xl border border-[var(--gold)]/40 bg-[rgba(176,141,62,0.12)] p-3 text-sm text-[var(--olive-deep)]">
          {mailNote}
        </p>
      ) : null}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2 font-semibold text-[var(--charcoal)]">
                  {row.first_name} {row.last_name}
                  <MembershipTag tag={row.membership_tag} />
                  <span className="text-xs font-normal text-[var(--ink-soft)]">
                    {row.claimed_user_id ? "Claimed login" : "Awaiting login"}
                  </span>
                  <span className="text-xs font-normal text-[var(--ink-soft)]">
                    {row.entrance_paid_at ? "Entrance paid" : "Entrance unpaid"}
                  </span>
                  {row.dues_status && row.dues_status !== "none" ? (
                    <span className="text-xs font-normal text-[var(--ink-soft)]">
                      Dues {row.dues_status}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[var(--ink-soft)]">{row.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/approvals/letter-preview?tag=${encodeURIComponent(row.membership_tag)}&name=${encodeURIComponent(`${row.first_name} ${row.last_name}`.trim())}`}
                  className="rounded-lg border border-[var(--rule)] px-2.5 py-1.5 text-xs font-medium text-[var(--olive-deep)] hover:bg-black/[0.03]"
                >
                  Preview letter
                </Link>
                <button
                  type="button"
                  disabled={mailBusy === row.id}
                  onClick={() => void sendLetter(row)}
                  className="rounded-lg bg-[var(--olive-deep)] px-2.5 py-1.5 text-xs font-semibold text-[var(--parchment)] disabled:opacity-50"
                >
                  {mailBusy === row.id ? "…" : "Send letter"}
                </button>
              </div>
            </div>
          </li>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No verified members yet.</p>
        ) : null}
      </ul>
    </div>
  );
}
