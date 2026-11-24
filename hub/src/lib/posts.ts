/** Explicit FK embeds — avoids PostgREST ambiguous relationship errors. */
export const POST_SELECT = [
  "id",
  "author_id",
  "chapter",
  "body",
  "image_path",
  "pinned",
  "pinned_at",
  "is_announcement",
  "shared_from_post_id",
  "created_at",
  "profiles!author_id(display_name, avatar_path, branch, role, title, membership_tag, home_region)",
  "chapter_post_reactions(user_id, reaction, profiles!user_id(display_name, membership_tag))",
  "chapter_post_comments(id, post_id, author_id, body, created_at, profiles!author_id(display_name, avatar_path, membership_tag))",
].join(", ");
