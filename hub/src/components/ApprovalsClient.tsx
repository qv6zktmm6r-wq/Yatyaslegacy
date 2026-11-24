"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { requestWelcomeEmail } from "@/lib/welcomeEmailClient";

type PendingRow = {
  id: string;
  display_name: string;
  bio: string;
  branch: string;
  created_at: string;
};

export function ApprovalsClient({
  initialPending,
}: {
  initialPending: PendingRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialPending);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastTag, setLastTag] = useState<string | null>(null);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    setLastTag(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("approve_member", {
      target_id: id,
    });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const approved =
      data && typeof data === "object"
        ? (data as { membership_tag?: string; display_name?: string; id?: string })
        : null;
    const tag = String(approved?.membership_tag || "");
    if (tag) setLastTag(tag);
    setRows((prev) => prev.filter((r) => r.id !== id));

    if (tag) {
      const { data: roster } = await supabase
        .from("verified_members")
        .select("email, first_name, last_name")
        .eq("membership_tag", tag)
        .maybeSingle();
      const email = roster?.email;
      if (email) {
        const mail = await requestWelcomeEmail({
          email,
          displayName:
            approved?.display_name ||
            `${roster.first_name || ""} ${roster.last_name || ""}`.trim() ||
            "Member",
          membershipTag: tag,
        });
        if (mail.ok && mail.mode === "sent") {
          setLastTag(`${tag} · welcome letter sent`);
        } else if (mail.ok && mail.mode === "dry-run") {
          setLastTag(`${tag} · letter ready (dry-run until Resend is connected)`);
        }
      }
    }

    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        {lastTag ? (
          <p className="rounded-xl border border-[var(--gold)]/40 bg-[rgba(176,141,62,0.12)] p-3 text-sm text-[var(--olive-deep)]">
            Approved and issued <strong>{lastTag}</strong>.
          </p>
        ) : null}
        <p className="rounded-xl border border-dashed border-[var(--rule)] bg-white/50 p-6 text-center text-sm text-[var(--ink-soft)]">
          No pending requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {lastTag ? (
        <p className="rounded-xl border border-[var(--gold)]/40 bg-[rgba(176,141,62,0.12)] p-3 text-sm text-[var(--olive-deep)]">
          Approved and issued <strong>{lastTag}</strong>.{" "}
          <Link
            href={`/approvals/letter-preview?tag=${encodeURIComponent(lastTag.split(" ")[0] || "FW-001")}`}
            className="underline"
          >
            Preview letter
          </Link>
        </p>
      ) : null}
      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4 shadow-[0_1px_2px_rgba(42,38,32,0.06)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--charcoal)]">
                {row.display_name}
              </h2>
              <p className="text-xs text-[var(--ink-soft)]">
                Requested{" "}
                {new Date(row.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {row.branch ? ` · ${row.branch}` : null}
              </p>
              {row.bio ? (
                <p className="mt-2 text-sm text-[var(--ink)]">{row.bio}</p>
              ) : null}
              <p className="mt-2 text-xs text-[var(--ink-soft)]">
                Approving issues the next First Wave tag (FW-###).
              </p>
            </div>
            <button
              type="button"
              disabled={busyId === row.id}
              onClick={() => void approve(row.id)}
              className="rounded-lg bg-[var(--olive-deep)] px-3 py-2 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
            >
              {busyId === row.id ? "…" : "Approve"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
