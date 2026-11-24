import { redirect } from "next/navigation";
import { ReportsClient, type ReportRow } from "@/components/ReportsClient";
import { createClient } from "@/lib/supabase/server";
import { isVipRole, unwrapOne } from "@/lib/types";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isVipRole(me?.role)) redirect("/feed");

  const { data: rows } = await supabase
    .from("chapter_post_reports")
    .select(
      "id, post_id, reporter_id, reason, status, created_at, chapter_posts!post_id(body), profiles!reporter_id(display_name)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const reports: ReportRow[] = (rows || []).map((r) => {
    const post = unwrapOne(r.chapter_posts) as { body: string } | null;
    const reporter = unwrapOne(r.profiles) as { display_name: string } | null;
    const body = post?.body || "";
    return {
      id: r.id,
      post_id: r.post_id,
      reporter_id: r.reporter_id,
      reason: r.reason,
      status: r.status,
      resolved_by: null,
      resolved_at: null,
      resolution_note: "",
      created_at: r.created_at,
      post_snippet: body.length > 240 ? `${body.slice(0, 240)}…` : body,
      reporter_name: reporter?.display_name || "Member",
    };
  });

  return <ReportsClient initialReports={reports} />;
}
