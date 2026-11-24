"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { MembershipTag } from "@/components/MembershipTag";

export type BubbleMember = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role?: string | null;
  title?: string | null;
  membership_tag?: string | null;
  last_post_at?: string | null;
};

function rank(member: BubbleMember, currentUserId: string) {
  if (member.id === currentUserId) return 0;
  if (member.role === "president") return 1;
  if (member.role === "vip") return 2;
  if (member.last_post_at) {
    const age = Date.now() - new Date(member.last_post_at).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) return 3;
  }
  return 4;
}

export function MemberBubbles({
  members,
  currentUserId,
}: {
  members: BubbleMember[];
  currentUserId: string;
}) {
  const ordered = [...members].sort((a, b) => {
    const ra = rank(a, currentUserId);
    const rb = rank(b, currentUserId);
    if (ra !== rb) return ra - rb;
    return a.display_name.localeCompare(b.display_name);
  });

  if (ordered.length === 0) return null;

  return (
    <section
      aria-label="Chapter members"
      className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] px-2 py-3 shadow-[0_1px_2px_rgba(42,38,32,0.06)]"
    >
      <div className="flex gap-3 overflow-x-auto px-2 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ordered.map((member) => {
          const mine = member.id === currentUserId;
          const vip = member.role === "president" || member.role === "vip";
          const recent =
            !!member.last_post_at &&
            Date.now() - new Date(member.last_post_at).getTime() <
              7 * 24 * 60 * 60 * 1000;
          const href = mine ? "/profile" : `/members/${member.id}`;
          const label = mine
            ? "Your story"
            : member.display_name.split(" ")[0] || "Member";

          return (
            <Link
              key={member.id}
              href={href}
              className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center"
            >
              <div
                className={`rounded-full p-[2px] ${
                  vip
                    ? "bg-gradient-to-tr from-[var(--gold)] via-[var(--olive)] to-[var(--gold-soft)]"
                    : recent
                      ? "bg-gradient-to-tr from-[var(--olive-deep)] to-[var(--gold-soft)] shadow-[0_0_0_1px_rgba(176,141,62,0.35)]"
                      : "bg-gradient-to-tr from-[var(--olive-deep)] to-[var(--olive)]"
                }`}
              >
                <div className="rounded-full bg-[rgba(255,252,245,0.96)] p-[2px]">
                  <Avatar
                    url={member.avatar_url}
                    name={member.display_name}
                    size={56}
                  />
                </div>
              </div>
              <span className="w-full truncate text-[11px] font-medium text-[var(--charcoal)]">
                {label}
              </span>
              {member.membership_tag ? (
                <MembershipTag tag={member.membership_tag} />
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
