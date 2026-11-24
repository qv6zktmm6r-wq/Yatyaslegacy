import { redirect } from "next/navigation";
import { AlbumsClient, type AlbumListItem } from "@/components/AlbumsClient";
import { createClient } from "@/lib/supabase/server";
import type { HubAlbum } from "@/lib/types";

export default async function AlbumsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: albums } = await supabase
    .from("hub_albums")
    .select("*")
    .order("created_at", { ascending: false });

  const list: AlbumListItem[] = [];
  for (const row of (albums as HubAlbum[]) || []) {
    const { count } = await supabase
      .from("hub_album_photos")
      .select("id", { count: "exact", head: true })
      .eq("album_id", row.id);

    const { data: firstPhoto } = await supabase
      .from("hub_album_photos")
      .select("image_path")
      .eq("album_id", row.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let cover_url: string | null = null;
    if (firstPhoto?.image_path) {
      const { data } = await supabase.storage
        .from("post-images")
        .createSignedUrl(firstPhoto.image_path, 3600);
      cover_url = data?.signedUrl ?? null;
    }

    list.push({
      ...row,
      photo_count: count ?? 0,
      cover_url,
    });
  }

  return <AlbumsClient userId={user.id} albums={list} />;
}
