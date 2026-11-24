"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PollRow = {
  id: string;
  question: string;
  created_at: string;
  options: { id: string; label: string; votes: number }[];
  my_vote_option_id: string | null;
  total_votes: number;
};

export function PollsClient({ userId, polls }: { userId: string; polls: PollRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createPoll(e: FormEvent) {
    e.preventDefault();
    const labels = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || labels.length < 2 || labels.length > 5) {
      setError("Add a question and 2–5 options.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: poll, error: pollErr } = await supabase
      .from("hub_polls")
      .insert({ created_by: userId, question: question.trim() })
      .select("id")
      .single();
    if (pollErr || !poll) {
      setBusy(false);
      setError(pollErr?.message || "Could not create poll");
      return;
    }
    await supabase.from("hub_poll_options").insert(
      labels.map((label, i) => ({
        poll_id: poll.id,
        label,
        sort_order: i,
      })),
    );
    setBusy(false);
    setQuestion("");
    setOptions(["", ""]);
    setShowForm(false);
    router.refresh();
  }

  async function vote(pollId: string, optionId: string) {
    setBusy(true);
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("hub_poll_votes")
      .select("poll_id")
      .eq("poll_id", pollId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("hub_poll_votes")
        .update({ option_id: optionId })
        .eq("poll_id", pollId)
        .eq("user_id", userId);
    } else {
      await supabase.from("hub_poll_votes").insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: userId,
      });
    }
    setBusy(false);
    router.refresh();
  }

  function addOption() {
    if (options.length >= 5) return;
    setOptions([...options, ""]);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">Polls</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-[var(--olive-deep)] px-3 py-2 text-sm font-semibold text-[var(--parchment)]"
        >
          {showForm ? "Close" : "New poll"}
        </button>
      </header>

      {showForm ? (
        <form onSubmit={createPoll} className="space-y-3 rounded-xl border border-[var(--rule)] bg-white/90 p-4">
          <input
            required
            maxLength={240}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question"
            className="w-full rounded-lg border border-[var(--rule)] px-3 py-2 text-sm"
          />
          {options.map((opt, i) => (
            <input
              key={i}
              maxLength={120}
              value={opt}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                setOptions(next);
              }}
              placeholder={`Option ${i + 1}`}
              className="w-full rounded-lg border border-[var(--rule)] px-3 py-2 text-sm"
            />
          ))}
          {options.length < 5 ? (
            <button type="button" onClick={addOption} className="text-sm text-[var(--olive-deep)] hover:underline">
              Add option
            </button>
          ) : null}
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--olive-deep)] px-4 py-2 text-sm font-semibold text-[var(--parchment)]"
          >
            {busy ? "Creating…" : "Create poll"}
          </button>
        </form>
      ) : null}

      {polls.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rule)] p-6 text-center text-sm text-[var(--ink-soft)]">
          No polls yet.
        </p>
      ) : null}

      {polls.map((poll) => (
        <article key={poll.id} className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4">
          <h2 className="font-semibold text-[var(--charcoal)]">{poll.question}</h2>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            {poll.total_votes} vote{poll.total_votes === 1 ? "" : "s"}
          </p>
          <ul className="mt-3 space-y-2">
            {poll.options.map((o) => {
              const pct = poll.total_votes ? Math.round((o.votes / poll.total_votes) * 100) : 0;
              const selected = poll.my_vote_option_id === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void vote(poll.id, o.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      selected
                        ? "border-[var(--olive-deep)] bg-[rgba(90,99,72,0.12)]"
                        : "border-[var(--rule)] bg-white/80"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span>{o.label}</span>
                      <span className="text-xs text-[var(--ink-soft)]">
                        {o.votes} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                      <div className="h-full bg-[var(--olive)]" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}
