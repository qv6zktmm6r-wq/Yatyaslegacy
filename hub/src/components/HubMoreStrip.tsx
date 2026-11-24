import Link from "next/link";

const links = [
  { href: "/albums", label: "Albums" },
  { href: "/polls", label: "Polls" },
  { href: "/card", label: "Member card" },
  { href: "/events", label: "Events" },
];

export function HubMoreStrip() {
  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-[var(--rule)] bg-[rgba(255,252,245,0.7)] px-3 py-2"
      aria-label="More hub sections"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
        More
      </span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="rounded-full border border-[var(--rule)] bg-white/80 px-3 py-1 text-xs font-medium text-[var(--olive-deep)] hover:bg-[rgba(90,99,72,0.12)]"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
