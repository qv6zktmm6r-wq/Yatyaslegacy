import { HubNav } from "@/components/HubNav";
import { createClient } from "@/lib/supabase/server";
import { isVipRole, type MemberRole } from "@/lib/types";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: MemberRole | null =
    (user?.app_metadata?.role as MemberRole | undefined) || null;
  let title = (user?.app_metadata?.title as string | undefined) || "";
  const metaVip = Boolean(user?.app_metadata?.vip);

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, title")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role) role = profile.role as MemberRole;
    if (profile?.title) title = profile.title;
  }

  const vip = metaVip || isVipRole(role);

  return (
    <div className="min-h-screen">
      <HubNav initialRole={role} initialTitle={title} initialVip={vip} />
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}
