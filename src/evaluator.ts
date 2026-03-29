import { DateTime, Duration } from "luxon";
import type { Ast, DateTimeExpr, Primary, Step, DurationNode, Value } from "./ast.js";
import { assertNever } from "./ast.js";

export interface EvalOptions {
  defaultZone?: string; // e.g. "Europe/Belgrade"
}

/**
 * Evaluate AST to a Luxon DateTime wrapped in a Value.
 * The grammar is minimal, so everything evaluates to DateTime.
 */
export function evaluate(ast: Ast, opts: EvalOptions = {}): Value {
  const dt = evalExpr(ast as DateTimeExpr, opts.defaultZone);
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
      return zone ? DateTime.now().setZone(zone) : DateTime.now();

    case "Today": {
      const base = zone ? DateTime.now().setZone(zone) : DateTime.now();
      return base.startOf("day");
    }

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
    case "AddSub":
      return dt.plus(durationToLuxon(step.duration));

    case "InTZ": {
      const next = dt.setZone(step.tz);
      if (!next.isValid) throw new Error(`Invalid time zone: "${step.tz}"`);
      return next;
    }

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
      default:
        throw new Error(`Unsupported duration unit: ${p.unit}`);
    }
  }
  return Duration.fromObject(obj);
}

function parseDateString(s: string, zone?: string): DateTime {
  const candidates: DateTime[] = [];

  // ISO: "2026-01-28" or "2026-01-28T14:30"
  candidates.push(zone ? DateTime.fromISO(s, { zone }) : DateTime.fromISO(s));

  // Common: "2026-01-28 14:30"
  candidates.push(zone ? DateTime.fromFormat(s, "yyyy-MM-dd HH:mm", { zone }) : DateTime.fromFormat(s, "yyyy-MM-dd HH:mm"));

  for (const dt of candidates) {
    if (dt.isValid) return dt;
  }

  return candidates[0];
}
