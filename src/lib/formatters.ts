// Form-value sanitization (Section 3.8): trim whitespace and strip leading /
// trailing single or double quotes. Required before any value reaches a spawned
// process — Windows "Copy as path" wraps paths in literal quote chars.
export function sanitizeFormValue(raw: string): string {
  if (raw == null) return "";
  return raw.trim().replace(/^["']|["']$/g, "");
}

export function sanitizeFormValues(
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = sanitizeFormValue(v);
  }
  return out;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function tierColor(tier: string): string {
  switch (tier) {
    case "Tier 1":
      return "text-rr-tier1";
    case "Tier 2":
      return "text-rr-tier2";
    case "Tier 3":
      return "text-rr-tier3";
    case "Tier 4":
      return "text-rr-tier4";
    default:
      return "text-rr-subtle";
  }
}

export function tierBadgeClass(tier: string): string {
  switch (tier) {
    case "Tier 1":
      return "border-rr-tier1/30 bg-rr-accentSoft text-rr-tier1";
    case "Tier 2":
      return "border-rr-tier2/30 bg-[#f6f0ff] text-rr-tier2";
    case "Tier 3":
      return "border-rr-tier3/30 bg-[#dafbe1] text-rr-tier3";
    case "Tier 4":
      return "border-rr-tier4/30 bg-[#fff1e5] text-rr-tier4";
    default:
      return "border-rr-hairline bg-rr-surfaceAlt text-rr-subtle";
  }
}
