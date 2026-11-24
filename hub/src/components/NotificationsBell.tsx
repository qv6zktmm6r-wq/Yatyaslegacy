"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { HubNotification } from "@/lib/types";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HubNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("hub_notifications")
      .select("id, user_id, actor_id, kind, title, body, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    setItems((data as HubNotification[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(id: string) {
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from("hub_notifications").update({ read_at: now }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
  }

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase
      .from("hub_notifications")
      .update({ read_at: now })
      .in("id", unreadIds);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded px-2 py-1.5 text-[var(--parchment)]/90 hover:bg-white/10"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <span className="text-base leading-none">🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--gold)] px-1 text-[10px] font-bold text-[var(--charcoal)]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,20rem)] rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.98)] py-2 shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--rule)] px-3 pb-2">
            <span className="text-sm font-semibold text-[var(--charcoal)]">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-[var(--olive-deep)] hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {loading ? (
              <li className="px-3 py-4 text-center text-xs text-[var(--ink-soft)]">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-[var(--ink-soft)]">
                You&apos;re all caught up.
              </li>
            ) : (
              items.map((n) => {
                const inner = (
                  <>
                    <p className="text-sm font-medium text-[var(--charcoal)]">{n.title}</p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--ink-soft)]">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-[var(--ink-soft)]">
                      {new Date(n.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </>
                );
                const cls = `block px-3 py-2 transition hover:bg-black/[0.04] ${
                  n.read_at ? "opacity-70" : "bg-[rgba(90,99,72,0.08)]"
                }`;
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        className={cls}
                        onClick={() => {
                          if (!n.read_at) void markRead(n.id);
                          setOpen(false);
                        }}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`w-full text-left ${cls}`}
                        onClick={() => {
                          if (!n.read_at) void markRead(n.id);
                        }}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
