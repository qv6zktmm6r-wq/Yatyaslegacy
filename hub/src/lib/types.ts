export type MemberRole = "member" | "vip" | "president";

export type WelcomeSteps = {
  profile?: boolean;
  directory?: boolean;
  event?: boolean;
  card?: boolean;
};

export type Profile = {
  id: string;
  display_name: string;
  chapter: "MEMBER" | "PENDING";
  bio: string;
  branch: string;
  home_region: string;
  chat_quiet_hours: boolean;
  avatar_path: string | null;
  cover_path: string | null;
  role: MemberRole;
  title: string;
  membership_tag: string | null;
  digest_opt_in: boolean;
  welcome_completed: boolean;
  welcome_steps: WelcomeSteps;
  created_at: string;
  updated_at: string;
};

export type ProfileSnippet = Pick<
  Profile,
  | "display_name"
  | "avatar_path"
  | "branch"
  | "role"
  | "title"
  | "membership_tag"
  | "home_region"
>;

export function isVipRole(role?: string | null) {
  return role === "vip" || role === "president";
}

export function roleLadderLabel(role?: string | null, title?: string | null) {
  if (role === "president") return title || "President";
  if (role === "vip") return title || "Board / VIP";
  return title || "Member";
}

export type ReactionKind = "like" | "fire" | "clap";

export type ChapterPost = {
  id: string;
  author_id: string;
  chapter: string;
  body: string;
  image_path: string | null;
  pinned?: boolean;
  pinned_at?: string | null;
  is_announcement?: boolean;
  shared_from_post_id?: string | null;
  created_at: string;
  profiles?: ProfileSnippet | null;
  chapter_post_reactions?: {
    user_id: string;
    reaction?: ReactionKind | string;
    profiles?: ProfileSnippet | null;
  }[];
  chapter_post_comments?: PostComment[];
};

export type PostComment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: ProfileSnippet | null;
};

export type ChapterMessage = {
  id: string;
  author_id: string;
  chapter: string;
  body: string;
  created_at: string;
  profiles?: {
    display_name: string;
    avatar_path: string | null;
    membership_tag?: string | null;
  } | null;
};

export type RsvpStatus = "going" | "maybe" | "declined";

export type HubEvent = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  profiles?: ProfileSnippet | null;
};

export type HubEventRsvp = {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  updated_at: string;
};

export type HubNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
};

export type DmThread = {
  id: string;
  created_at: string;
  updated_at: string;
};

export type DmMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: ProfileSnippet | null;
};

export type HubAlbum = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  created_at: string;
  profiles?: ProfileSnippet | null;
};

export type HubAlbumPhoto = {
  id: string;
  album_id: string;
  uploaded_by: string;
  image_path: string;
  caption: string;
  created_at: string;
};

export type HubPoll = {
  id: string;
  created_by: string;
  question: string;
  closes_at: string | null;
  created_at: string;
  profiles?: ProfileSnippet | null;
};

export type HubPollOption = {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
};

export type HubPollVote = {
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};

export type PostReportStatus = "open" | "resolved" | "dismissed";

export type ChapterPostReport = {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  status: PostReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string;
  created_at: string;
  chapter_posts?: { body: string; author_id: string } | null;
  profiles?: ProfileSnippet | null;
};

export function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function formatGatorLine(
  reactions: { user_id: string; profiles?: ProfileSnippet | null }[] | undefined,
  currentUserId: string,
): string | null {
  const list = reactions || [];
  if (list.length === 0) return null;
  const names = list
    .map((r) => {
      if (r.user_id === currentUserId) return "You";
      return r.profiles?.display_name?.split(" ")[0] || "Member";
    })
    .filter(Boolean);
  if (names.length === 1) return `${names[0]} Gator’d this`;
  if (names.length === 2) return `${names[0]} and ${names[1]} Gator’d this`;
  return `${names[0]} and ${names.length - 1} others Gator’d this`;
}

export function sortFeedPosts(posts: ChapterPost[]): ChapterPost[] {
  return [...posts].sort((a, b) => {
    const ann = Number(!!b.is_announcement) - Number(!!a.is_announcement);
    if (ann !== 0) return ann;
    const pin = Number(!!b.pinned) - Number(!!a.pinned);
    if (pin !== 0) return pin;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
