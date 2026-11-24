"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export type CrewFinderRow = {
  id: string;
  intent: "find" | "list";
  full_name: string;
  email: string;
  story_raw: string;
  looking_for: string | null;
  unit: string | null;
  years: string | null;
  platform: string | null;
  station: string | null;
  matchable: boolean;
  status: "open" | "matched" | "closed";
  created_at: string;
};

export function CrewFinderBoardClient({
  initialRows,
}: {
  initialRows: CrewFinderRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const finds = useMemo(
    () => rows.filter((r) => r.intent === "find"),
    [rows],
  );
  const lists = useMemo(
    () => rows.filter((r) => r.intent === "list"),
    [rows],
  );

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase
      .from("crew_finder_entries")
      .select(
        "id, intent, full_name, email, story_raw, looking_for, unit, years, platform, station, matchable, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(120);
    if (data) setRows(data as CrewFinderRow[]);
    router.refresh();
  }

  async function setStatus(id: string, status: CrewFinderRow["status"]) {
    setBusyId(id);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase
      .from("crew_finder_entries")
      .update({ status })
      .eq("id", id);
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNote(status === "closed" ? "Marked closed." : "Status updated.");
    await refresh();
  }

  function RowCard({ row }: { row: CrewFinderRow }) {
    return (
      <article className="rounded border border-[var(--rule)] bg-white/70 p-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium text-[var(--charcoal)]">
            {row.full_name}{" "}
            <span className="text-[var(--ink-soft)]">· {row.intent}</span>
          </p>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)]">
            {row.status}
          </p>
        </div>
        <p className="mt-1 text-[var(--ink-soft)]">
          <a className="underline" href={`mailto:${row.email}`}>
            {row.email}
          </a>
        </p>
        <p className="mt-2 text-[var(--charcoal)]">
          {[row.unit, row.years, row.platform, row.station]
            .filter(Boolean)
            .join(" · ") || "No structured fields yet"}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-[var(--ink-soft)]">
          {row.looking_for || row.story_raw}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {row.status !== "matched" ? (
            <button
              type="button"
              className="rounded border border-[var(--rule)] px-2 py-1 text-xs"
              disabled={busyId === row.id}
              onClick={() => setStatus(row.id, "matched")}
            >
              Mark introduced
            </button>
          ) : null}
          {row.status !== "closed" ? (
            <button
              type="button"
              className="rounded border border-[var(--rule)] px-2 py-1 text-xs"
              disabled={busyId === row.id}
              onClick={() => setStatus(row.id, "closed")}
            >
              Close
            </button>
          ) : null}
          {row.status === "closed" ? (
            <button
              type="button"
              className="rounded border border-[var(--rule)] px-2 py-1 text-xs"
              disabled={busyId === row.id}
              onClick={() => setStatus(row.id, "open")}
            >
              Reopen
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
      <div>
        <h2 className="font-[family-name:var(--font-display-face)] text-xl text-[var(--charcoal)]">
          Crew Finder
        </h2>
        <p className="text-sm text-[var(--ink-soft)]">
          Live matching stores find requests and list-yourself entries. Public
          results never show emails — Board introduces with consent.
        </p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {note ? <p className="text-sm text-emerald-800">{note}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Looking ({finds.length})
          </h3>
          {finds.length ? (
            finds.map((row) => <RowCard key={row.id} row={row} />)
          ) : (
            <p className="text-sm text-[var(--ink-soft)]">No find requests yet.</p>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Listed ({lists.length})
          </h3>
          {lists.length ? (
            lists.map((row) => <RowCard key={row.id} row={row} />)
          ) : (
            <p className="text-sm text-[var(--ink-soft)]">
              No list-yourself entries yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
