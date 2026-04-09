import { DateTime, Duration } from "luxon";
import type { Ast, DateTimeExpr, Primary, Step, DurationNode, Value } from "./ast.js";
import { assertNever } from "./ast.js";

const COMMON_TIME_ZONE_ALIASES: Record<string, string> = {
  utc: "UTC",
  gmt: "UTC",
  z: "UTC",

  belarus: "Europe/Minsk",
  minsk: "Europe/Minsk",
  vitebsk: "Europe/Minsk",
  viciebsk: "Europe/Minsk",
  brest: "Europe/Minsk",
  gomel: "Europe/Minsk",
  homel: "Europe/Minsk",
  grodno: "Europe/Minsk",
  hrodna: "Europe/Minsk",
  mogilev: "Europe/Minsk",
  mahilyow: "Europe/Minsk",
  pinsk: "Europe/Minsk",
  baranovichi: "Europe/Minsk",
  bobruisk: "Europe/Minsk",
  babruysk: "Europe/Minsk",
  polotsk: "Europe/Minsk",
  novopolotsk: "Europe/Minsk",
  orsha: "Europe/Minsk",
  mozyr: "Europe/Minsk",
  lida: "Europe/Minsk",
  salihorsk: "Europe/Minsk",
  soligorsk: "Europe/Minsk",
  zhodzina: "Europe/Minsk",
  maladzyechna: "Europe/Minsk",
  molodechno: "Europe/Minsk",

  uk: "Europe/London",
  unitedkingdom: "Europe/London",
  britain: "Europe/London",
  england: "Europe/London",
  scotland: "Europe/London",
  wales: "Europe/London",
  ireland: "Europe/Dublin",
  france: "Europe/Paris",
  germany: "Europe/Berlin",
  spain: "Europe/Madrid",
  portugal: "Europe/Lisbon",
  italy: "Europe/Rome",
  netherlands: "Europe/Amsterdam",
  belgium: "Europe/Brussels",
  switzerland: "Europe/Zurich",
  austria: "Europe/Vienna",
  poland: "Europe/Warsaw",
  czechia: "Europe/Prague",
  czechrepublic: "Europe/Prague",
  slovakia: "Europe/Bratislava",
  hungary: "Europe/Budapest",
  romania: "Europe/Bucharest",
  bulgaria: "Europe/Sofia",
  greece: "Europe/Athens",
  turkey: "Europe/Istanbul",
  ukraine: "Europe/Kyiv",
  russia: "Europe/Moscow",
  serbia: "Europe/Belgrade",
  croatia: "Europe/Zagreb",
  slovenia: "Europe/Ljubljana",
  bosnia: "Europe/Sarajevo",
  montenegro: "Europe/Podgorica",
  northmacedonia: "Europe/Skopje",
  albania: "Europe/Tirane",
  norway: "Europe/Oslo",
  sweden: "Europe/Stockholm",
  finland: "Europe/Helsinki",
  denmark: "Europe/Copenhagen",
  iceland: "Atlantic/Reykjavik",
  estonia: "Europe/Tallinn",
  latvia: "Europe/Riga",
  lithuania: "Europe/Vilnius",

  usa: "America/New_York",
  us: "America/New_York",
  unitedstates: "America/New_York",
  canada: "America/Toronto",
  mexico: "America/Mexico_City",
  brazil: "America/Sao_Paulo",
  argentina: "America/Argentina/Buenos_Aires",
  chile: "America/Santiago",
  colombia: "America/Bogota",
  peru: "America/Lima",

  india: "Asia/Kolkata",
  china: "Asia/Shanghai",
  japan: "Asia/Tokyo",
  korea: "Asia/Seoul",
  southkorea: "Asia/Seoul",
  singapore: "Asia/Singapore",
  thailand: "Asia/Bangkok",
  vietnam: "Asia/Ho_Chi_Minh",
  indonesia: "Asia/Jakarta",
  malaysia: "Asia/Kuala_Lumpur",
  philippines: "Asia/Manila",
  taiwan: "Asia/Taipei",
  hongkong: "Asia/Hong_Kong",
  pakistan: "Asia/Karachi",
  bangladesh: "Asia/Dhaka",
  uae: "Asia/Dubai",
  emirates: "Asia/Dubai",
  saudiarabia: "Asia/Riyadh",
  israel: "Asia/Jerusalem",
  iran: "Asia/Tehran",
  iraq: "Asia/Baghdad",
  qatar: "Asia/Qatar",

  egypt: "Africa/Cairo",
  southafrica: "Africa/Johannesburg",
  nigeria: "Africa/Lagos",
  kenya: "Africa/Nairobi",
  morocco: "Africa/Casablanca",
  ethiopia: "Africa/Addis_Ababa",

  australia: "Australia/Sydney",
  newzealand: "Pacific/Auckland",
};

