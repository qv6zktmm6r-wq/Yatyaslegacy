import {
  firstWaveWelcomeHtml,
  firstWaveWelcomeSubject,
  firstWaveWelcomeText,
  type FirstWaveWelcomeProps,
} from "@/emails/firstWaveWelcome";

export type SendWelcomeResult =
  | { ok: true; mode: "sent"; id: string }
  | { ok: true; mode: "dry-run"; htmlLength: number }
  | { ok: false; error: string };

const DEFAULT_FROM = "YAT-YAS Association <board@yatyasassociation.com>";

export function hubSignupUrl() {
  const base =
    process.env.NEXT_PUBLIC_HUB_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://hub.yatyasassociation.com";
  return `${base.replace(/\/$/, "")}/signup`;
}

export async function sendFirstWaveWelcomeEmail(input: {
  to: string;
  displayName: string;
  membershipTag: string;
  hubSignupUrl?: string;
  forceDryRun?: boolean;
}): Promise<SendWelcomeResult> {
  const props: FirstWaveWelcomeProps = {
    displayName: input.displayName.trim() || "Member",
    membershipTag: input.membershipTag.trim(),
    hubSignupUrl: input.hubSignupUrl || hubSignupUrl(),
  };

  if (!props.membershipTag) {
    return { ok: false, error: "Missing membership tag" };
  }

  const html = firstWaveWelcomeHtml(props);
  const text = firstWaveWelcomeText(props);
  const subject = firstWaveWelcomeSubject(props.membershipTag);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || input.forceDryRun) {
    return { ok: true, mode: "dry-run", htmlLength: html.length };
  }

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      html,
      text,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.message || body.message || `Resend HTTP ${res.status}`,
    };
  }

  return { ok: true, mode: "sent", id: body.id || "unknown" };
}

/** Ops ping to board@ when someone pays and gets a number. */
export async function sendBoardPaidMemberAlert(input: {
  displayName: string;
  email: string;
  membershipTag: string;
  amountCents: number;
  currency?: string;
}): Promise<SendWelcomeResult> {
  const to = process.env.BOARD_ALERT_EMAIL || "board@yatyasassociation.com";
  const amount = ((input.amountCents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: (input.currency || "usd").toUpperCase(),
  });
  const subject = `Paid + numbered: ${input.membershipTag} — ${input.displayName}`;
  const text = [
    "New First Wave entrance payment cleared.",
    "",
    `Name: ${input.displayName}`,
    `Email: ${input.email}`,
    `Membership number: ${input.membershipTag}`,
    `Amount: ${amount}`,
    "",
    "Number was issued automatically in order. Tag is permanent (not recycled on refund).",
  ].join("\n");
  const html = `<p><strong>New First Wave entrance payment cleared.</strong></p>
<ul>
<li>Name: ${escapeHtml(input.displayName)}</li>
<li>Email: ${escapeHtml(input.email)}</li>
<li>Membership number: <strong>${escapeHtml(input.membershipTag)}</strong></li>
<li>Amount: ${escapeHtml(amount)}</li>
</ul>
<p>Number was issued automatically in order. Tag is permanent (not recycled on refund).</p>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: true, mode: "dry-run", htmlLength: html.length };
  }

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.message || body.message || `Resend HTTP ${res.status}`,
    };
  }

  return { ok: true, mode: "sent", id: body.id || "unknown" };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
