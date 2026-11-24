import { redirect } from "next/navigation";
import {
  BoardDashboardClient,
  type BoardPaymentRow,
  type BoardRosterRow,
} from "@/components/BoardDashboardClient";
import type { RegistrationStatus } from "@/components/RegistrationWavePanel";
import { createClient } from "@/lib/supabase/server";
import { stripeMode } from "@/lib/stripe";
import { isVipRole } from "@/lib/types";

const defaultRegStatus: RegistrationStatus = {
  registrations_open: true,
  wave_label: "First Wave",
  tag_prefix: "FW",
  tag_cap: 100,
  issued_count: 0,
  next_number: 11,
  seats_remaining: 89,
  closed_reason: "",
  reserved_numbers: [1, 2, 3, 4, 5, 6, 7],
};

export default async function BoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isVipRole(me?.role)) redirect("/feed");

  const [
    { data: regRaw },
    { data: payments },
    { data: roster },
    { count: waitlistPending },
    { count: holdsActive },
  ] = await Promise.all([
    supabase.rpc("registration_status"),
    supabase
      .from("membership_payments")
      .select(
        "id, email, first_name, last_name, kind, amount_cents, currency, status, membership_tag, paid_at, refunded_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("verified_members")
      .select(
        "id, email, first_name, last_name, membership_tag, claimed_user_id, entrance_paid_at, dues_status, created_at",
      )
      .order("membership_tag", { ascending: true }),
    supabase
      .from("first_wave_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("membership_checkout_holds")
      .select("id", { count: "exact", head: true })
      .gte("expires_at", new Date().toISOString()),
  ]);

  const regStatus =
    regRaw && typeof regRaw === "object"
      ? ({ ...defaultRegStatus, ...(regRaw as object) } as RegistrationStatus)
      : defaultRegStatus;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display-face)] text-3xl text-[var(--charcoal)]">
          Board dashboard
        </h1>
        <p className="text-sm text-[var(--ink-soft)]">
          Registration, entrance payments, and membership numbers in one place.
          Public First Wave numbers are issued automatically in order after
          entrance payment clears.
        </p>
      </div>
      <BoardDashboardClient
        stripeReady={stripeMode() === "ready"}
        regStatus={regStatus}
        payments={(payments || []) as BoardPaymentRow[]}
        roster={(roster || []) as BoardRosterRow[]}
        waitlistPending={waitlistPending || 0}
        holdsActive={holdsActive || 0}
      />
    </div>
  );
}
