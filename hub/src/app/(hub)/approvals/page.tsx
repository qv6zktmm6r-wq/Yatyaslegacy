import { redirect } from "next/navigation";
import { ApprovalsClient } from "@/components/ApprovalsClient";
import {
  RegistrationWavePanel,
  type RegistrationStatus,
} from "@/components/RegistrationWavePanel";
import { RosterClient } from "@/components/RosterClient";
import { WaitlistClient } from "@/components/WaitlistClient";
import { createClient } from "@/lib/supabase/server";
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
  reserved_numbers: [5, 6, 7],
};

export default async function ApprovalsPage() {
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

  const [{ data: pending }, { data: roster }, { data: regRaw }, { data: waitlist }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, bio, branch, created_at, chapter, role, title")
        .eq("chapter", "PENDING")
        .order("created_at", { ascending: true }),
      supabase
        .from("verified_members")
        .select(
          "id, email, first_name, last_name, membership_tag, claimed_user_id, entrance_paid_at, dues_status, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase.rpc("registration_status"),
      supabase
        .from("first_wave_applications")
        .select(
          "id, full_name, first_name, last_name, email, phone, service_status, unit, years, platform, message, status, membership_tag, created_at",
        )
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  const regStatus =
    regRaw && typeof regRaw === "object"
      ? ({ ...defaultRegStatus, ...(regRaw as object) } as RegistrationStatus)
      : defaultRegStatus;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display-face)] text-3xl text-[var(--charcoal)]">
          Verified members
        </h1>
        <p className="text-sm text-[var(--ink-soft)]">
          Add people to the roster first (email + name + membership tag). When
          they create a login with the same details, the hub recognizes them
          and their number is already on their profile.
        </p>
      </div>
      <RegistrationWavePanel initial={regStatus} />
      <WaitlistClient initialRows={waitlist || []} />
      <RosterClient
        initialRows={roster || []}
        registrationsOpen={regStatus.registrations_open}
        tagPrefix={regStatus.tag_prefix}
        nextNumber={regStatus.next_number}
        seatsRemaining={regStatus.seats_remaining}
      />

      <div>
        <h2 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Pending logins
        </h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Accounts that signed up but did not match the roster yet. You can
          still approve manually, or add them to the roster so they can claim.
        </p>
      </div>
      <ApprovalsClient initialPending={pending || []} />
    </div>
  );
}
