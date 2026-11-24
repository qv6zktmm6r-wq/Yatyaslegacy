import { redirect } from "next/navigation";
import { FeedClient } from "@/components/FeedClient";
import type { BubbleMember } from "@/components/MemberBubbles";
import { createClient } from "@/lib/supabase/server";
import { normalizePost } from "@/lib/normalizePost";
import { POST_SELECT } from "@/lib/posts";
import { isVipRole, sortFeedPosts, type WelcomeSteps } from "@/lib/types";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select(
      "display_name, avatar_path, role, membership_tag, bio, branch, welcome_completed, welcome_steps",
    )
    .eq("id", user.id)
    .maybeSingle();

  let myAvatar: string | null = null;
  if (me?.avatar_path) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(me.avatar_path, 3600);
    myAvatar = data?.signedUrl ?? null;
  }

  const { data: mutedRows } = await supabase
    .from("member_mutes")
    .select("muted_id")
    .eq("muter_id", user.id);
  const mutedIds = (mutedRows || []).map((r) => r.muted_id);

  const { data: memberRows } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path, role, title, membership_tag")
    .eq("chapter", "MEMBER")
    .order("display_name", { ascending: true })
    .limit(40);

  const { data: recentPosts } = await supabase
    .from("chapter_posts")
    .select("author_id, created_at")
    .eq("chapter", "HUB")
    .order("created_at", { ascending: false })
    .limit(200);

  const lastPostByAuthor = new Map<string, string>();
  for (const row of recentPosts || []) {
    if (!lastPostByAuthor.has(row.author_id)) {
      lastPostByAuthor.set(row.author_id, row.created_at);
    }
  }

  const bubbles: BubbleMember[] = [];
  for (const row of memberRows || []) {
    if (mutedIds.includes(row.id) && row.id !== user.id) continue;
    let avatar_url: string | null = null;
    if (row.avatar_path) {
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(row.avatar_path, 3600);
      avatar_url = data?.signedUrl ?? null;
    }
    bubbles.push({
      id: row.id,
      display_name: row.display_name,
      avatar_url,
      role: row.role,
      title: row.title,
      membership_tag: row.membership_tag,
      last_post_at: lastPostByAuthor.get(row.id) ?? null,
    });
  }

  const { data: posts, error } = await supabase
    .from("chapter_posts")
    .select(POST_SELECT)
    .eq("chapter", "HUB")
    .order("created_at", { ascending: false })
    .limit(60);

  const typed = sortFeedPosts((posts || []).map(normalizePost)).slice(0, 40);

  const urls: Record<string, string> = {};
  const avatars: Record<string, string> = {};
  for (const post of typed) {
    if (post.image_path) {
      const { data } = await supabase.storage
        .from("post-images")
        .createSignedUrl(post.image_path, 3600);
      if (data?.signedUrl) urls[post.id] = data.signedUrl;
    }
    const path = post.profiles?.avatar_path;
    if (path && !avatars[post.author_id]) {
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) avatars[post.author_id] = data.signedUrl;
    }
    for (const c of post.chapter_post_comments || []) {
      const cPath = c.profiles?.avatar_path;
      if (cPath && !avatars[c.author_id]) {
        const { data } = await supabase.storage
          .from("avatars")
          .createSignedUrl(cPath, 3600);
        if (data?.signedUrl) avatars[c.author_id] = data.signedUrl;
      }
    }
  }

  return (
    <>
      {error ? (
        <p
          className="mx-auto mb-4 max-w-xl rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          Could not load posts: {error.message}
        </p>
      ) : null}
      <FeedClient
        userId={user.id}
        displayName={me?.display_name}
        avatarUrl={myAvatar}
        bubbles={bubbles}
        initialPosts={typed}
        imageUrls={urls}
        avatarUrls={avatars}
        mutedIds={mutedIds}
        canModerate={isVipRole(me?.role)}
        welcomeCompleted={Boolean(me?.welcome_completed)}
        welcomeSteps={(me?.welcome_steps as WelcomeSteps) || {}}
        profileComplete={Boolean(
          me?.display_name?.trim() && (me?.bio?.trim() || me?.branch?.trim()),
        )}
      />
    </>
  );
}
