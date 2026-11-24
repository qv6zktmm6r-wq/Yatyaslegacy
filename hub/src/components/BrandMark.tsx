import Image from "next/image";

const SITE_URL = "https://yatyasassociation.com";

export function BrandMark({
  subtitle = "Member Hub",
}: {
  subtitle?: string;
}) {
  return (
    <a
      href={SITE_URL}
      className="inline-flex items-center gap-3 outline-none ring-[var(--olive)] focus-visible:ring-2"
      aria-label="YAT-YAS Association website"
      title="Back to YAT-YAS Association website"
    >
      <Image
        src="/crest-20261124.png"
        alt=""
        width={44}
        height={52}
        className="h-11 w-auto"
        priority
      />
      <span>
        <span className="block font-[family-name:var(--font-display-face)] text-3xl text-[var(--charcoal)]">
          YAT-YAS
        </span>
        <span className="block text-sm text-[var(--ink-soft)]">{subtitle}</span>
      </span>
    </a>
  );
}
