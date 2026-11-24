"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { MembershipTag } from "@/components/MembershipTag";
import { roleLadderLabel } from "@/lib/types";

export function ProfileHero({
  profile,
  avatarUrl,
  coverUrl,
  editing,
  onEdit,
  onCoverChange,
}: {
  profile: Profile;
  avatarUrl: string | null;
  coverUrl?: string | null;
  editing: boolean;
  onEdit: () => void;
  onCoverChange?: (file: File | null) => Promise<void>;
}) {
  const vip = profile.role === "president" || profile.role === "vip";
  const [coverBusy, setCoverBusy] = useState(false);
  const coverInputId = `cover-input-${profile.id}`;

  async function pickCover(file: File | null) {
    if (!file || !onCoverChange) return;
    setCoverBusy(true);
    try {
      await onCoverChange(file);
    } finally {
      setCoverBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] shadow-[0_1px_2px_rgba(42,38,32,0.06)]">
      <div className="relative h-40 sm:h-52">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(135deg, #3f4633 0%, #5a6348 45%, #b08d3e 100%)",
            }}
          />
        )}
        {onCoverChange ? (
          <>
            <input
              id={coverInputId}
              type="file"
              accept="image/*,image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={coverBusy}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                void pickCover(file);
              }}
            />
            {/* Native label — works on iOS; z-20 stays above overlapping avatar row */}
            <label
              htmlFor={coverInputId}
              className="absolute inset-0 z-20 flex cursor-pointer items-end justify-end bg-gradient-to-t from-black/40 via-transparent to-transparent p-3"
            >
              <span className="pointer-events-none rounded-lg bg-[rgba(255,252,245,0.97)] px-3 py-2 text-xs font-semibold text-[var(--charcoal)] shadow">
                {coverBusy ? "Uploading…" : "Edit cover"}
              </span>
            </label>
          </>
        ) : null}
      </div>
      {/* pointer-events-none so this -mt overlap doesn't steal cover taps */}
      <div className="pointer-events-none relative z-10 px-4 pb-4 sm:px-5">
        <div className="-mt-14 flex flex-wrap items-end justify-between gap-3">
          <div className="pointer-events-auto rounded-full bg-[rgba(255,252,245,0.96)] p-1 shadow">
            <Avatar url={avatarUrl} name={profile.display_name} size={128} />
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={onEdit}
              className="pointer-events-auto mb-2 rounded-lg bg-black/[0.06] px-4 py-2 text-sm font-semibold text-[var(--charcoal)] hover:bg-black/[0.1]"
            >
              Edit profile
            </button>
          ) : null}
        </div>

        <div className="pointer-events-auto mt-3">
          <h1 className="flex flex-wrap items-center gap-2 font-[family-name:var(--font-display-face)] text-3xl text-[var(--charcoal)] sm:text-4xl">
            {profile.display_name}
            <MembershipTag tag={profile.membership_tag} size="md" />
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            <span
              className={`mr-2 font-semibold ${
                vip ? "text-[var(--gold)]" : "text-[var(--olive-deep)]"
              }`}
            >
              {roleLadderLabel(profile.role, profile.title)}
            </span>
            {profile.home_region ? ` · ${profile.home_region}` : null}
            {profile.branch ? ` · ${profile.branch}` : null}
          </p>
          {profile.bio ? (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">
              Add a short intro so members know who you are.
            </p>
          )}
          {onCoverChange ? (
            <label
              htmlFor={coverInputId}
              className="mt-3 inline-flex cursor-pointer rounded-lg border border-[var(--rule)] bg-black/[0.04] px-3 py-2 text-sm font-semibold text-[var(--charcoal)]"
            >
              {coverBusy ? "Uploading cover…" : "Change cover photo"}
            </label>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProfileForm({
  profile,
  avatarUrl,
  coverUrl,
  onDone,
  onCoverUploaded,
  onAvatarUploaded,
  onPickCover,
  onPickAvatar,
}: {
  profile: Profile;
  avatarUrl: string | null;
  coverUrl?: string | null;
  onDone?: () => void;
  onCoverUploaded?: (url: string | null) => void;
  onAvatarUploaded?: (url: string | null) => void;
  onPickCover?: (file: File) => void;
  onPickAvatar?: (file: File) => void;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [branch, setBranch] = useState(profile.branch);
  const [homeRegion, setHomeRegion] = useState(profile.home_region || "");
  const [quietHours, setQuietHours] = useState(!!profile.chat_quiet_hours);
  const [digestOptIn, setDigestOptIn] = useState(profile.digest_opt_in ?? true);
  const preview = avatarUrl;
  const coverPreview = coverUrl || null;
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  void onCoverUploaded;
  void onAvatarUploaded;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        branch: branch.trim(),
        home_region: homeRegion.trim(),
        chat_quiet_hours: quietHours,
        digest_opt_in: digestOptIn,
      })
      .eq("id", profile.id);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
    onDone?.();
  }

  function onAvatar(file: File | null) {
    if (!file) return;
    setError(null);
    onPickAvatar?.(file);
  }

  function onCover(file: File | null) {
    if (!file) return;
    setError(null);
    onPickCover?.(file);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4 shadow-[0_1px_2px_rgba(42,38,32,0.06)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--charcoal)]">Edit profile</h2>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-[var(--ink-soft)] hover:underline"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <Avatar url={preview} name={displayName} size={72} />
        <label className="text-sm">
          <span className="mb-1 block font-medium text-[var(--charcoal)]">
            Profile photo
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void onAvatar(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--charcoal)]">
          Cover / background photo
        </span>
        {coverPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPreview}
            alt=""
            className="mb-2 h-24 w-full rounded-lg object-cover"
          />
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            void onCover(file);
          }}
          className="text-xs"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--ink-soft)]">Name</span>
        <input
          required
          maxLength={80}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--olive)]"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--ink-soft)]">
          Service / branch (optional)
        </span>
        <input
          maxLength={80}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="e.g. USMC · Veteran"
          className="w-full rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--olive)]"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--ink-soft)]">
          Home region (optional — for future chapters)
        </span>
        <input
          maxLength={80}
          value={homeRegion}
          onChange={(e) => setHomeRegion(e.target.value)}
          placeholder="e.g. California, Texas, East Coast"
          className="w-full rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--olive)]"
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={quietHours}
          onChange={(e) => setQuietHours(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium text-[var(--charcoal)]">
            Chat quiet hours
          </span>
          <span className="text-[var(--ink-soft)]">
            Show a family-friendly reminder in chat (local 10pm–6am).
          </span>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={digestOptIn}
          onChange={(e) => setDigestOptIn(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-medium text-[var(--charcoal)]">
            Weekly digest email
          </span>
          <span className="text-[var(--ink-soft)]">
            Highlights from the hub when digest sends are enabled.
          </span>
        </span>
      </label>

      <p className="text-sm">
        <Link href="/card" className="font-semibold text-[var(--olive-deep)] hover:underline">
          View your digital member card →
        </Link>
      </p>

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--ink-soft)]">Intro</span>
        <textarea
          rows={4}
          maxLength={1000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full rounded-lg border border-[var(--rule)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--olive)]"
        />
      </label>

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-[var(--olive-deep)]" role="status">
          Saved.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[var(--olive-deep)] px-4 py-2.5 text-sm font-semibold text-[var(--parchment)] disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
