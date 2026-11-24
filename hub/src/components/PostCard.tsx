"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChapterPost, ReactionKind } from "@/lib/types";
import { formatGatorLine, roleLadderLabel, unwrapOne } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Comments } from "@/components/Comments";
import { MembershipTag } from "@/components/MembershipTag";

export function PostCard({
  post,
  userId,
  imageUrl,
  avatarUrl,
  commentAvatarUrls = {},
  canModerate = false,
  muted = false,
}: {
  post: ChapterPost;
  userId: string;
  imageUrl: string | null;
  avatarUrl?: string | null;
  commentAvatarUrls?: Record<string, string>;
  canModerate?: boolean;
  muted?: boolean;
}) {
  const router = useRouter();
  const reactions = post.chapter_post_reactions || [];
  const gators = reactions.filter((r) => (r.reaction || "like") === "like");
  const fires = reactions.filter((r) => r.reaction === "fire");
  const claps = reactions.filter((r) => r.reaction === "clap");
  const liked = gators.some((r) => r.user_id === userId);
  const fired = fires.some((r) => r.user_id === userId);
  const clapped = claps.some((r) => r.user_id === userId);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(
    (post.chapter_post_comments?.length ?? 0) > 0,
  );
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mine = post.author_id === userId;
  const comments = (post.chapter_post_comments || []).map((c) => ({
    ...c,
    profiles: unwrapOne(c.profiles),
  }));
  const gatorLine = formatGatorLine(
    gators.map((r) => ({
      ...r,
      profiles: unwrapOne(r.profiles),
    })),
    userId,
  );

  async function toggleReaction(kind: ReactionKind) {
    setBusy(true);
    const supabase = createClient();
    const active =
      kind === "like" ? liked : kind === "fire" ? fired : clapped;
    if (active) {
      await supabase
        .from("chapter_post_reactions")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", userId)
        .eq("reaction", kind);
    } else {
      await supabase.from("chapter_post_reactions").insert({
        post_id: post.id,
        user_id: userId,
        reaction: kind,
      });
    }
    setBusy(false);
    router.refresh();
  }

  function startGatorPress() {
    longPressTimer.current = setTimeout(() => {
      if (liked) void toggleReaction("like");
    }, 450);
  }
  function endGatorPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  async function removePost() {
    if (!mine && !canModerate) return;
    if (!window.confirm("Remove this post?")) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("chapter_posts").delete().eq("id", post.id);
    setBusy(false);
    setMenuOpen(false);
    router.refresh();
  }

  async function togglePin() {
    if (!canModerate) return;
    setBusy(true);
    const supabase = createClient();
    const next = !post.pinned;
    await supabase
      .from("chapter_posts")
      .update({
        pinned: next,
        pinned_at: next ? new Date().toISOString() : null,
      })
      .eq("id", post.id);
    setBusy(false);
    setMenuOpen(false);
    router.refresh();
  }

  async function shareToFeed() {
    setBusy(true);
    const supabase = createClient();
    const who = post.profiles?.display_name || "a member";
    const { error } = await supabase.from("chapter_posts").insert({
      author_id: userId,
      chapter: "HUB",
      body: `Shared from ${who}:\n\n${post.body}`,
      shared_from_post_id: post.id,
      image_path: null,
    });
    setBusy(false);
    setMenuOpen(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  async function muteAuthor() {
    if (mine) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("member_mutes").insert({
      muter_id: userId,
      muted_id: post.author_id,
    });
    setBusy(false);
    setMenuOpen(false);
    if (error && !error.message.includes("duplicate")) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  async function unmuteAuthor() {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("member_mutes")
      .delete()
      .eq("muter_id", userId)
      .eq("muted_id", post.author_id);
    setBusy(false);
    setMenuOpen(false);
    router.refresh();
  }

  async function reportPost() {
    const reason = window.prompt("Why are you reporting this post? (optional)") ?? "";
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("chapter_post_reports").insert({
      post_id: post.id,
      reporter_id: userId,
      reason: reason.slice(0, 500),
    });
    setBusy(false);
    setMenuOpen(false);
    if (error) {
      window.alert(error.message.includes("duplicate") ? "Already reported." : error.message);
      return;
    }
    window.alert("Reported. Leadership will review.");
  }

  const when = new Date(post.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const vip =
    post.profiles?.role === "president" || post.profiles?.role === "vip";

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-[rgba(255,252,245,0.96)] shadow-[0_1px_2px_rgba(42,38,32,0.06)] ${
        post.is_announcement || post.pinned
          ? "border-[var(--gold)]/60 ring-1 ring-[var(--gold)]/30"
          : "border-[var(--rule)]"
      }`}
    >
      {post.is_announcement ? (
        <p className="bg-[rgba(176,141,62,0.18)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--olive-deep)]">
          Board announcement
        </p>
      ) : null}
      {post.pinned ? (
        <p className="bg-[rgba(176,141,62,0.12)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--olive-deep)]">
          Pinned
        </p>
      ) : null}
      {post.shared_from_post_id ? (
        <p className="bg-black/[0.03] px-4 py-1.5 text-[11px] font-medium text-[var(--ink-soft)]">
          Shared in Member Hub
        </p>
      ) : null}

      <header className="flex items-start gap-3 px-4 pt-4">
        <Link href={mine ? "/profile" : `/members/${post.author_id}`}>
          <Avatar
            url={avatarUrl}
            name={post.profiles?.display_name}
            size={44}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold text-[var(--charcoal)]">
            <Link
              href={mine ? "/profile" : `/members/${post.author_id}`}
              className="hover:underline"
            >
              {post.profiles?.display_name || "Member"}
            </Link>
            <MembershipTag tag={post.profiles?.membership_tag} />
            {vip ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gold)]">
                {roleLadderLabel(post.profiles?.role, post.profiles?.title)}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-[var(--ink-soft)]">
            {post.profiles?.branch ? `${post.profiles.branch} · ` : null}
            {post.profiles?.home_region ? `${post.profiles.home_region} · ` : null}
            <time dateTime={post.created_at}>{when}</time>
            {" · Member Hub"}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={busy}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded px-2 py-1 text-xs text-[var(--ink-soft)] hover:bg-black/5"
            aria-label="Post options"
          >
            ···
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--rule)] bg-[rgba(255,252,245,0.98)] shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
                onClick={() => void shareToFeed()}
              >
                Share to feed
              </button>
              {canModerate ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
                  onClick={() => void togglePin()}
                >
                  {post.pinned ? "Unpin" : "Pin to feed"}
                </button>
              ) : null}
              {!mine ? (
                <>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
                    onClick={() => void (muted ? unmuteAuthor() : muteAuthor())}
                  >
                    {muted ? "Unmute member" : "Mute member"}
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
                    onClick={() => void reportPost()}
                  >
                    Report
                  </button>
                </>
              ) : null}
              {(mine || canModerate) && (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-red-800 hover:bg-black/[0.04]"
                  onClick={() => void removePost()}
                >
                  Remove
                </button>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <div className="px-4 pb-3 pt-3">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">
          {post.body}
        </p>
      </div>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="max-h-[520px] w-full object-cover"
        />
      ) : null}

      {gators.length > 0 || fires.length > 0 || claps.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm text-[var(--ink-soft)]">
          {gators.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--olive-deep)] text-[12px] leading-none"
                aria-hidden
              >
                🐊
              </span>
              {gatorLine || gators.length}
            </span>
          ) : null}
          {fires.length > 0 ? <span>🔥 {fires.length}</span> : null}
          {claps.length > 0 ? <span>👏 {claps.length}</span> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-4 border-t border-[var(--rule)] text-sm font-medium text-[var(--ink-soft)]">
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleReaction("like")}
          onPointerDown={startGatorPress}
          onPointerUp={endGatorPress}
          onPointerLeave={endGatorPress}
          aria-label={liked ? "Remove Gator reaction" : "Gator this post"}
          title={liked ? "Tap or long-press to remove" : "Gator"}
          className={`px-2 py-2.5 transition hover:bg-black/[0.04] ${
            liked ? "text-[var(--olive-deep)]" : ""
          }`}
        >
          {liked ? "🐊 Gator’d" : "🐊 Gator"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleReaction("fire")}
          aria-label={fired ? "Remove fire reaction" : "Fire reaction"}
          className={`px-2 py-2.5 transition hover:bg-black/[0.04] ${
            fired ? "text-[var(--olive-deep)]" : ""
          }`}
        >
          🔥
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleReaction("clap")}
          aria-label={clapped ? "Remove clap reaction" : "Clap reaction"}
          className={`px-2 py-2.5 transition hover:bg-black/[0.04] ${
            clapped ? "text-[var(--olive-deep)]" : ""
          }`}
        >
          👏
        </button>
        <button
          type="button"
          className="px-2 py-2.5 transition hover:bg-black/[0.04]"
          onClick={() => setShowComments(true)}
        >
          Comment{comments.length ? ` (${comments.length})` : ""}
        </button>
      </div>

      {showComments ? (
        <Comments
          postId={post.id}
          postAuthorId={post.author_id}
          userId={userId}
          comments={comments}
          avatarUrls={commentAvatarUrls}
          canModerate={canModerate}
        />
      ) : null}
    </article>
  );
}
