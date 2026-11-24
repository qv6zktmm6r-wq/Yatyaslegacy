"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChapterMessage } from "@/lib/types";

export function ChatRoom({
  userId,
  initialMessages,
}: {
  userId: string;
  initialMessages: ChapterMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("ca-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chapter_messages",
          filter: "chapter=eq.HUB",
        },
        async (payload) => {
          const row = payload.new as ChapterMessage;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_path")
            .eq("id", row.author_id)
            .maybeSingle();
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { ...row, profiles: profile }];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("chapter_messages").insert({
      author_id: userId,
      chapter: "HUB",
      body: text,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBody("");
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-[var(--rule)] bg-[rgba(255,252,245,0.92)]">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-[var(--ink-soft)]">
            Chapter chat is quiet. Say hello.
          </p>
        ) : null}
        {messages.map((msg) => {
          const mine = msg.author_id === userId;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
            >
              <p className="mb-0.5 text-xs text-[var(--ink-soft)]">
                {msg.profiles?.display_name || "Member"}
              </p>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-[var(--olive-deep)] text-[var(--parchment)]"
                    : "bg-black/5 text-[var(--ink)]"
                }`}
              >
                {msg.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-[var(--rule)] p-3"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Message the chapter…"
          className="flex-1 rounded border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--olive)]"
        />
        <button
          type="submit"
          disabled={!body.trim()}
          className="rounded bg-[var(--olive-deep)] px-4 py-2 text-sm font-medium text-[var(--parchment)] disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error ? (
        <p className="px-3 pb-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
