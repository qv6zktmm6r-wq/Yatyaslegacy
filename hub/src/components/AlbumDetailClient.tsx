"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HubAlbum, HubAlbumPhoto } from "@/lib/types";

export function AlbumDetailClient({
  userId,
  album,
  photos,
  imageUrls,
}: {
  userId: string;
  album: HubAlbum;
  photos: HubAlbumPhoto[];
  imageUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("photos") as HTMLInputElement;
    const files = [...(input.files || [])];
    if (files.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    for (const file of files) {
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
    input.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">{album.title}</h1>
        {album.description ? (
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{album.description}</p>
        ) : null}
      </header>

      <form onSubmit={upload} className="rounded-xl border border-[var(--rule)] bg-white/80 p-3">
        <label className="block text-sm font-medium text-[var(--charcoal)]">Add photos</label>
        <input name="photos" type="file" accept="image/*" multiple className="mt-1 text-xs" />
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-lg bg-[var(--olive-deep)] px-3 py-1.5 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>

      {photos.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">No photos in this album yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-[var(--rule)]">
              {imageUrls[p.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrls[p.id]} alt={p.caption || ""} className="aspect-square w-full object-cover" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
