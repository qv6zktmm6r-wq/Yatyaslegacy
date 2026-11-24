"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export type SponsorRow = {
  id: string;
  organization_name: string;
  contact_name: string | null;
  contact_email: string | null;
  website_url: string | null;
  logo_url: string | null;
  interest_type: string | null;
  support_focus: string | null;
  gift_range: string | null;
  message: string | null;
  status: "pending" | "approved" | "archived";
  display_order: number;
  created_at: string;
};

export function SponsorsBoardClient({ initialRows }: { initialRows: SponsorRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [org, setOrg] = useState("");
  const [logo, setLogo] = useState("");
  const [website, setWebsite] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const pending = useMemo(
    () => rows.filter((r) => r.status === "pending"),
    [rows],
  );
  const approved = useMemo(
    () => rows.filter((r) => r.status === "approved"),
    [rows],
  );

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase
      .from("association_sponsors")
      .select(
        "id, organization_name, contact_name, contact_email, website_url, logo_url, interest_type, support_focus, gift_range, message, status, display_order, created_at",
      )
      .order("created_at", { ascending: false });
    if (data) setRows(data as SponsorRow[]);
    router.refresh();
  }

  async function saveRow(
    id: string,
    patch: Partial<SponsorRow> & { approved_at?: string | null; approved_by?: string | null },
  ) {
    setBusyId(id);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase
      .from("association_sponsors")
      .update(patch)
      .eq("id", id);
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNote("Sponsor updated.");
    await refresh();
  }

  async function approve(row: SponsorRow, logoUrl: string, websiteUrl: string) {
    const logo_url = logoUrl.trim();
    if (!logo_url) {
      setError("Add a logo URL before approving — logos power the public wall.");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await saveRow(row.id, {
      status: "approved",
      logo_url,
      website_url: websiteUrl.trim() || null,
      approved_at: new Date().toISOString(),
      approved_by: user?.id || null,
    });
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setAddBusy(true);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("association_sponsors").insert({
      organization_name: org.trim(),
      website_url: website.trim() || null,
      logo_url: logo.trim() || null,
      status: logo.trim() ? "approved" : "pending",
      approved_at: logo.trim() ? new Date().toISOString() : null,
      display_order: 50,
    });
    setAddBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setOrg("");
    setLogo("");
    setWebsite("");
    setNote(logo.trim() ? "Sponsor live on the public wall." : "Sponsor saved as pending.");
    await refresh();
  }

  return (
    <section className="space-y-4 rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4">
      <div>
        <h2 className="font-semibold text-[var(--charcoal)]">Sponsors · logo wall</h2>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Approved sponsors with a logo URL appear on the public site. Inquiry form creates
          pending rows; approve only after the relationship is real.
        </p>
      </div>

      <form onSubmit={onAdd} className="grid gap-2 sm:grid-cols-3">
        <input
          required
          placeholder="Organization"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm"
        />
        <input
          placeholder="Logo URL (https://…)"
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm"
        />
        <input
          placeholder="Website (optional)"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={addBusy}
          className="sm:col-span-3 rounded-lg bg-[var(--olive-deep)] px-3 py-2 text-xs font-semibold text-[var(--parchment)] disabled:opacity-50"
        >
          {addBusy ? "Saving…" : "Add sponsor"}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {note ? <p className="text-sm text-[var(--olive-deep)]">{note}</p> : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--charcoal)]">
          Pending ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-xs text-[var(--ink-soft)]">No pending sponsor inquiries.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((row) => (
              <SponsorEditor
                key={row.id}
                row={row}
                busy={busyId === row.id}
                onApprove={(logoUrl, websiteUrl) =>
                  void approve(row, logoUrl, websiteUrl)
                }
                onArchive={() => void saveRow(row.id, { status: "archived" })}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-[var(--rule)] pt-3">
        <h3 className="text-sm font-semibold text-[var(--charcoal)]">
          Live on site ({approved.length})
        </h3>
        {approved.length === 0 ? (
          <p className="text-xs text-[var(--ink-soft)]">No approved logos yet.</p>
        ) : (
          <ul className="space-y-3">
            {approved.map((row) => (
              <SponsorEditor
                key={row.id}
                row={row}
                busy={busyId === row.id}
                onApprove={(logoUrl, websiteUrl) =>
                  void saveRow(row.id, {
                    logo_url: logoUrl.trim(),
                    website_url: websiteUrl.trim() || null,
                    status: "approved",
                  })
                }
                onArchive={() => void saveRow(row.id, { status: "archived" })}
                live
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SponsorEditor({
  row,
  busy,
  onApprove,
  onArchive,
  live = false,
}: {
  row: SponsorRow;
  busy: boolean;
  onApprove: (logoUrl: string, websiteUrl: string) => void;
  onArchive: () => void;
  live?: boolean;
}) {
  const [logoUrl, setLogoUrl] = useState(row.logo_url || "");
  const [website, setWebsite] = useState(row.website_url || "");

  return (
    <li className="rounded-lg border border-[var(--rule)] bg-white/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--charcoal)]">{row.organization_name}</p>
          <p className="text-xs text-[var(--ink-soft)]">
            {[row.contact_name, row.contact_email, row.interest_type, row.support_focus]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {row.message ? (
            <p className="mt-1 text-xs text-[var(--ink-soft)] line-clamp-3">{row.message}</p>
          ) : null}
        </div>
        {row.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.logo_url}
            alt=""
            className="h-10 max-w-[7rem] object-contain"
          />
        ) : null}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="Logo URL"
          className="rounded border border-[var(--rule)] px-2 py-1.5 text-xs"
        />
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="Website"
          className="rounded border border-[var(--rule)] px-2 py-1.5 text-xs"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onApprove(logoUrl, website)}
          className="rounded border border-[var(--olive)] px-2 py-1 text-[11px] font-semibold text-[var(--olive-deep)] disabled:opacity-50"
        >
          {live ? "Update logo" : "Approve + publish logo"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onArchive}
          className="rounded border border-[var(--rule)] px-2 py-1 text-[11px] font-semibold text-[var(--charcoal)] disabled:opacity-50"
        >
          Archive
        </button>
      </div>
    </li>
  );
}
