import type { MemberRole } from "@/lib/types";

export function isApprovedMember(profile: {
  chapter?: string | null;
  role?: MemberRole | string | null;
} | null | undefined) {
  if (!profile) return false;
  if (profile.role === "vip" || profile.role === "president") return true;
  return profile.chapter === "MEMBER";
}
