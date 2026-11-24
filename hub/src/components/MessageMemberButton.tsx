"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function MessageMemberButton({
  otherUserId,
  label = "Message",
}: {
  otherUserId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("get_or_create_dm", {
      other_user_id: otherUserId,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const threadId = data as string;
    router.push(`/messages?thread=${threadId}`);
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="rounded-lg bg-[var(--olive-deep)] px-4 py-2 text-sm font-semibold text-[var(--parchment)] disabled:opacity-50"
      >
        {busy ? "Opening…" : label}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
