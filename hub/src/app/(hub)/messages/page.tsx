import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MessagesClient, type ThreadSummary } from "@/components/MessagesClient";
import { createClient } from "@/lib/supabase/server";
import { unwrapOne, type DmMessage } from "@/lib/types";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread: threadParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("dm_thread_members")
    .select("thread_id")
    .eq("user_id", user.id);

  const threadIds = (memberships || []).map((m) => m.thread_id);
  const threads: ThreadSummary[] = [];

  if (threadIds.length > 0) {
    const { data: threadRows } = await supabase
      .from("dm_threads")
      .select("id, updated_at")
      .in("id", threadIds)
      .order("updated_at", { ascending: false });

    for (const t of threadRows || []) {
      const { data: members } = await supabase
        .from("dm_thread_members")
        .select("user_id, profiles!user_id(id, display_name, avatar_path, membership_tag, branch, role, title, home_region)")
        .eq("thread_id", t.id);

      const other = (members || []).find((m) => m.user_id !== user.id);
      if (!other) continue;
      const prof = unwrapOne(other.profiles) as {
        id: string;
        display_name: string;
        avatar_path: string | null;
        membership_tag: string | null;
        branch: string;
        role: string;
        title: string;
        home_region: string;
      };

      let avatar_url: string | null = null;
      if (prof.avatar_path) {
        const { data } = await supabase.storage
          .from("avatars")
          .createSignedUrl(prof.avatar_path, 3600);
        avatar_url = data?.signedUrl ?? null;
      }

      const { data: lastMsg } = await supabase
        .from("dm_messages")
        .select("body")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      threads.push({
        id: t.id,
        updated_at: t.updated_at,
        otherUser: {
          id: prof.id || other.user_id,
          display_name: prof.display_name,
          avatar_path: prof.avatar_path,
          membership_tag: prof.membership_tag,
          branch: prof.branch,
          role: prof.role as "member" | "vip" | "president",
          title: prof.title,
          home_region: prof.home_region,
          avatar_url,
        },
        preview: lastMsg?.body ?? null,
      });
    }
  }

  const initialThreadId =
    threadParam && threadIds.includes(threadParam)
      ? threadParam
      : threads[0]?.id ?? null;

  let initialMessages: DmMessage[] = [];
  const avatarUrls: Record<string, string> = {};

  if (initialThreadId) {
    const { data: msgs } = await supabase
      .from("dm_messages")
      .select(
        "id, thread_id, author_id, body, created_at, profiles!author_id(display_name, avatar_path, membership_tag)",
      )
      .eq("thread_id", initialThreadId)
      .order("created_at", { ascending: true })
      .limit(100);

    initialMessages = (msgs || []).map((m) => ({
      ...m,
      profiles: unwrapOne(m.profiles),
    })) as DmMessage[];

    for (const m of initialMessages) {
      const path = m.profiles?.avatar_path;
      if (path && !avatarUrls[m.author_id]) {
        const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
        if (data?.signedUrl) avatarUrls[m.author_id] = data.signedUrl;
      }
    }
  }

  for (const t of threads) {
    if (t.otherUser.avatar_url) {
      avatarUrls[t.otherUser.id] = t.otherUser.avatar_url;
    }
  }

  return (
    <Suspense
      fallback={<p className="text-sm text-[var(--ink-soft)]">Loading messages…</p>}
    >
      <MessagesClient
        userId={user.id}
        initialThreads={threads}
        initialThreadId={initialThreadId}
        initialMessages={initialMessages}
        initialAvatarUrls={avatarUrls}
      />
    </Suspense>
  );
}
