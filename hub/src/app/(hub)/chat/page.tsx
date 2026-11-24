import { redirect } from "next/navigation";
import { ChatRoom } from "@/components/ChatRoom";
import { createClient } from "@/lib/supabase/server";
import { unwrapOne, type ChapterMessage } from "@/lib/types";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("chapter_messages")
    .select("id, author_id, chapter, body, created_at, profiles!author_id(display_name, avatar_path)")
    .eq("chapter", "HUB")
    .order("created_at", { ascending: true })
    .limit(200);

  const messages: ChapterMessage[] = (data || []).map((row) => ({
    ...row,
    profiles: unwrapOne(row.profiles),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display-face)] text-3xl text-[var(--charcoal)]">
          Chapter chat
        </h1>
        <p className="text-sm text-[var(--ink-soft)]">
          Live conversation for association members.
        </p>
      </div>
      <ChatRoom userId={user.id} initialMessages={messages} />
    </div>
  );
}
