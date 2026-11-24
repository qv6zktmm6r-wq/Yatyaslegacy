import { redirect } from "next/navigation";
import { DirectoryClient, type DirectoryMember } from "@/components/DirectoryClient";
import { createClient } from "@/lib/supabase/server";

export default async function MembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path, branch, role, title, membership_tag, home_region")
    .eq("chapter", "MEMBER")
    .order("display_name", { ascending: true });

  const members: DirectoryMember[] = [];
  for (const row of rows || []) {
    let avatar_url: string | null = null;
    if (row.avatar_path) {
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(row.avatar_path, 3600);
      avatar_url = data?.signedUrl ?? null;
    }
    members.push({
      id: row.id,
      display_name: row.display_name,
      avatar_path: row.avatar_path,
      branch: row.branch,
      role: row.role,
      title: row.title,
      membership_tag: row.membership_tag,
      home_region: row.home_region,
      avatar_url,
    });
  }

  return <DirectoryClient members={members} currentUserId={user.id} />;
}
