import { unwrapOne, type ChapterPost } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePost(post: any): ChapterPost {
  return {
    id: post.id,
    author_id: post.author_id,
    chapter: post.chapter,
    body: post.body,
    image_path: post.image_path,
    pinned: post.pinned ?? false,
    pinned_at: post.pinned_at ?? null,
    is_announcement: post.is_announcement ?? false,
    shared_from_post_id: post.shared_from_post_id ?? null,
    created_at: post.created_at,
    profiles: unwrapOne(post.profiles),
    chapter_post_reactions: (post.chapter_post_reactions || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({
        user_id: r.user_id,
        reaction: r.reaction || "like",
        profiles: unwrapOne(r.profiles),
      }),
    ),
    chapter_post_comments: (post.chapter_post_comments || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({
        id: c.id,
        post_id: c.post_id,
        author_id: c.author_id,
        body: c.body,
        created_at: c.created_at,
        profiles: unwrapOne(c.profiles),
      }))
      .sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
  };
}
