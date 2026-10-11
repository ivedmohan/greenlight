export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  if (maxLen <= 3) return s.slice(0, maxLen);
  return s.slice(0, maxLen - 3) + "...";
}
