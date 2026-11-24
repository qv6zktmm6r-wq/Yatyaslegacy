"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { unwrapOne, type DmMessage, type ProfileSnippet } from "@/lib/types";

export type ThreadSummary = {
  id: string;
  updated_at: string;
  otherUser: ProfileSnippet & { id: string; avatar_url: string | null };
  preview: string | null;
};

export function MessagesClient({
  userId,
  initialThreads,
  initialThreadId,
  initialMessages,
  initialAvatarUrls,
}: {
  userId: string;
  initialThreads: ThreadSummary[];
  initialThreadId: string | null;
  initialMessages: DmMessage[];
  initialAvatarUrls: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadParam = searchParams.get("thread");
  const activeId = threadParam || initialThreadId;

  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarUrls] = useState(initialAvatarUrls);

  const activeThread = useMemo(
    () => initialThreads.find((t) => t.id === activeId) ?? null,
    [initialThreads, activeId],
  );

  const loadMessages = useCallback(
    async (threadId: string) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("dm_messages")
        .select(
          "id, thread_id, author_id, body, created_at, profiles!author_id(display_name, avatar_path, membership_tag)",
        )
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages(
        (data || []).map((m) => ({
          ...m,
          profiles: unwrapOne(m.profiles),
        })) as DmMessage[],
      );
    },
    [],
  );

  useEffect(() => {
    if (threadParam && threadParam !== initialThreadId) {
      void loadMessages(threadParam);
    } else {
      setMessages(initialMessages);
    }
  }, [threadParam, initialThreadId, initialMessages, loadMessages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !activeId) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("dm_messages").insert({
      thread_id: activeId,
      author_id: userId,
      body: text,
    });
    setBusy(false);
    if (error) return;
    setBody("");
    await loadMessages(activeId);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 sm:flex-row sm:items-stretch">
      <aside className="w-full shrink-0 sm:w-40 sm:max-w-[42%]">
        <h1 className="mb-2 font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
          Messages
        </h1>
        {initialThreads.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">
            No conversations yet — start one from a member profile.
          </p>
        ) : (
          <ul className="space-y-1">
            {initialThreads.map((t) => {
              const active = t.id === activeId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/messages?thread=${t.id}`)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                      active ? "bg-[var(--olive-deep)] text-[var(--parchment)]" : "hover:bg-black/[0.04]"
                    }`}
                  >
                    <Avatar url={t.otherUser.avatar_url} name={t.otherUser.display_name} size={32} />
                    <span className="min-w-0 flex-1 truncate font-medium">{t.otherUser.display_name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="flex min-h-[20rem] flex-1 flex-col rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)]">
        {!activeId || !activeThread ? (
          <p className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--ink-soft)]">
            Select a conversation
          </p>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-[var(--rule)] px-4 py-3">
              <Avatar
                url={activeThread.otherUser.avatar_url}
                name={activeThread.otherUser.display_name}
                size={36}
              />
              <p className="font-semibold text-[var(--charcoal)]">{activeThread.otherUser.display_name}</p>
            </header>
            <ul className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.map((m) => {
                const mine = m.author_id === userId;
                return (
                  <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <ChatBubble
                      mine={mine}
                      url={avatarUrls[m.author_id]}
                      name={m.profiles?.display_name}
                    >
                      <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                      <p className="mt-1 text-[10px] opacity-70">
                        {new Date(m.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </ChatBubble>
                  </li>
                );
              })}
            </ul>
            <form onSubmit={send} className="flex gap-2 border-t border-[var(--rule)] p-3">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                placeholder="Write a message…"
                className="min-w-0 flex-1 rounded-full border border-[var(--rule)] bg-white/90 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !body.trim()}
                className="rounded-full bg-[var(--olive-deep)] px-4 py-2 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function ChatBubble({
  mine,
  url,
  name,
  children,
}: {
  mine: boolean;
  url?: string;
  name?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`max-w-[85%] rounded-xl px-3 py-2 ${
        mine ? "bg-[var(--olive-deep)] text-[var(--parchment)]" : "bg-white/90 text-[var(--ink)]"
      }`}
    >
      {!mine && url ? (
        <div className="mb-1 flex items-center gap-1">
          <Avatar url={url} name={name} size={20} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
