import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlbumDetailClient } from "@/components/AlbumDetailClient";
import { createClient } from "@/lib/supabase/server";
import type { HubAlbum, HubAlbumPhoto } from "@/lib/types";

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: album } = await supabase.from("hub_albums").select("*").eq("id", id).maybeSingle();
  if (!album) notFound();

  const { data: photos } = await supabase
    .from("hub_album_photos")
    .select("*")
    .eq("album_id", id)
    .order("created_at", { ascending: false });

  const urls: Record<string, string> = {};
  for (const p of (photos as HubAlbumPhoto[]) || []) {
    const { data } = await supabase.storage.from("post-images").createSignedUrl(p.image_path, 3600);
    if (data?.signedUrl) urls[p.id] = data.signedUrl;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/albums" className="text-sm text-[var(--olive-deep)] hover:underline">
        ← Albums
      </Link>
      <AlbumDetailClient
        userId={user.id}
        album={album as HubAlbum}
        photos={(photos as HubAlbumPhoto[]) || []}
        imageUrls={urls}
      />
    </div>
  );
}
