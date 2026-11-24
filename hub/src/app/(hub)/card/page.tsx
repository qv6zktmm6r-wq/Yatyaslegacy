import Image from "next/image";
import { redirect } from "next/navigation";
import { MembershipTag } from "@/components/MembershipTag";
import { createClient } from "@/lib/supabase/server";
import { roleLadderLabel, type Profile } from "@/lib/types";

export default async function MemberCardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/profile");

  const typed = profile as Profile;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <header className="print:hidden">
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Digital member card
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Screenshot or print — your official YAT-YAS hub credentials.
        </p>
      </header>

      <article
        id="member-card"
        className="member-card-print relative overflow-hidden rounded-2xl border-2 border-[var(--gold)] bg-gradient-to-br from-[#3f4633] via-[#5a6348] to-[#2a2620] p-6 text-[var(--parchment)] shadow-xl"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--gold)]/20 blur-2xl" />
        <div className="flex items-start justify-between gap-4">
          <Image
            src="/crest-20261124.png"
            alt="YAT-YAS crest"
            width={72}
            height={82}
            className="h-16 w-auto drop-shadow"
            priority
          />
          <span className="text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gold-soft)]">
            Member Hub
          </span>
        </div>
        <p className="mt-6 font-[family-name:var(--font-display-face)] text-3xl leading-tight">
          {typed.display_name}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-lg">
          <MembershipTag tag={typed.membership_tag} size="md" />
          <span className="text-[var(--gold-soft)]">{roleLadderLabel(typed.role, typed.title)}</span>
        </p>
        {(typed.branch || typed.home_region) && (
          <p className="mt-3 text-sm text-[var(--parchment)]/85">
            {[typed.branch, typed.home_region].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-8 border-t border-[var(--gold)]/30 pt-4 text-[11px] uppercase tracking-widest text-[var(--gold-soft)]">
          YAT-YAS Association · Verified member
        </p>
      </article>

      <p className="print:hidden text-center text-xs text-[var(--ink-soft)]">
        Tip: use your browser&apos;s print dialog and enable &quot;background graphics&quot; for best results.
      </p>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #member-card, #member-card * { visibility: visible; }
          #member-card {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 4in;
            border-radius: 0;
          }
        }
      `}</style>
    </div>
  );
}
