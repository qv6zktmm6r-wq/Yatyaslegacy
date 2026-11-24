"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MembershipTag } from "@/components/MembershipTag";
import type { RegistrationStatus } from "@/components/RegistrationWavePanel";

export type BoardPaymentRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  kind: string;
  amount_cents: number;
  currency: string;
  status: string;
  membership_tag: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export type BoardRosterRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  membership_tag: string;
  claimed_user_id: string | null;
  entrance_paid_at: string | null;
  dues_status: string | null;
  created_at: string;
};

function money(cents: number, currency = "usd") {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const colors =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900"
        : tone === "bad"
          ? "bg-red-50 text-red-800"
          : "bg-stone-100 text-stone-700";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${colors}`}
    >
      {children}
    </span>
  );
}

export function BoardDashboardClient({
  stripeReady,
  regStatus,
  payments,
  roster,
  waitlistPending,
  holdsActive,
}: {
  stripeReady: boolean;
  regStatus: RegistrationStatus;
  payments: BoardPaymentRow[];
  roster: BoardRosterRow[];
  waitlistPending: number;
  holdsActive: number;
}) {
  const router = useRouter();
  const [liveReg, setLiveReg] = useState(regStatus);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    setLiveReg(regStatus);
  }, [regStatus]);

  useEffect(() => {
    const tick = async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("registration_status");
      if (data && typeof data === "object") {
        setLiveReg(data as RegistrationStatus);
      }
      router.refresh();
    };
    const id = window.setInterval(() => void tick(), 20000);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  const entrancePaid = useMemo(
    () =>
      payments.filter((p) => p.kind === "entrance" && p.status === "paid")
        .length,
    [payments],
  );
  const unpaidRoster = useMemo(
    () => roster.filter((r) => !r.entrance_paid_at).length,
    [roster],
  );
  const unclaimed = useMemo(
    () => roster.filter((r) => r.entrance_paid_at && !r.claimed_user_id).length,
    [roster],
  );
  const nextTag =
    liveReg.next_number > 0
      ? `${liveReg.tag_prefix}-${String(liveReg.next_number).padStart(3, "0")}`
      : `${liveReg.tag_prefix}-###`;

  async function onOverride(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "board_mark_entrance_paid",
      {
        p_email: email.trim(),
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_reason: reason.trim(),
        p_issue_tag: true,
      },
    );
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const tag = (data as { membership_tag?: string } | null)?.membership_tag;
    setNote(
      tag
        ? `Override recorded. Issued ${tag}.`
        : "Override recorded.",
    );
    setEmail("");
    setFirstName("");
    setLastName("");
    setReason("");
    router.refresh();
  }

  async function createPayLink(e: FormEvent) {
    e.preventDefault();
    setPayBusy(true);
    setError(null);
    setNote(null);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };
    setPayBusy(false);
    if (!data.ok || !data.url) {
      setError(data.error || "Could not create pay link");
      return;
    }
    setNote(`Pay link ready — opening Checkout.`);
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-8">
      {!stripeReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Stripe not connected.</strong> Dashboard and ledger are ready.
          Auto-numbering starts after corp bank + YAT-YAS Stripe keys on
          yatyas-hub. Until then use audited offline override below for
          exceptions only.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Stripe connected. Entrance payment issues the next public{" "}
          {regStatus.tag_prefix} number in order (skips reserved seats).
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Seats left" value={String(liveReg.seats_remaining)} />
        <Stat label="Next public #" value={nextTag} />
        <Stat label="Claimed" value={String((liveReg.claimed_numbers || []).length)} />
        <Stat label="Waitlist" value={String(waitlistPending)} />
        <Stat label="Entrance paid" value={String(entrancePaid)} />
        <Stat label="Unclaimed Hub" value={String(unclaimed)} />
        <Stat label="Checkout holds" value={String(holdsActive)} />
      </section>

      <p className="text-sm text-[var(--ink-soft)]">
        Wave: {liveReg.wave_label}
        {liveReg.registrations_open ? " · open" : " · closed"}
        {unpaidRoster > 0
          ? ` · ${unpaidRoster} rostered without entrance paid (Board/founder path)`
          : ""}
        . Tracker refreshes as payments clear.{" "}
        <Link href="/approvals" className="underline">
          Open Roster / waitlist actions
        </Link>
      </p>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Members & payments
        </h2>
        <ul className="divide-y divide-[var(--rule)] rounded-xl border border-[var(--rule)] bg-white">
          {roster.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--ink-soft)]">
              No rostered members yet.
            </li>
          ) : (
            roster.map((row) => {
              const pay = payments.find(
                (p) =>
                  p.membership_tag === row.membership_tag ||
                  p.email.toLowerCase() === row.email.toLowerCase(),
              );
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MembershipTag tag={row.membership_tag} />
                      <span className="font-medium text-[var(--charcoal)]">
                        {row.first_name} {row.last_name}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink-soft)]">{row.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.entrance_paid_at || pay?.status === "paid" ? (
                      <Badge tone="ok">Entrance paid</Badge>
                    ) : (
                      <>
                        <Badge tone="warn">Entrance unpaid</Badge>
                        {stripeReady ? (
                          <button
                            type="button"
                            className="rounded border border-[var(--olive)] px-2 py-0.5 text-[11px] font-semibold text-[var(--olive)]"
                            disabled={payBusy}
                            onClick={async () => {
                              setPayBusy(true);
                              setError(null);
                              const res = await fetch("/api/stripe/checkout", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  email: row.email,
                                  firstName: row.first_name,
                                  lastName: row.last_name,
                                }),
                              });
                              const data = (await res.json()) as {
                                ok?: boolean;
                                url?: string;
                                error?: string;
                              };
                              setPayBusy(false);
                              if (!data.ok || !data.url) {
                                setError(data.error || "Pay link failed");
                                return;
                              }
                              window.open(
                                data.url,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                          >
                            Pay link
                          </button>
                        ) : null}
                      </>
                    )}
                    {pay?.status === "refunded" ? (
                      <Badge tone="bad">Refunded (tag kept)</Badge>
                    ) : null}
                    {row.claimed_user_id ? (
                      <Badge tone="ok">Hub claimed</Badge>
                    ) : (
                      <Badge>Awaiting signup</Badge>
                    )}
                    <Badge
                      tone={
                        row.dues_status === "active"
                          ? "ok"
                          : row.dues_status === "past_due"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      Dues: {row.dues_status || "none"}
                    </Badge>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Recent payment ledger
        </h2>
        <ul className="divide-y divide-[var(--rule)] rounded-xl border border-[var(--rule)] bg-white">
          {payments.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--ink-soft)]">
              No payment rows yet.
            </li>
          ) : (
            payments.slice(0, 40).map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[var(--charcoal)]">
                    {p.first_name} {p.last_name} · {p.email}
                  </p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    {p.kind} · {money(p.amount_cents, p.currency)} ·{" "}
                    {p.membership_tag || "no tag yet"}
                  </p>
                </div>
                <Badge
                  tone={
                    p.status === "paid"
                      ? "ok"
                      : p.status === "refunded" || p.status === "failed"
                        ? "bad"
                        : p.status === "past_due"
                          ? "warn"
                          : "neutral"
                  }
                >
                  {p.status}
                </Badge>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--rule)] bg-white p-4">
        <h2 className="font-[family-name:var(--font-display-face)] text-xl text-[var(--charcoal)]">
          Board tools
        </h2>
        <p className="text-xs text-[var(--ink-soft)]">
          Offline / exception path only. Requires a reason (audited). Public
          numbers still come from the same sequential issuer.
        </p>
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={onOverride}>
          <input
            className="rounded border border-[var(--rule)] px-3 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="rounded border border-[var(--rule)] px-3 py-2 text-sm"
            placeholder="Reason (min 8 chars)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={8}
          />
          <input
            className="rounded border border-[var(--rule)] px-3 py-2 text-sm"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            className="rounded border border-[var(--rule)] px-3 py-2 text-sm"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-[var(--charcoal)] px-3 py-2 text-sm font-semibold text-white sm:col-span-2"
          >
            {busy ? "Saving…" : "Mark entrance paid + issue next number"}
          </button>
          {stripeReady ? (
            <button
              type="button"
              disabled={payBusy}
              onClick={createPayLink}
              className="rounded-md border border-[var(--olive)] px-3 py-2 text-sm font-semibold text-[var(--olive)] sm:col-span-2"
            >
              {payBusy ? "Creating…" : "Create Stripe pay link (same form)"}
            </button>
          ) : null}
        </form>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {note ? <p className="text-sm text-emerald-800">{note}</p> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--rule)] bg-white px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[var(--ink-soft)]">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
        {value}
      </p>
    </div>
  );
}
