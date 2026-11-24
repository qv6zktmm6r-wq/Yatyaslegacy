export function MembershipTag({
  tag,
  size = "sm",
}: {
  tag?: string | null;
  size?: "sm" | "md";
}) {
  if (!tag) return null;
  const classes =
    size === "md"
      ? "px-2.5 py-1 text-xs"
      : "px-1.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center rounded border border-[var(--gold)]/50 bg-[rgba(176,141,62,0.12)] font-semibold tracking-wider text-[var(--olive-deep)] ${classes}`}
      title="First Wave membership tag"
    >
      {tag}
    </span>
  );
}
