import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = new Set([
  "https://yatyasassociation.com",
  "https://www.yatyasassociation.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(origin: string | null) {
  const allow =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://yatyasassociation.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(data: unknown, origin: string | null, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const supabase = adminClient();
  if (!supabase) {
    return json({ ok: false, error: "Hub not configured" }, origin, 503);
  }
  const { data, error } = await supabase.rpc("registration_status");
  if (error) {
    return json({ ok: false, error: error.message }, origin, 502);
  }
  return json({ ok: true, registration: data }, origin);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const supabase = adminClient();
  if (!supabase) {
    return json({ ok: false, error: "Hub not configured" }, origin, 503);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (String(body._gotcha || body.gotcha || "").trim()) {
    return json({ ok: true, status: "ignored" }, origin);
  }

  const fullName = String(body.name || body.full_name || "").trim();
  const email = String(body.email || "").trim();
  const serviceStatus = String(body.service_status || "").trim();
  const phone = String(body.phone || "").trim();
  const unit = String(body.unit || "").trim();
  const years = String(body.years || "").trim();
  const platform = String(body.platform || "").trim();
  const message = String(body.message || "").trim();

  const { data, error } = await supabase.rpc("submit_first_wave_application", {
    p_full_name: fullName,
    p_email: email,
    p_service_status: serviceStatus,
    p_phone: phone,
    p_unit: unit,
    p_years: years,
    p_platform: platform,
    p_message: message,
  });

  if (error) {
    return json({ ok: false, error: error.message }, origin, 502);
  }

  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) {
    return json(
      { ok: false, error: payload?.error || "Unable to submit application" },
      origin,
      400,
    );
  }

  return json(payload, origin);
}
