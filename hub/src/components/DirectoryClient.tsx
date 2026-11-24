"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { MembershipTag } from "@/components/MembershipTag";
import { MessageMemberButton } from "@/components/MessageMemberButton";
import { roleLadderLabel, type ProfileSnippet } from "@/lib/types";

export type DirectoryMember = ProfileSnippet & {
  id: string;
  avatar_url: string | null;
};

export function DirectoryClient({
  members,
  currentUserId,
}: {
  members: DirectoryMember[];
  currentUserId: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => {
      const hay = [
        m.display_name,
        m.membership_tag,
        m.branch,
        m.home_region,
        m.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [members, q]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Member directory
        </h1>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, FW tag, branch, region…"
          className="mt-3 w-full rounded-xl border border-[var(--rule)] bg-white/90 px-4 py-2.5 text-sm outline-none focus:border-[var(--olive)]"
        />
      </header>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rule)] p-6 text-center text-sm text-[var(--ink-soft)]">
          {members.length === 0
            ? "No approved members in the directory yet."
            : "No members match your search."}
        </p>
      ) : null}

      <ul className="space-y-2">
        {filtered.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-3"
          >
            <Link href={`/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar url={m.avatar_url} name={m.display_name} size={48} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-[var(--charcoal)]">
                  {m.display_name}
                  <MembershipTag tag={m.membership_tag} />
                </p>
                <p className="text-xs text-[var(--ink-soft)]">
                  {roleLadderLabel(m.role, m.title)}
                  {m.branch ? ` · ${m.branch}` : ""}
                  {m.home_region ? ` · ${m.home_region}` : ""}
                </p>
              </div>
            </Link>
            {m.id !== currentUserId ? (
              <MessageMemberButton otherUserId={m.id} />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
