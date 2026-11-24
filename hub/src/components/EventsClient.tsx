"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HubEvent, HubEventRsvp, RsvpStatus } from "@/lib/types";

type EventWithCounts = HubEvent & {
  myRsvp: RsvpStatus | null;
  counts: { going: number; maybe: number; declined: number };
};

export function EventsClient({
  userId,
  initialEvents,
  initialRsvps,
}: {
  userId: string;
  initialEvents: HubEvent[];
  initialRsvps: HubEventRsvp[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = Date.now();

  const events: EventWithCounts[] = useMemo(() => {
    return initialEvents.map((ev) => {
      const related = initialRsvps.filter((r) => r.event_id === ev.id);
      const mine = related.find((r) => r.user_id === userId);
      const counts = { going: 0, maybe: 0, declined: 0 };
      for (const r of related) {
        counts[r.status]++;
      }
      return { ...ev, myRsvp: mine?.status ?? null, counts };
    });
  }, [initialEvents, initialRsvps, userId]);

  const filtered = events.filter((ev) => {
    const t = new Date(ev.starts_at).getTime();
    return tab === "upcoming" ? t >= now - 3600000 : t < now - 3600000;
  });

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("hub_events").insert({
      created_by: userId,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      starts_at: new Date(startsAt).toISOString(),
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle("");
    setDescription("");
    setLocation("");
    setStartsAt("");
    setShowForm(false);
    router.refresh();
  }

  async function rsvp(eventId: string, status: RsvpStatus) {
    setBusy(true);
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("hub_event_rsvps")
      .select("event_id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("hub_event_rsvps")
        .update({ status })
        .eq("event_id", eventId)
        .eq("user_id", userId);
    } else {
      await supabase.from("hub_event_rsvps").insert({
        event_id: eventId,
        user_id: userId,
        status,
      });
    }
    setBusy(false);
    router.refresh();
  }

  const rsvpBtns: { status: RsvpStatus; label: string }[] = [
    { status: "going", label: "Going" },
    { status: "maybe", label: "Maybe" },
    { status: "declined", label: "Can't go" },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
            Events
          </h1>
          <div className="mt-2 flex gap-2">
            {(["upcoming", "past"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  tab === t
                    ? "bg-[var(--olive-deep)] text-[var(--parchment)]"
                    : "bg-black/[0.06] text-[var(--charcoal)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-[var(--olive-deep)] px-3 py-2 text-sm font-semibold text-[var(--parchment)]"
        >
          {showForm ? "Close" : "New event"}
        </button>
      </header>

      {showForm ? (
        <form
          onSubmit={createEvent}
          className="space-y-3 rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4"
        >
          <h2 className="text-base font-semibold text-[var(--charcoal)]">New event</h2>
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-[var(--rule)] bg-white/90 px-3 py-2 text-sm"
          />
          <textarea
            rows={3}
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-[var(--rule)] bg-white/90 px-3 py-2 text-sm"
          />
          <input
            maxLength={200}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="w-full rounded-lg border border-[var(--rule)] bg-white/90 px-3 py-2 text-sm"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--ink-soft)]">Starts</span>
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-lg border border-[var(--rule)] bg-white/90 px-3 py-2"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--olive-deep)] px-4 py-2 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create event"}
          </button>
        </form>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rule)] bg-white/50 p-6 text-center text-sm text-[var(--ink-soft)]">
          No {tab} events yet.
        </p>
      ) : null}

      {filtered.map((ev) => (
        <article
          key={ev.id}
          className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4 shadow-sm"
        >
          <h3 className="font-[family-name:var(--font-display-face)] text-xl text-[var(--charcoal)]">
            {ev.title}
          </h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {new Date(ev.starts_at).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {ev.location ? ` · ${ev.location}` : null}
          </p>
          {ev.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink)]">{ev.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-[var(--ink-soft)]">
            {ev.counts.going} going · {ev.counts.maybe} maybe
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rsvpBtns.map((b) => (
              <button
                key={b.status}
                type="button"
                disabled={busy}
                onClick={() => void rsvp(ev.id, b.status)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  ev.myRsvp === b.status
                    ? "bg-[var(--olive-deep)] text-[var(--parchment)]"
                    : "border border-[var(--rule)] bg-white/80 text-[var(--charcoal)]"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
