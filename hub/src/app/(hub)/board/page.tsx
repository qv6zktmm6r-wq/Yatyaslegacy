import { redirect } from "next/navigation";
import {
  BoardDashboardClient,
  type BoardPaymentRow,
  type BoardRosterRow,
} from "@/components/BoardDashboardClient";
import {
  RegistrationWavePanel,
  type RegistrationStatus,
} from "@/components/RegistrationWavePanel";
import {
  SponsorsBoardClient,
  type SponsorRow,
} from "@/components/SponsorsBoardClient";
import {
  CrewFinderBoardClient,
  type CrewFinderRow,
} from "@/components/CrewFinderBoardClient";
import { createClient } from "@/lib/supabase/server";
import { stripeMode } from "@/lib/stripe";
import { isVipRole } from "@/lib/types";

const defaultRegStatus: RegistrationStatus = {
  registrations_open: true,
  wave_label: "First Wave",
  tag_prefix: "FW",
  tag_cap: 100,
  issued_count: 0,
  next_number: 8,
  seats_remaining: 93,
  closed_reason: "",
  reserved_numbers: [5, 6, 7],
  claimed_numbers: [1, 2, 3, 4],
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
    { data: sponsors },
    { data: crewEntries },
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
    supabase
      .from("association_sponsors")
      .select(
        "id, organization_name, contact_name, contact_email, website_url, logo_url, interest_type, support_focus, gift_range, message, status, display_order, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("crew_finder_entries")
      .select(
        "id, intent, full_name, email, story_raw, looking_for, unit, years, platform, station, matchable, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(120),
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
      <RegistrationWavePanel initial={regStatus} />
      <SponsorsBoardClient initialRows={(sponsors || []) as SponsorRow[]} />
      <CrewFinderBoardClient
        initialRows={(crewEntries || []) as CrewFinderRow[]}
      />
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