const TIME_ZONE_ALIASES = buildTimeZoneAliases();

export interface EvalOptions {
  defaultZone?: string; // e.g. "Europe/Belgrade" or "Belarus"
}

/**
 * Evaluate AST to a Luxon DateTime wrapped in a Value.
 * The grammar is minimal, so everything evaluates to DateTime.
 */
export function evaluate(ast: Ast, opts: EvalOptions = {}): Value {
  const expr = ast as DateTimeExpr;
  const lastStep = expr.steps[expr.steps.length - 1];

  if (lastStep?.type === "AsFormat") {
    const exprWithoutFormat: DateTimeExpr = { ...expr, steps: expr.steps.slice(0, -1) };
    const dt = evalExpr(exprWithoutFormat, opts.defaultZone);
    return { type: "String", value: dt.toFormat(lastStep.format) };
  }

  const dt = evalExpr(expr, opts.defaultZone);
  return { type: "DateTime", value: dt };
}

function evalExpr(expr: DateTimeExpr, zone?: string): DateTime {
  let dt = evalPrimary(expr.head, zone);
  for (const step of expr.steps) {
    dt = applyStep(dt, step);
  }
  return dt;
}

function evalPrimary(p: Primary, zone?: string): DateTime {
  switch (p.type) {
    case "Now":
      return nowInZone(zone);

    case "Today":
      return nowInZone(zone).startOf("day");

    case "Tomorrow":
      return nowInZone(zone).plus({ days: 1 }).startOf("day");

    case "Yesterday":
      return nowInZone(zone).minus({ days: 1 }).startOf("day");

    case "Literal": {
      const parsed = parseDateString(p.value, zone);
      if (!parsed.isValid) {
        throw new Error(`Invalid date literal: "${p.value}" (${parsed.invalidReason ?? "unknown"})`);
      }
      return parsed;
    }

    case "DateTimeExpr":
      return evalExpr(p, zone);

    default:
      return assertNever(p as never);
  }
}

function applyStep(dt: DateTime, step: Step): DateTime {
  switch (step.type) {
    case "AddSub": {
      const delta = durationToLuxon(step.duration);
      return step.op === "-" ? dt.minus(delta) : dt.plus(delta);
    }

    case "InTZ": {
      const resolvedZone = resolveTimeZone(step.tz);
      const next = dt.setZone(resolvedZone);
      if (!next.isValid) throw new Error(`Invalid time zone: "${step.tz}"`);
      return next;
    }

    case "AsFormat":
      throw new Error(`"as" formatting must be the last step in an expression`);

    default:
      return assertNever(step as never);
  }
}

function durationToLuxon(d: DurationNode): Duration {
  const obj: Record<string, number> = {};
  for (const p of d.parts) {
    switch (p.unit) {
      case "ms": obj.milliseconds = (obj.milliseconds ?? 0) + p.value; break;
      case "s":  obj.seconds      = (obj.seconds ?? 0) + p.value; break;
      case "m":  obj.minutes      = (obj.minutes ?? 0) + p.value; break;
      case "h":  obj.hours        = (obj.hours ?? 0) + p.value; break;
      case "d":  obj.days         = (obj.days ?? 0) + p.value; break;
      case "w":  obj.weeks        = (obj.weeks ?? 0) + p.value; break;
      case "mo": obj.months       = (obj.months ?? 0) + p.value; break;
      case "y":  obj.years        = (obj.years ?? 0) + p.value; break;
      default:
        throw new Error(`Unsupported duration unit: ${p.unit}`);
    }
  }
  return Duration.fromObject(obj);
}

function parseDateString(s: string, zone?: string): DateTime {
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

function nowInZone(zone?: string): DateTime {
  if (!zone) return DateTime.now();

  const resolvedZone = resolveTimeZone(zone);
  const dt = DateTime.now().setZone(resolvedZone);
  return dt.isValid ? dt : DateTime.now();
}

function resolveTimeZone(zone: string): string {
  const candidate = zone.trim();
  if (!candidate) return candidate;

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
