import { redirect } from "next/navigation";
import { ProfilePageClient } from "@/components/ProfilePageClient";
import { createClient } from "@/lib/supabase/server";
import { normalizePost } from "@/lib/normalizePost";
import { POST_SELECT } from "@/lib/posts";
import type { Profile } from "@/lib/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const fallbackName =
      (user.user_metadata?.display_name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "Member";
    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: fallbackName,
      chapter: "PENDING",
    });
    const again = await supabase.from("profiles").select("*").eq("id", user.id).single();
    profile = again.data;
  }

  if (!profile) {
    return (
      <p className="text-sm text-red-800" role="alert">
        Could not load your profile. Database may still be provisioning.
      </p>
    );
  }

  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  let coverUrl: string | null = null;
  if (profile.cover_path) {
    const { data } = await supabase.storage
      .from("covers")
      .createSignedUrl(profile.cover_path, 3600);
    coverUrl = data?.signedUrl ?? null;
  }

  const { data: postRows } = await supabase
    .from("chapter_posts")
    .select(POST_SELECT)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const posts = (postRows || []).map(normalizePost);

  const imageUrls: Record<string, string> = {};
  const avatarUrls: Record<string, string> = {};
  if (avatarUrl) avatarUrls[user.id] = avatarUrl;
  for (const post of posts) {
    if (post.image_path) {
      const { data } = await supabase.storage
        .from("post-images")
        .createSignedUrl(post.image_path, 3600);
      if (data?.signedUrl) imageUrls[post.id] = data.signedUrl;
    }
    for (const c of post.chapter_post_comments || []) {
      const path = c.profiles?.avatar_path;
      if (path && !avatarUrls[c.author_id]) {
        const { data } = await supabase.storage
          .from("avatars")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) avatarUrls[c.author_id] = data.signedUrl;
      }
    }
  }

  const typedProfile: Profile = {
    ...(profile as Profile),
    digest_opt_in: (profile as Profile).digest_opt_in ?? true,
    welcome_completed: (profile as Profile).welcome_completed ?? false,
    welcome_steps: (profile as Profile).welcome_steps ?? {},
  };

  return (
    <ProfilePageClient
      profile={typedProfile}
      avatarUrl={avatarUrl}
      coverUrl={coverUrl}
      posts={posts}
      imageUrls={imageUrls}
      avatarUrls={avatarUrls}
    />
  );
}
