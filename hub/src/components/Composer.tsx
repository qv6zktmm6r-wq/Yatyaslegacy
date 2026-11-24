"use client";

import { FormEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ImageFitEditor } from "@/components/ImageFitEditor";

export function Composer({
  userId: _userId,
  displayName,
  avatarUrl,
  canAnnounce = false,
  onPosted,
}: {
  userId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  canAnnounce?: boolean;
  onPosted?: () => void;
}) {
  void _userId;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [fitFile, setFitFile] = useState<File | null>(null);

  function pickFile(next: File | null) {
    if (!next) {
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      return;
    }
    setFitFile(next);
  }

  function applyFitted(fitted: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(fitted);
    setPreview(URL.createObjectURL(fitted));
    setFitFile(null);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim() || (file ? "Shared a photo" : "");
    if (!text) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      setLoading(false);
      setError("Session expired. Sign in again, then post.");
      return;
    }

    let imagePath: string | null = null;
    if (file) {
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) {
        setLoading(false);
        setError(uploadError.message);
        return;
      }
      imagePath = path;
    }

    const { error: insertError } = await supabase.from("chapter_posts").insert({
      author_id: user.id,
      chapter: "HUB",
      body: text,
      image_path: imagePath,
      is_announcement: canAnnounce && isAnnouncement,
    });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBody("");
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setOpen(false);
    setIsAnnouncement(false);
    onPosted?.();
    router.refresh();
  }

  const first = (displayName || "there").split(" ")[0];

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-3 shadow-[0_1px_2px_rgba(42,38,32,0.06)]"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            e.target.value = "";
            pickFile(next);
          }}
        />

        <div className="flex items-start gap-3">
          <Avatar url={avatarUrl} name={displayName} size={40} />
          <div className="min-w-0 flex-1">
            {!open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full rounded-full bg-black/[0.05] px-4 py-2.5 text-left text-sm text-[var(--ink-soft)] hover:bg-black/[0.08]"
              >
                What&apos;s on your mind, {first}?
              </button>
            ) : (
              <textarea
                autoFocus
                rows={3}
                maxLength={4000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`What's on your mind, ${first}?`}
                className="w-full resize-none rounded-lg border border-[var(--rule)] bg-white/90 px-3 py-2 text-sm outline-none focus:border-[var(--olive)]"
              />
            )}
          </div>
        </div>

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="mt-3 max-h-56 w-full rounded-lg object-cover"
          />
        ) : null}

        {open ? (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg bg-[rgba(90,99,72,0.12)] px-3 py-1.5 text-sm font-semibold text-[var(--olive-deep)] hover:bg-[rgba(90,99,72,0.18)]"
                >
                  Photo
                </button>
                {canAnnounce ? (
                  <label className="flex items-center gap-1.5 text-xs text-[var(--charcoal)]">
                    <input
                      type="checkbox"
                      checked={isAnnouncement}
                      onChange={(e) => setIsAnnouncement(e.target.checked)}
                    />
                    Board announcement
                  </label>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setBody("");
                    setFile(null);
                    if (preview) URL.revokeObjectURL(preview);
                    setPreview(null);
                    setError(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-[var(--ink-soft)] hover:bg-black/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (!body.trim() && !file)}
                  className="rounded-lg bg-[var(--olive-deep)] px-4 py-1.5 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
                >
                  {loading ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
            {error ? (
              <p className="mt-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-2 px-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--olive-deep)] hover:bg-black/[0.04]"
            >
              Photo
            </button>
          </div>
        )}
      </form>

      {fitFile ? (
        <ImageFitEditor
          file={fitFile}
          aspect={4 / 3}
          title="Fit photo for post"
          outputWidth={1600}
          onCancel={() => setFitFile(null)}
          onConfirm={applyFitted}
        />
      ) : null}
    </>
  );
}
