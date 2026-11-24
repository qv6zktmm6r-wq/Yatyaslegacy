"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HubAlbum } from "@/lib/types";

export type AlbumListItem = HubAlbum & { photo_count: number; cover_url: string | null };

export function AlbumsClient({
  userId,
  albums,
}: {
  userId: string;
  albums: AlbumListItem[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: album, error: insertError } = await supabase
      .from("hub_albums")
      .insert({
        created_by: userId,
        title: title.trim(),
        description: description.trim(),
      })
      .select("id")
      .single();

    if (insertError || !album) {
      setBusy(false);
      setError(insertError?.message || "Could not create album");
      return;
    }

    for (const file of pendingPhotos) {
      const path = `${userId}/albums/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("post-images")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (!upErr) {
        await supabase.from("hub_album_photos").insert({
          album_id: album.id,
          uploaded_by: userId,
          image_path: path,
        });
      }
    }

    setBusy(false);
    setTitle("");
    setDescription("");
    setPendingPhotos([]);
    setShowForm(false);
    router.push(`/albums/${album.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">Albums</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-[var(--olive-deep)] px-3 py-2 text-sm font-semibold text-[var(--parchment)]"
        >
          {showForm ? "Close" : "New album"}
        </button>
      </header>

      {showForm ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-[var(--rule)] bg-white/90 p-4">
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Album title"
            className="w-full rounded-lg border border-[var(--rule)] px-3 py-2 text-sm"
          />
          <textarea
            rows={2}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-[var(--rule)] px-3 py-2 text-sm"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="text-xs"
            onChange={(e) => setPendingPhotos([...(e.target.files || [])])}
          />
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
            {busy ? "Creating…" : "Create album"}
          </button>
        </form>
      ) : null}

      {albums.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rule)] p-6 text-center text-sm text-[var(--ink-soft)]">
          No albums yet — share chapter photos.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {albums.map((a) => (
            <li key={a.id}>
              <Link
                href={`/albums/${a.id}`}
                className="block overflow-hidden rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-[4/3] bg-black/5">
                  {a.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--ink-soft)]">
                      No photos yet
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-[var(--charcoal)]">{a.title}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{a.photo_count} photo{a.photo_count === 1 ? "" : "s"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
