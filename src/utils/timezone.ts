import { DateTime } from "luxon";
import { COMMON_TIME_ZONE_ALIASES } from "./timezone-aliases.js";

const TIME_ZONE_ALIASES = buildTimeZoneAliases();

export function nowInZone(zone?: string): DateTime {
  if (!zone) return DateTime.now();

  const resolvedZone = resolveTimeZone(zone);
  const dt = DateTime.now().setZone(resolvedZone);
  return dt.isValid ? dt : DateTime.now();
}

export function resolveTimeZone(zone: string): string {
  const candidate = zone.trim();
  if (!candidate) return candidate;

  if (candidate.toLowerCase() === "local") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  }

  const direct = DateTime.now().setZone(candidate);
  if (direct.isValid) return candidate;

  const underscoredCandidate = candidate.replace(/\s+/g, "_");
  if (underscoredCandidate !== candidate) {
    const underscored = DateTime.now().setZone(underscoredCandidate);
    if (underscored.isValid) return underscoredCandidate;
  }

  return TIME_ZONE_ALIASES.get(normalizeTimeZoneKey(candidate)) ?? candidate;
}

function buildTimeZoneAliases(): Map<string, string> {
  const map = new Map<string, string>();
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  }).supportedValuesOf;

  const knownZones = typeof supportedValuesOf === "function"
    ? supportedValuesOf.call(Intl, "timeZone")
    : [];

  for (const zone of knownZones) {
    addTimeZoneAlias(map, zone, zone);

    const parts = zone.split("/");
    const trailingPath = parts.slice(1).join("/");
    const leaf = parts[parts.length - 1];

    if (trailingPath) {
      addTimeZoneAlias(map, trailingPath, zone);
      addTimeZoneAlias(map, trailingPath.replace(/_/g, " "), zone);
    }

    addTimeZoneAlias(map, leaf, zone);
    addTimeZoneAlias(map, leaf.replace(/_/g, " "), zone);
  }

  for (const [alias, zone] of Object.entries(COMMON_TIME_ZONE_ALIASES)) {
    addTimeZoneAlias(map, alias, zone);
  }

  return map;
}

function addTimeZoneAlias(map: Map<string, string>, alias: string, zone: string): void {
  const key = normalizeTimeZoneKey(alias);
  if (key) map.set(key, zone);
}

function normalizeTimeZoneKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}
