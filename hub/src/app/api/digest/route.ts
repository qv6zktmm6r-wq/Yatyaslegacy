import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Weekly digest stub — dry-run only.
 * Sending email via Resend requires owner spend approval for paid sends.
 * Cron must send Authorization: Bearer $CRON_SECRET.
 */
async function handleDigest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY not configured", mode: "dry-run" },
      { status: 501 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Service role not configured for digest aggregates" },
      { status: 503 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: postCount, error: postsError } = await supabase
    .from("chapter_posts")
    .select("id", { count: "exact", head: true })
    .eq("chapter", "HUB")
    .gte("created_at", since);

  const { count: eventCount, error: eventsError } = await supabase
    .from("hub_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  const { count: memberCount, error: membersError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("chapter", "MEMBER")
    .gte("updated_at", since);

  if (postsError || eventsError || membersError) {
    return NextResponse.json({ ok: false, error: "Aggregate query failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mode: "dry-run",
    note: "Email send not executed — owner approval required for Resend paid sends.",
    window_start: since,
    counts: {
      hub_posts_last_7_days: postCount ?? 0,
      hub_events_created_last_7_days: eventCount ?? 0,
      member_profiles_touched_last_7_days: memberCount ?? 0,
    },
  });
}

export async function GET(request: Request) {
  return handleDigest(request);
}

export async function POST(request: Request) {
  return handleDigest(request);
}
