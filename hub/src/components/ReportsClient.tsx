"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ChapterPostReport, PostReportStatus } from "@/lib/types";

export type ReportRow = ChapterPostReport & {
  post_snippet: string;
  reporter_name: string;
};

export function ReportsClient({ initialReports }: { initialReports: ReportRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(reportId: string, status: PostReportStatus) {
    const note =
      status === "resolved"
        ? (window.prompt("Resolution note (optional)") ?? "")
        : (window.prompt("Dismissal note (optional)") ?? "");
    setBusy(reportId);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("resolve_post_report", {
      p_report_id: reportId,
      p_status: status,
      p_note: note.slice(0, 500),
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Flagged posts
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Posts members asked the Board to review. Board / VIP only.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {initialReports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rule)] p-6 text-center text-sm text-[var(--ink-soft)]">
          No flagged posts right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {initialReports.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4"
            >
              <p className="text-xs text-[var(--ink-soft)]">
                Reported {new Date(r.created_at).toLocaleString()} by {r.reporter_name}
              </p>
              {r.reason ? (
                <p className="mt-1 text-sm text-[var(--charcoal)]">
                  <span className="font-semibold">Reason:</span> {r.reason}
                </p>
              ) : null}
              <p className="mt-2 rounded-lg bg-black/[0.04] p-2 text-sm text-[var(--ink)]">
                {r.post_snippet}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void resolve(r.id, "resolved")}
                  className="rounded-lg bg-[var(--olive-deep)] px-3 py-1.5 text-xs font-semibold text-[var(--parchment)]"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void resolve(r.id, "dismissed")}
                  className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-1.5 text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
