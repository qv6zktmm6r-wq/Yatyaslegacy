import { redirect } from "next/navigation";
import {
  firstWaveWelcomeHtml,
  firstWaveWelcomeSubject,
} from "@/emails/firstWaveWelcome";
import { hubSignupUrl } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";
import { isVipRole } from "@/lib/types";

export default async function LetterPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; name?: string }>;
}) {
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

  const params = await searchParams;
  const membershipTag = (params.tag || "FW-001").toUpperCase();
  const displayName = params.name || "Member";
  const html = firstWaveWelcomeHtml({
    displayName,
    membershipTag,
    hubSignupUrl: hubSignupUrl(),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
          Board preview
        </p>
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Welcome letter
        </h1>
        <p className="text-sm text-[var(--ink-soft)]">
          Subject: <em>{firstWaveWelcomeSubject(membershipTag)}</em>
        </p>
        <p className="text-sm text-[var(--ink-soft)]">
          This is the arrival letter members get with their number. Live send needs
          Resend on this project.
        </p>
      </header>
      <iframe
        title="Welcome letter preview"
        className="h-[920px] w-full overflow-hidden rounded-xl border border-[var(--rule)] shadow-lg"
        srcDoc={html}
      />
    </div>
  );
}
