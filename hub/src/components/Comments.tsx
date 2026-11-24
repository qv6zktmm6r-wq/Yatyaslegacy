"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { MembershipTag } from "@/components/MembershipTag";
import type { PostComment } from "@/lib/types";

export function Comments({
  postId,
  postAuthorId,
  userId,
  comments,
  avatarUrls,
  canModerate = false,
}: {
  postId: string;
  postAuthorId: string;
  userId: string;
  comments: PostComment[];
  avatarUrls: Record<string, string>;
  canModerate?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(comments.length > 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("chapter_post_comments")
      .insert({
        post_id: postId,
        author_id: userId,
        body: text,
      });
    if (insertError) {
      setBusy(false);
      setError(insertError.message);
      return;
    }

    const link = "/feed";
    await supabase.rpc("notify_mentions", {
      p_text: text,
      p_actor: userId,
      p_kind: "mention",
      p_title: "You were mentioned in a comment",
      p_link: link,
    });
    if (postAuthorId && postAuthorId !== userId) {
      await supabase.rpc("notify_member", {
        p_user: postAuthorId,
        p_actor: userId,
        p_kind: "comment",
        p_title: "New comment on your post",
        p_body: text.slice(0, 200),
        p_link: link,
      });
    }

    setBusy(false);
    setBody("");
    setOpen(true);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("chapter_post_comments").delete().eq("id", id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="border-t border-[var(--rule)] bg-black/[0.02] px-4 py-3">
      <button
        type="button"
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]"
        onClick={() => setOpen((v) => !v)}
      >
        {comments.length === 0
          ? "Comments"
          : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
      </button>

      {open ? (
        <ul className="space-y-3">
          {comments.map((c) => {
            const mine = c.author_id === userId;
            return (
              <li key={c.id} className="flex gap-2">
                <Avatar
                  url={avatarUrls[c.author_id] ?? null}
                  name={c.profiles?.display_name}
                  size={28}
                />
                <div className="min-w-0 flex-1 rounded-lg bg-white/70 px-2.5 py-1.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--charcoal)]">
                    {c.profiles?.display_name || "Member"}
                    <MembershipTag tag={c.profiles?.membership_tag} />
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                    {c.body}
                  </p>
                  {(mine || canModerate) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(c.id)}
                      className="mt-1 text-[11px] text-[var(--ink-soft)] hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Write a comment…"
          className="min-w-0 flex-1 rounded-full border border-[var(--rule)] bg-white/90 px-3 py-1.5 text-sm outline-none focus:border-[var(--olive)]"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded-full bg-[var(--olive-deep)] px-3 py-1.5 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
        >
          Post
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-xs text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
