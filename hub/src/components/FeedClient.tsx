"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/Composer";
import { HubMoreStrip } from "@/components/HubMoreStrip";
import { MemberBubbles, type BubbleMember } from "@/components/MemberBubbles";
import { PostCard } from "@/components/PostCard";
import { WelcomeChecklist } from "@/components/WelcomeChecklist";
import type { ChapterPost, WelcomeSteps } from "@/lib/types";

export function FeedClient({
  userId,
  displayName,
  avatarUrl,
  bubbles,
  initialPosts,
  imageUrls,
  avatarUrls,
  mutedIds,
  canModerate,
  welcomeCompleted,
  welcomeSteps,
  profileComplete,
}: {
  userId: string;
  displayName?: string | null;
  avatarUrl: string | null;
  bubbles: BubbleMember[];
  initialPosts: ChapterPost[];
  imageUrls: Record<string, string>;
  avatarUrls: Record<string, string>;
  mutedIds: string[];
  canModerate: boolean;
  welcomeCompleted: boolean;
  welcomeSteps: WelcomeSteps;
  profileComplete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pullHint, setPullHint] = useState(false);
  const muted = useMemo(() => new Set(mutedIds), [mutedIds]);

  const posts = useMemo(
    () => initialPosts.filter((p) => !muted.has(p.author_id) || p.author_id === userId),
    [initialPosts, muted, userId],
  );

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY <= 0 && e.touches[0]?.clientY) setPullHint(true);
  }
  function onTouchEnd() {
    if (pullHint) {
      setPullHint(false);
      refresh();
    }
  }

  return (
    <div
      className="mx-auto max-w-xl space-y-4"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {pullHint || pending ? (
        <p className="text-center text-xs text-[var(--ink-soft)]" role="status">
          {pending ? "Refreshing…" : "Release to refresh"}
        </p>
      ) : null}

      {!welcomeCompleted ? (
        <WelcomeChecklist
          userId={userId}
          welcomeCompleted={welcomeCompleted}
          welcomeSteps={welcomeSteps}
          profileComplete={profileComplete}
        />
      ) : null}

      <HubMoreStrip />

      <MemberBubbles members={bubbles} currentUserId={userId} />
      <p className="px-1 text-center text-xs text-[var(--ink-soft)]">
        Association Gear interest open —{" "}
        <a
          href="https://yatyasassociation.com/shop"
          className="font-medium text-[var(--olive-deep)] underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          browse the catalog
        </a>
        . Prices pending Board.
      </p>
      <Composer
        userId={userId}
        displayName={displayName}
        avatarUrl={avatarUrl}
        canAnnounce={canModerate}
        onPosted={refresh}
      />
      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rule)] bg-white/50 p-6 text-center text-sm text-[var(--ink-soft)]">
          No posts yet. Be the first Gator — share a photo or a word with the
          chapter.
        </p>
      ) : null}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          userId={userId}
          imageUrl={imageUrls[post.id] ?? null}
          avatarUrl={avatarUrls[post.author_id] ?? null}
          commentAvatarUrls={avatarUrls}
          canModerate={canModerate}
          muted={muted.has(post.author_id)}
        />
      ))}
    </div>
  );
}
