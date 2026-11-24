"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NotificationsBell } from "@/components/NotificationsBell";
import { createClient } from "@/lib/supabase/client";
import { isVipRole, type MemberRole } from "@/lib/types";

const SITE_URL = "https://yatyasassociation.com";

const primaryLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/events", label: "Events" },
  { href: "/members", label: "Members" },
  { href: "/messages", label: "Messages" },
  { href: "/profile", label: "Profile" },
];

const moreLinks = [
  { href: "/chat", label: "Chapter chat" },
  { href: "/albums", label: "Albums" },
  { href: "/polls", label: "Polls" },
  { href: "/card", label: "Member card" },
];

const boardLinks = [
  {
    href: "/board",
    label: "Dashboard",
    hint: "Payments, numbers, seats",
  },
  { href: "/approvals", label: "Roster" },
  {
    href: "/reports",
    label: "Flagged posts",
    hint: "Posts members asked the Board to review",
  },
];

export function HubNav({
  initialRole = null,
  initialTitle = "",
  initialVip = false,
}: {
  initialRole?: MemberRole | null;
  initialTitle?: string;
  initialVip?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const role = initialRole;
  const title = initialTitle;
  const vip = initialVip || isVipRole(role);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function linkClass(href: string, dense = false) {
    const active = pathname.startsWith(href);
    return `${dense ? "px-2 py-1.5 text-xs sm:px-2.5 sm:text-sm" : "block w-full px-3 py-2.5 text-left text-sm"} rounded transition ${
      active
        ? "bg-[var(--olive)] text-[var(--parchment)]"
        : "text-[var(--parchment)]/85 hover:bg-white/10"
    }`;
  }

  return (
    <header className="border-b border-[var(--rule)] bg-[rgba(31,28,24,0.92)] text-[var(--parchment)]">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <a
          href={SITE_URL}
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-md outline-none ring-[var(--gold-soft)] transition hover:opacity-95 focus-visible:ring-2"
          aria-label="YAT-YAS Association website"
          title="Back to YAT-YAS Association website"
        >
          <Image
            src="/crest-transparent.png"
            alt=""
            width={40}
            height={46}
            className="h-9 w-auto shrink-0 sm:h-10"
            priority
          />
          <span className="min-w-0 hidden sm:inline">
            <span className="block font-[family-name:var(--font-display-face)] text-lg leading-tight tracking-wide sm:text-xl">
              YAT-YAS
            </span>
            <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-[var(--gold-soft)] sm:text-xs sm:tracking-[0.18em]">
              Member Hub
              {vip ? (
                <span className="ml-2 rounded bg-[var(--gold)]/25 px-1.5 py-0.5 text-[10px] tracking-[0.12em] text-[var(--gold-soft)]">
                  {title || "VIP"}
                </span>
              ) : null}
            </span>
          </span>
        </a>

        <nav
          className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1"
          aria-label="Hub"
        >
          <div className="hidden min-w-0 items-center gap-0.5 md:flex">
            {primaryLinks.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href, true)}>
                {link.label}
              </Link>
            ))}
          </div>

          <NotificationsBell />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((v) => !v)}
              className={`shrink-0 rounded px-2.5 py-1.5 text-xs sm:text-sm ${
                menuOpen ? "bg-[var(--olive)]" : "hover:bg-white/10"
              }`}
            >
              Menu
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--rule)] bg-[rgba(31,28,24,0.98)] shadow-xl"
              >
                <p className="px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-soft)] md:hidden">
                  Navigate
                </p>
                <div className="flex flex-col py-1 md:hidden">
                  {primaryLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      className={linkClass(link.href)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
                <p className="border-t border-white/10 px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-soft)]">
                  More
                </p>
                <div className="flex flex-col py-1">
                  {moreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      className={linkClass(link.href)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
                {vip ? (
                  <>
                    <p className="border-t border-white/10 px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-soft)]">
                      Board
                    </p>
                    <div className="flex flex-col py-1">
                      {boardLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          role="menuitem"
                          title={"hint" in link ? link.hint : undefined}
                          className={linkClass(link.href)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : null}
                <div className="border-t border-white/10 p-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void signOut()}
                    className="w-full rounded px-3 py-2.5 text-left text-sm text-[var(--parchment)]/70 hover:bg-white/10"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
