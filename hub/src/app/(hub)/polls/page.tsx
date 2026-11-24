import { redirect } from "next/navigation";
import { PollsClient, type PollRow } from "@/components/PollsClient";
import { createClient } from "@/lib/supabase/server";

export default async function PollsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pollRows } = await supabase
    .from("hub_polls")
    .select("id, question, created_at")
    .order("created_at", { ascending: false });

  const polls: PollRow[] = [];
  for (const poll of pollRows || []) {
    const { data: options } = await supabase
      .from("hub_poll_options")
      .select("id, label")
      .eq("poll_id", poll.id)
      .order("sort_order", { ascending: true });

    const { data: pollVotes } = await supabase
      .from("hub_poll_votes")
      .select("option_id, user_id")
      .eq("poll_id", poll.id);

    const voteList = pollVotes || [];
    const my = voteList.find((v) => v.user_id === user.id);

    polls.push({
      id: poll.id,
      question: poll.question,
      created_at: poll.created_at,
      my_vote_option_id: my?.option_id ?? null,
      total_votes: voteList.length,
      options: (options || []).map((o) => ({
        id: o.id,
        label: o.label,
        votes: voteList.filter((v) => v.option_id === o.id).length,
      })),
    });
  }

  return <PollsClient userId={user.id} polls={polls} />;
}
