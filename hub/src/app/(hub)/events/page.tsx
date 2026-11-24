import { redirect } from "next/navigation";
import { EventsClient } from "@/components/EventsClient";
import { createClient } from "@/lib/supabase/server";
import type { HubEvent, HubEventRsvp } from "@/lib/types";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: events } = await supabase
    .from("hub_events")
    .select("*")
    .order("starts_at", { ascending: true });

  const eventIds = (events || []).map((e) => e.id);
  let rsvps: HubEventRsvp[] = [];
  if (eventIds.length > 0) {
    const { data: rows } = await supabase
      .from("hub_event_rsvps")
      .select("*")
      .in("event_id", eventIds);
    rsvps = (rows as HubEventRsvp[]) || [];
  }

  return (
    <EventsClient
      userId={user.id}
      initialEvents={(events as HubEvent[]) || []}
      initialRsvps={rsvps}
    />
  );
}
