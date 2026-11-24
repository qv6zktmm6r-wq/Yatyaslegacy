"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

type StatusPayload = {
  ok: boolean;
  status?: string;
  membershipTag?: string | null;
  note?: string;
  error?: string;
};

function SuccessInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const maxAttempts = 45; // ~90s at 2s interval

    async function poll() {
      attempt += 1;
      const res = await fetch(
        `/api/stripe/session-status?session_id=${encodeURIComponent(sessionId!)}`,
      );
      const data = (await res.json()) as StatusPayload;
      if (cancelled) return;
      setPayload(data);
      setTries(attempt);
      const terminal =
        data.status === "issued" || data.status === "unpaid";
      if (!terminal && attempt < maxAttempts) {
        timer = setTimeout(poll, 2000);
      } else if (!terminal && attempt >= maxAttempts) {
        setPayload({
          ok: false,
          status: "pending",
          note: "Still processing. Check your email or contact board@yatyasassociation.com — your number will not be lost.",
        });
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  const tag = payload?.membershipTag;
  const issued = payload?.status === "issued" && !!tag;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <BrandMark subtitle="First Wave payment" />
      <div className="rounded-xl border border-[var(--rule)] bg-white p-6 shadow-sm">
        {!sessionId ? (
          <p className="text-sm text-red-700">Missing Checkout session.</p>
        ) : issued ? (
          <>
            <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
              You&apos;re on the roll
            </h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Your membership number is ready. Create your Hub login with the
              same email and name so the Association recognizes you.
            </p>
            <p className="mt-4 font-[family-name:var(--font-display-face)] text-3xl tracking-wide text-[var(--olive)]">
              {tag}
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex rounded-md bg-[var(--olive)] px-4 py-2 text-sm font-semibold text-white"
            >
              Create Hub login
            </Link>
          </>
        ) : payload?.status === "unpaid" ? (
          <p className="text-sm text-red-700">
            Payment was not completed. You can try Checkout again from the First
            Wave page.
          </p>
        ) : (
          <>
            <h1 className="font-[family-name:var(--font-display-face)] text-2xl text-[var(--charcoal)]">
              Issuing your number…
            </h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {payload?.note ||
                "Payment received. Your membership number is assigned automatically in order — this page does not invent a temporary tag."}
            </p>
            <p className="mt-4 text-xs text-[var(--ink-soft)]">
              Checking{tries > 0 ? ` (${tries})` : ""}…
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function PaySuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-4 py-16 text-sm text-[var(--ink-soft)]">
          Loading…
        </main>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
