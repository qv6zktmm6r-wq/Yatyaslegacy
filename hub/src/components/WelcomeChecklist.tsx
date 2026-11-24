"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WelcomeSteps } from "@/lib/types";

const STEP_DEFS: { key: keyof WelcomeSteps; label: string; href: string }[] = [
  { key: "profile", label: "Complete your profile", href: "/profile" },
  { key: "directory", label: "Browse the member directory", href: "/members" },
  { key: "event", label: "View events or RSVP", href: "/events" },
  { key: "card", label: "Open your digital member card", href: "/card" },
];

export function WelcomeChecklist({
  userId,
  welcomeCompleted,
  welcomeSteps,
  profileComplete,
}: {
  userId: string;
  welcomeCompleted: boolean;
  welcomeSteps: WelcomeSteps;
  profileComplete: boolean;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(welcomeCompleted);
  const [busy, setBusy] = useState(false);

  if (dismissed) return null;

  const steps: WelcomeSteps = {
    ...welcomeSteps,
    profile: welcomeSteps.profile ?? profileComplete,
  };
  const doneCount = STEP_DEFS.filter((s) => steps[s.key]).length;
  const allDone = doneCount >= STEP_DEFS.length;

  async function persist(next: WelcomeSteps, completed: boolean) {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ welcome_steps: next, welcome_completed: completed })
      .eq("id", userId);
    setBusy(false);
    if (completed) setDismissed(true);
    router.refresh();
  }

  async function markStep(key: keyof WelcomeSteps) {
    const next = { ...steps, [key]: true };
    const completed = STEP_DEFS.every((s) => !!next[s.key]);
    await persist(next, completed);
  }

  async function finish() {
    const next: WelcomeSteps = {};
    for (const s of STEP_DEFS) next[s.key] = true;
    await persist(next, true);
  }

  return (
    <section className="rounded-xl border border-[var(--gold)]/40 bg-gradient-to-br from-[rgba(176,141,62,0.12)] to-[rgba(90,99,72,0.08)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display-face)] text-lg text-[var(--charcoal)]">
            Welcome to the Hub
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {doneCount} of {STEP_DEFS.length} steps — get oriented with the chapter.
          </p>
        </div>
        {allDone ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void finish()}
            className="shrink-0 rounded-lg bg-[var(--olive-deep)] px-3 py-1.5 text-xs font-semibold text-[var(--parchment)]"
          >
            Done
          </button>
        ) : null}
      </div>
      <ul className="mt-3 space-y-2">
        {STEP_DEFS.map((s) => {
          const done = !!steps[s.key];
          return (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                  done
                    ? "bg-[var(--olive-deep)] text-[var(--parchment)]"
                    : "border border-[var(--rule)] bg-white/80 text-transparent"
                }`}
                aria-hidden
              >
                ✓
              </span>
              {done ? (
                <span className="text-[var(--ink-soft)] line-through">{s.label}</span>
              ) : (
                <Link
                  href={s.href}
                  onClick={() => void markStep(s.key)}
                  className="font-medium text-[var(--olive-deep)] hover:underline"
                >
                  {s.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
