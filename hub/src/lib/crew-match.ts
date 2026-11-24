export type CrewFields = {
  unit?: string | null;
  preferred_unit?: string | null;
  platform?: string | null;
  station?: string | null;
  years?: string | null;
  years_start?: number | null;
  years_end?: number | null;
};

export type SafeMatch = {
  display_name: string;
  unit: string | null;
  years: string | null;
  platform: string | null;
  station: string | null;
  score: number;
  overlap: string[];
};

function clean(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeUnit(raw: string | null | undefined): string {
  const v = clean(raw);
  if (!v) return "";
  if (/\b2d\b|\b2nd\b|second\s+aab|2\s*aab/.test(v)) return "2d";
  if (/\b3d\b|\b3rd\b|third\s+aab|3\s*aab/.test(v)) return "3d";
  if (/\b4th\b|\b4d\b|fourth\s+aab|4\s*aab/.test(v)) return "4th";
  if (/alligator|tracks|aav|amtrac|acv|lvt/.test(v)) return "tracks";
  return v.slice(0, 40);
}

export function normalizePlatform(raw: string | null | undefined): string {
  const v = clean(raw);
  if (!v) return "";
  if (/\baav\b|aavp|aav-?7|amtrac/.test(v)) return "aav";
  if (/\bacv\b/.test(v)) return "acv";
  if (/\blvtp?\b|lvt-/.test(v)) return "lvt";
  if (/\befv\b/.test(v)) return "efv";
  return v.slice(0, 40);
}

export function normalizeStation(raw: string | null | undefined): string {
  const v = clean(raw);
  if (!v) return "";
  if (/pendleton|camp\s*pendleton|mcb\s*camp\s*pendleton/.test(v)) {
    return "pendleton";
  }
  if (/lejeune|camp\s*lejeune/.test(v)) return "lejeune";
  if (/okinawa|camp\s*schwab|camp\s*hansen/.test(v)) return "okinawa";
  if (/hawaii|kanehoe|mcbh/.test(v)) return "hawaii";
  if (/quantico/.test(v)) return "quantico";
  if (/29\s*palms|twentynine/.test(v)) return "29palms";
  return v.slice(0, 60);
}

export function parseYears(raw: string | null | undefined): {
  start: number | null;
  end: number | null;
} {
  const text = String(raw || "");
  const years = Array.from(text.matchAll(/\b(19|20)\d{2}\b/g)).map((m) =>
    Number(m[0]),
  );
  if (!years.length) return { start: null, end: null };
  const start = Math.min(...years);
  const end = Math.max(...years);
  return { start, end };
}

export function firstDisplayName(fullName: string): string {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "Crewmate";
  const first = parts[0];
  const lastInitial =
    parts.length > 1 ? ` ${parts[parts.length - 1][0]?.toUpperCase()}.` : "";
  return `${first}${lastInitial}`;
}

export function enrichNorms(fields: CrewFields) {
  const unitSource = fields.unit || fields.preferred_unit || "";
  const years = parseYears(fields.years);
  return {
    unit_norm: normalizeUnit(unitSource) || null,
    platform_norm: normalizePlatform(fields.platform) || null,
    station_norm: normalizeStation(fields.station) || null,
    years_start: years.start,
    years_end: years.end,
  };
}

function yearsOverlap(
  aStart: number | null | undefined,
  aEnd: number | null | undefined,
  bStart: number | null | undefined,
  bEnd: number | null | undefined,
): boolean {
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) {
    return false;
  }
  return aStart <= bEnd && bStart <= aEnd;
}

export function scoreMatch(
  query: {
    unit_norm?: string | null;
    platform_norm?: string | null;
    station_norm?: string | null;
    years_start?: number | null;
    years_end?: number | null;
  },
  candidate: {
    unit_norm?: string | null;
    platform_norm?: string | null;
    station_norm?: string | null;
    years_start?: number | null;
    years_end?: number | null;
    unit?: string | null;
    years?: string | null;
    platform?: string | null;
    station?: string | null;
    full_name?: string | null;
  },
): SafeMatch | null {
  let score = 0;
  const overlap: string[] = [];

  if (query.unit_norm && candidate.unit_norm) {
    if (query.unit_norm === candidate.unit_norm) {
      score += 40;
      overlap.push("unit");
    } else if (
      query.unit_norm === "tracks" ||
      candidate.unit_norm === "tracks"
    ) {
      score += 18;
      overlap.push("tracks community");
    }
  }

  if (
    query.platform_norm &&
    candidate.platform_norm &&
    query.platform_norm === candidate.platform_norm
  ) {
    score += 25;
    overlap.push("platform");
  }

  if (
    yearsOverlap(
      query.years_start,
      query.years_end,
      candidate.years_start,
      candidate.years_end,
    )
  ) {
    score += 20;
    overlap.push("years");
  }

  if (
    query.station_norm &&
    candidate.station_norm &&
    query.station_norm === candidate.station_norm
  ) {
    score += 15;
    overlap.push("station");
  }

  if (score < 40) return null;

  return {
    display_name: firstDisplayName(candidate.full_name || "Crewmate"),
    unit: candidate.unit || null,
    years: candidate.years || null,
    platform: candidate.platform || null,
    station: candidate.station || null,
    score,
    overlap,
  };
}
