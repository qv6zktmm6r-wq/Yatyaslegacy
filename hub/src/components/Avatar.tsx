export function Avatar({
  url,
  name,
  size = 40,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
}) {
  const initial = (name || "M").trim().charAt(0).toUpperCase();
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full bg-[var(--olive-deep)] text-[var(--parchment)]"
      style={{ width: size, height: size }}
      aria-hidden={!url}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-semibold"
          style={{ fontSize: Math.max(12, size * 0.38) }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
