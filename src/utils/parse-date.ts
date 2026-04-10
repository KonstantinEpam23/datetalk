import { DateTime } from "luxon";
import { resolveTimeZone } from "./timezone.js";

export function parseDateString(s: string, zone?: string): DateTime {
  const resolvedZone = zone ? resolveTimeZone(zone) : undefined;
  const candidates: DateTime[] = [];

  // ISO: "2026-01-28" or "2026-01-28T14:30"
  candidates.push(resolvedZone ? DateTime.fromISO(s, { zone: resolvedZone }) : DateTime.fromISO(s));

  // Common: "2026-01-28 14:30"
  candidates.push(
    resolvedZone
      ? DateTime.fromFormat(s, "yyyy-MM-dd HH:mm", { zone: resolvedZone })
      : DateTime.fromFormat(s, "yyyy-MM-dd HH:mm")
  );

  for (const dt of candidates) {
    if (dt.isValid) return dt;
  }

  return candidates[0];
}
