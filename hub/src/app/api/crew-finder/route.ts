import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enrichNorms,
  scoreMatch,
  type SafeMatch,
} from "@/lib/crew-match";

const ALLOWED_ORIGINS = new Set([
  "https://yatyasassociation.com",
  "https://www.yatyasassociation.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(origin: string | null) {
  const allow =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://yatyasassociation.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, max-age=0",
    Vary: "Origin",
  };
}

function json(data: unknown, origin: string | null, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

type CandidateRow = {
  id: string;
  full_name: string;
  unit: string | null;
  years: string | null;
  platform: string | null;
  station: string | null;
  unit_norm: string | null;
  platform_norm: string | null;
  station_norm: string | null;
  years_start: number | null;
  years_end: number | null;
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const supabase = createAdminClient();
  if (!supabase) {
    return json({ ok: false, error: "Hub not configured" }, origin, 503);
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (String(body._gotcha || body.gotcha || "").trim()) {
    return json({ ok: true, status: "ignored", matches: [] }, origin);
  }

  const intent = String(body.crew_intent || body.intent || "find").trim() ===
    "list"
    ? "list"
    : "find";
  const fullName = String(body.name || body.full_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const story = String(body.story || body.raw_story || "").trim();

  if (!fullName || !email || story.length < 12) {
    return json(
      {
        ok: false,
        error: "Name, email, and a short service story are required.",
      },
      origin,
      400,
    );
  }

  const unit = String(body.looking_unit || body.unit || "").trim() || null;
  const preferredUnit = String(body.preferred_unit || "").trim() || null;
  const years = String(body.looking_years || body.years || "").trim() || null;
  const platform =
    String(body.looking_platform || body.platform || "").trim() || null;
  const station =
    String(body.looking_station || body.station || "").trim() || null;
  const deployment =
    String(body.looking_deployment || body.deployment || "").trim() || null;
  const schoolhouse =
    String(body.looking_schoolhouse || body.schoolhouse || "").trim() || null;
  const lookingFor =
    String(body.looking_for || "").trim() || story.slice(0, 400);
  const aiSummary = String(body.ai_summary || "").trim() || null;
  const aiConfidence = String(body.ai_confidence || "").trim() || null;

  const norms = enrichNorms({
    unit,
    preferred_unit: preferredUnit,
    platform,
    station,
    years,
  });

  const matchable = intent === "list";

  const { data: inserted, error: insertError } = await supabase
    .from("crew_finder_entries")
    .insert({
      intent,
      full_name: fullName.slice(0, 120),
      email: email.slice(0, 160),
      story_raw: story.slice(0, 2500),
      looking_for: lookingFor.slice(0, 800),
      unit: (unit || preferredUnit || "").slice(0, 120) || null,
      years: years?.slice(0, 80) || null,
      platform: platform?.slice(0, 120) || null,
      station: station?.slice(0, 160) || null,
      deployment: deployment?.slice(0, 160) || null,
      schoolhouse: schoolhouse?.slice(0, 160) || null,
      preferred_unit: preferredUnit?.slice(0, 120) || null,
      ai_summary: aiSummary?.slice(0, 800) || null,
      ai_confidence: aiConfidence?.slice(0, 40) || null,
      unit_norm: norms.unit_norm,
      platform_norm: norms.platform_norm,
      station_norm: norms.station_norm,
      years_start: norms.years_start,
      years_end: norms.years_end,
      matchable,
      status: "open",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("crew-finder insert failed", insertError.message);
    return json(
      { ok: false, error: "Could not save your Crew Finder request." },
      origin,
      502,
    );
  }

  let matches: SafeMatch[] = [];
  let seekingCount = 0;

  if (intent === "find") {
    const { data: candidates } = await supabase
      .from("crew_finder_entries")
      .select(
        "id, full_name, unit, years, platform, station, unit_norm, platform_norm, station_norm, years_start, years_end",
      )
      .eq("intent", "list")
      .eq("matchable", true)
      .eq("status", "open")
      .neq("email", email)
      .order("created_at", { ascending: false })
      .limit(200);

    matches = ((candidates || []) as CandidateRow[])
      .map((row) =>
        scoreMatch(
          {
            unit_norm: norms.unit_norm,
            platform_norm: norms.platform_norm,
            station_norm: norms.station_norm,
            years_start: norms.years_start,
            years_end: norms.years_end,
          },
          row,
        ),
      )
      .filter((m): m is SafeMatch => Boolean(m))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (matches.length && inserted?.id) {
      await supabase
        .from("crew_finder_entries")
        .update({ status: "matched" })
        .eq("id", inserted.id);
    }
  } else {
    const { count } = await supabase
      .from("crew_finder_entries")
      .select("id", { count: "exact", head: true })
      .eq("intent", "find")
      .eq("status", "open")
      .neq("email", email);
    seekingCount = count || 0;
  }

  return json(
    {
      ok: true,
      intent,
      entry_id: inserted?.id || null,
      matches,
      seeking_count: seekingCount,
      board_followup: true,
    },
    origin,
  );
}
