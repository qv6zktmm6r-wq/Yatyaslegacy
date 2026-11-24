import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isApprovedMember } from "@/lib/membership";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");
  const isPendingPage = path.startsWith("/pending");
  const isDigestApi = path === "/api/digest" || path.startsWith("/api/digest/");
  const isWaitlistApi =
    path === "/api/first-wave-waitlist" ||
    path.startsWith("/api/first-wave-waitlist/");
  const isSponsorsApi =
    path === "/api/sponsors" || path.startsWith("/api/sponsors/");
  const isStripePublic =
    path.startsWith("/api/stripe/") ||
    path.startsWith("/pay") ||
    path.startsWith("/donate");
  const isPublic =
    isAuthPage ||
    path.startsWith("/auth") ||
    path === "/" ||
    path === "/health" ||
    isDigestApi ||
    isWaitlistApi ||
    isSponsorsApi ||
    isStripePublic;

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("chapter, role")
      .eq("id", user.id)
      .maybeSingle();

    const approved = isApprovedMember(profile);

    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = approved ? "/feed" : "/pending";
      return NextResponse.redirect(url);
    }

    // Unapproved accounts may still reach pay/donate to complete membership.
    if (
      !approved &&
      !isPendingPage &&
      !path.startsWith("/auth") &&
      !isStripePublic
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }

    if (approved && isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/feed";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
