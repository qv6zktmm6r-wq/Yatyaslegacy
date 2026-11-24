/** Extract distinct FW-### tags from free text (case-insensitive). */
export function extractFwTags(text: string): string[] {
  const found = new Set<string>();
  const re = /FW-(\d{3})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(`FW-${m[1]}`);
  }
  return [...found];
}
