export async function requestWelcomeEmail(input: {
  email: string;
  displayName: string;
  membershipTag: string;
  dryRun?: boolean;
}) {
  const res = await fetch("/api/welcome-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    mode?: string;
    error?: string;
    id?: string;
  };
  if (!res.ok || data.ok === false) {
    return {
      ok: false as const,
      error: data.error || `HTTP ${res.status}`,
    };
  }
  return {
    ok: true as const,
    mode: data.mode || "unknown",
    id: data.id,
  };
}
