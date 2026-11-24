import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { MembershipTag } from "@/components/MembershipTag";
import { PostCard } from "@/components/PostCard";
import { createClient } from "@/lib/supabase/server";
import { normalizePost } from "@/lib/normalizePost";
import { POST_SELECT } from "@/lib/posts";
import { MessageMemberButton } from "@/components/MessageMemberButton";
import { isVipRole, type Profile } from "@/lib/types";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (id === user.id) redirect("/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const typed = profile as Profile;
  let avatarUrl: string | null = null;
  if (typed.avatar_path) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(typed.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  let coverUrl: string | null = null;
  if (typed.cover_path) {
    const { data } = await supabase.storage
      .from("covers")
      .createSignedUrl(typed.cover_path, 3600);
    coverUrl = data?.signedUrl ?? null;
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: postRows } = await supabase
    .from("chapter_posts")
    .select(POST_SELECT)
    .eq("author_id", id)
    .order("created_at", { ascending: false })
    .limit(30);

  const posts = (postRows || []).map(normalizePost);

  const imageUrls: Record<string, string> = {};
  const commentAvatars: Record<string, string> = {};
  if (avatarUrl) commentAvatars[typed.id] = avatarUrl;
  for (const post of posts) {
    if (post.image_path) {
      const { data } = await supabase.storage
        .from("post-images")
        .createSignedUrl(post.image_path, 3600);
      if (data?.signedUrl) imageUrls[post.id] = data.signedUrl;
    }
    for (const c of post.chapter_post_comments || []) {
      const path = c.profiles?.avatar_path;
      if (path && !commentAvatars[c.author_id]) {
        const { data } = await supabase.storage
          .from("avatars")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) commentAvatars[c.author_id] = data.signedUrl;
      }
    }
  }

  const vip = typed.role === "president" || typed.role === "vip";

  return (
    <div className="space-y-4">
      <Link href="/feed" className="text-sm text-[var(--olive-deep)] hover:underline">
        ← Back to feed
      </Link>

      <section className="overflow-hidden rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] shadow-[0_1px_2px_rgba(42,38,32,0.06)]">
        <div className="relative h-36">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(135deg, #3f4633 0%, #5a6348 45%, #b08d3e 100%)",
              }}
            />
          )}
        </div>
        <div className="relative px-4 pb-4">
          <div className="-mt-12 inline-block rounded-full bg-[rgba(255,252,245,0.96)] p-1 shadow">
            <Avatar url={avatarUrl} name={typed.display_name} size={112} />
          </div>
          <h1 className="mt-3 flex flex-wrap items-center gap-2 font-[family-name:var(--font-display-face)] text-3xl text-[var(--charcoal)]">
            {typed.display_name}
            <MembershipTag tag={typed.membership_tag} size="md" />
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {vip ? (
              <span className="mr-2 font-semibold text-[var(--gold)]">
                {typed.title || "VIP"}
              </span>
            ) : null}
            YAT-YAS Member
            {typed.home_region ? ` · ${typed.home_region}` : null}
            {typed.branch ? ` · ${typed.branch}` : null}
          </p>
          {typed.bio ? (
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">
              {typed.bio}
            </p>
          ) : null}
          {typed.chapter === "MEMBER" ? (
            <div className="mt-4">
              <MessageMemberButton otherUserId={typed.id} />
            </div>
          ) : null}
        </div>
      </section>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--charcoal)]">Posts</h2>
        {posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--rule)] bg-white/50 p-6 text-center text-sm text-[var(--ink-soft)]">
            No posts from this member yet.
          </p>
        ) : null}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            userId={user.id}
            imageUrl={imageUrls[post.id] ?? null}
            avatarUrl={avatarUrl}
            commentAvatarUrls={commentAvatars}
            canModerate={isVipRole(me?.role)}
          />
        ))}
      </div>
    </div>
  );
}
