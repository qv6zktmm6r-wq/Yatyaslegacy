import { NextResponse } from "next/server";
import { isApprovedMember } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/feed";
  const supabase = await createClient();

  async function afterAuth(preferred: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "/login";

    // Password recovery / set-password must not bounce through claim or pending.
    if (
      preferred.startsWith("/auth/update-password") ||
      preferred.includes("setPassword")
    ) {
      return "/auth/update-password";
    }

    const first =
      (user.user_metadata?.first_name as string | undefined)?.trim() ||
      (user.user_metadata?.display_name as string | undefined)?.split(" ")[0] ||
      "";
    const last =
      (user.user_metadata?.last_name as string | undefined)?.trim() ||
      (user.user_metadata?.display_name as string | undefined)
        ?.split(" ")
        .slice(1)
        .join(" ") ||
      "";

    if (first && last) {
      await supabase.rpc("claim_verified_membership", {
        p_first_name: first,
        p_last_name: last,
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("chapter, role, membership_tag")
      .eq("id", user.id)
      .maybeSingle();

    if (!isApprovedMember(profile)) return "/pending";
    if (preferred.startsWith("/pending")) return "/feed";
    return preferred.startsWith("/") ? preferred : "/feed";
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = await afterAuth(next);
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "magiclink" | "signup" | "invite" | "email",
      token_hash: tokenHash,
    });
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }
      const dest = await afterAuth(next);
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
