"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/Composer";
import { ImageFitEditor } from "@/components/ImageFitEditor";
import { PostCard } from "@/components/PostCard";
import { ProfileForm, ProfileHero } from "@/components/ProfileForm";
import { createClient } from "@/lib/supabase/client";
import type { ChapterPost, Profile } from "@/lib/types";
import { isVipRole } from "@/lib/types";

export function ProfilePageClient({
  profile,
  avatarUrl,
  coverUrl,
  posts,
  imageUrls,
  avatarUrls,
}: {
  profile: Profile;
  avatarUrl: string | null;
  coverUrl: string | null;
  posts: ChapterPost[];
  imageUrls: Record<string, string>;
  avatarUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cover, setCover] = useState(coverUrl);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [fitJob, setFitJob] = useState<{
    kind: "cover" | "avatar";
    file: File;
  } | null>(null);
  const canModerate = isVipRole(profile.role);

  async function uploadCover(file: File) {
    setCoverError(null);
    const supabase = createClient();
    const path = `${profile.id}/cover.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(path, file, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) {
      setCoverError(uploadError.message);
      return;
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ cover_path: path })
      .eq("id", profile.id);
    if (updateError) {
      setCoverError(updateError.message);
      return;
    }
    const { data } = await supabase.storage.from("covers").createSignedUrl(path, 3600);
    setCover(data?.signedUrl ?? null);
    router.refresh();
  }

  async function uploadAvatar(file: File) {
    setCoverError(null);
    const supabase = createClient();
    const path = `${profile.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) {
      setCoverError(uploadError.message);
      return;
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", profile.id);
    if (updateError) {
      setCoverError(updateError.message);
      return;
    }
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
    setAvatar(data?.signedUrl ?? null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ProfileHero
        profile={profile}
        avatarUrl={avatar}
        coverUrl={cover}
        editing={editing}
        onEdit={() => setEditing(true)}
        onCoverChange={async (file) => {
          if (file) setFitJob({ kind: "cover", file });
        }}
      />
      {coverError ? (
        <p className="text-sm text-red-800" role="alert">
          Photo upload failed: {coverError}
        </p>
      ) : null}

      {editing ? (
        <ProfileForm
          profile={profile}
          avatarUrl={avatar}
          coverUrl={cover}
          onDone={() => setEditing(false)}
          onCoverUploaded={(url) => setCover(url)}
          onAvatarUploaded={(url) => setAvatar(url)}
          onPickCover={(file) => setFitJob({ kind: "cover", file })}
          onPickAvatar={(file) => setFitJob({ kind: "avatar", file })}
        />
      ) : null}

      {fitJob ? (
        <ImageFitEditor
          file={fitJob.file}
          aspect={fitJob.kind === "cover" ? 2.75 : 1}
          circular={fitJob.kind === "avatar"}
          outputWidth={fitJob.kind === "cover" ? 1600 : 800}
          title={
            fitJob.kind === "cover"
              ? "Fit cover photo"
              : "Fit profile photo"
          }
          onCancel={() => setFitJob(null)}
          onConfirm={(fitted) => {
            const kind = fitJob.kind;
            setFitJob(null);
            void (kind === "cover" ? uploadCover(fitted) : uploadAvatar(fitted));
          }}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.96)] p-4 shadow-[0_1px_2px_rgba(42,38,32,0.06)]">
          <h2 className="text-base font-semibold text-[var(--charcoal)]">Intro</h2>
          <dl className="mt-3 space-y-2 text-sm text-[var(--ink)]">
            <div>
              <dt className="text-[var(--ink-soft)]">Association</dt>
              <dd className="font-medium">YAT-YAS</dd>
            </div>
            {profile.membership_tag ? (
              <div>
                <dt className="text-[var(--ink-soft)]">Membership</dt>
                <dd className="font-medium">{profile.membership_tag}</dd>
              </div>
            ) : null}
            {profile.home_region ? (
              <div>
                <dt className="text-[var(--ink-soft)]">Home region</dt>
                <dd className="font-medium">{profile.home_region}</dd>
              </div>
            ) : null}
            {profile.branch ? (
              <div>
                <dt className="text-[var(--ink-soft)]">Service</dt>
                <dd className="font-medium">{profile.branch}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[var(--ink-soft)]">Role</dt>
              <dd className="font-medium">
                {profile.role === "president"
                  ? profile.title || "President"
                  : profile.role === "vip"
                    ? profile.title || "Board / VIP"
                    : "Member"}
              </dd>
            </div>
          </dl>
        </aside>

        <div className="space-y-4">
          <Composer
            userId={profile.id}
            displayName={profile.display_name}
            avatarUrl={avatar}
          />
          {posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--rule)] bg-white/50 p-6 text-center text-sm text-[var(--ink-soft)]">
              No posts on your timeline yet. Be the first Gator — share a photo
              or a word with members.
            </p>
          ) : null}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userId={profile.id}
              imageUrl={imageUrls[post.id] ?? null}
              avatarUrl={avatarUrls[post.author_id] ?? avatar}
              commentAvatarUrls={avatarUrls}
              canModerate={canModerate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
