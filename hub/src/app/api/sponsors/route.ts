import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    "Cache-Control": "no-store, max-age=0",
    Vary: "Origin",
  };
}

function json(data: unknown, origin: string | null, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

function adminClient() {
  return createAdminClient();
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

  const { data, error } = await supabase
    .from("association_sponsors")
    .select("id, organization_name, website_url, logo_url, display_order")
    .eq("status", "approved")
    .not("logo_url", "is", null)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return json({ ok: false, error: error.message }, origin, 502);
  }

  const sponsors = (data || []).filter(
    (row) => typeof row.logo_url === "string" && row.logo_url.trim().length > 0,
  );

  return json({ ok: true, sponsors }, origin);
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

  const organization = String(body.organization || "").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const message = String(body.message || "").trim();
  if (!organization || !name || !email || !message) {
    return json(
      { ok: false, error: "Organization, contact name, email, and message are required." },
      origin,
      400,
    );
  }

  const { error } = await supabase.from("association_sponsors").insert({
    organization_name: organization.slice(0, 160),
    contact_name: name.slice(0, 120),
    contact_email: email.slice(0, 160),
    interest_type: String(body.interest_type || "").slice(0, 80) || null,
    support_focus: String(body.support_focus || "").slice(0, 80) || null,
    gift_range: String(body.gift_range || "").slice(0, 80) || null,
    message: message.slice(0, 2000),
    status: "pending",
  });

  if (error) {
    return json({ ok: false, error: error.message }, origin, 502);
  }

  return json({ ok: true }, origin);
}
