import { DateTime, Duration } from "luxon";
import type { Ast, DateTimeExpr, Primary, Step, DurationNode, RelativeAmountExpr, Value, TimezoneInfo } from "./ast.js";
import { assertNever } from "./utils/assert-never.js";
import { nowInZone, resolveTimeZone } from "./utils/timezone.js";
import { parseDateString } from "./utils/parse-date.js";
import { normalizeDiffEndpoints, diffDateTimes } from "./utils/diff.js";

export interface EvalOptions {
  defaultZone?: string; // e.g. "Europe/Belgrade" or "Belarus"
}

/**
 * Evaluate AST to a Luxon DateTime wrapped in a Value.
 * The grammar is minimal, so everything evaluates to DateTime.
 */
export function evaluate(ast: Ast, opts: EvalOptions = {}): Value {
  if (ast.type === "RelativeAmount") {
    return evaluateRelativeAmount(ast, opts);
  }

  const lastStep = ast.steps[ast.steps.length - 1];

  if (lastStep?.type === "AsFormat") {
    const exprWithoutFormat: DateTimeExpr = { ...ast, steps: ast.steps.slice(0, -1) };
    const { dt, tz } = evalExpr(exprWithoutFormat, opts.defaultZone);
    return { type: "String", value: dt.toFormat(lastStep.format), ...maybeTz(tz) };
  }

  const { dt, tz } = evalExpr(ast, opts.defaultZone);
  return { type: "DateTime", value: dt, ...maybeTz(tz) };
}

interface ExprResult {
  dt: DateTime;
  tz: TimezoneInfo;
}

function evalExpr(expr: DateTimeExpr, zone?: string, relativeDir?: "until" | "since"): ExprResult {
  let dt = evalPrimary(expr.head, zone, relativeDir);
  const tz: TimezoneInfo = {};
  for (const step of expr.steps) {
    if (step.type === "InTZ") {
      tz.conversion = resolveTimeZone(step.tz);
    } else if (step.type === "ToTZ") {
      tz.representation = resolveTimeZone(step.tz);
    }
    dt = applyStep(dt, step);
  }
  return { dt, tz };
}

function evaluateRelativeAmount(expr: RelativeAmountExpr, opts: EvalOptions): Value {
  const base = nowInZone(opts.defaultZone);
  const { dt: target, tz } = evalExpr(expr.target, opts.defaultZone, expr.direction);
  const [normalizedBase, normalizedTarget] = normalizeDiffEndpoints(base, target, expr.unit);
  const diffValue = diffDateTimes(normalizedBase, normalizedTarget, expr.unit, expr.direction);

  return { type: "Number", value: diffValue, ...maybeTz(tz) };
}

function maybeTz(tz: TimezoneInfo): { tz: TimezoneInfo } | {} {
  return tz.conversion || tz.representation ? { tz } : {};
}

function evalPrimary(p: Primary, zone?: string, relativeDir?: "until" | "since"): DateTime {
  switch (p.type) {
    case "Now":
      return nowInZone(zone);

    case "Today":
      return nowInZone(zone).startOf("day");

    case "Tomorrow":
      return nowInZone(zone).plus({ days: 1 }).startOf("day");

    case "Yesterday":
      return nowInZone(zone).minus({ days: 1 }).startOf("day");

    case "Midnight": {
      const startOfDay = nowInZone(zone).startOf("day");
      if (relativeDir === "until") return startOfDay.plus({ days: 1 });
      return startOfDay; // "since" or standalone → today 00:00
    }

    case "Midday": {
      const now = nowInZone(zone);
      const todayNoon = now.startOf("day").set({ hour: 12 });
      if (relativeDir === "until") return now >= todayNoon ? todayNoon.plus({ days: 1 }) : todayNoon;
      if (relativeDir === "since") return now >= todayNoon ? todayNoon : todayNoon.minus({ days: 1 });
      return todayNoon; // standalone
    }

    case "WeekdayRef": {
      const dir = p.direction === "nearest" && relativeDir
        ? (relativeDir === "until" ? "next" : "last")
        : p.direction;
      return resolveWeekdayRef(p.name, dir, zone);
    }

    case "MonthRef": {
      const dir = p.direction === "nearest" && relativeDir
        ? (relativeDir === "until" ? "next" : "last")
        : p.direction;
      return resolveMonthRef(p.name, dir, zone);
    }

    case "Literal": {
      const parsed = parseDateString(p.value, zone);
      if (!parsed.isValid) {
        throw new Error(`Invalid date literal: "${p.value}" (${parsed.invalidReason ?? "unknown"})`);
      }
      return parsed;
    }

    case "DateTimeExpr":
      return evalExpr(p, zone).dt;

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
      // "in <tz>" = qualify: the wall-clock time IS in that zone
      const resolved = resolveTimeZone(step.tz);
      const next = dt.setZone(resolved, { keepLocalTime: true });
      if (!next.isValid) throw new Error(`Invalid time zone: "${step.tz}"`);
      return next;
    }

    case "ToTZ": {
      // "to/into <tz>" = display: same instant, shown in that zone
      const resolved = resolveTimeZone(step.tz);
      const next = dt.setZone(resolved);
      if (!next.isValid) throw new Error(`Invalid time zone: "${step.tz}"`);
      return next;
    }

    case "AtTime":
      return dt.set({ hour: step.time.hh, minute: step.time.mm, second: step.time.ss, millisecond: 0 });

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

const WEEKDAY_INDEX: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
  Friday: 5, Saturday: 6, Sunday: 7,
};

function resolveWeekdayRef(name: string, direction: "next" | "last" | "nearest", zone?: string): DateTime {
  const today = nowInZone(zone).startOf("day");
  const todayDow = today.weekday; // 1=Mon .. 7=Sun
  const targetDow = WEEKDAY_INDEX[name];
  if (!targetDow) throw new Error(`Unknown weekday: "${name}"`);

  const daysAhead = ((targetDow - todayDow) % 7 + 7) % 7;
  const daysBehind = ((todayDow - targetDow) % 7 + 7) % 7;

  switch (direction) {
    case "next":
      return today.plus({ days: daysAhead === 0 ? 7 : daysAhead });
    case "last":
      return today.minus({ days: daysBehind === 0 ? 7 : daysBehind });
    case "nearest":
      // today counts as "nearest"
      if (daysAhead === 0) return today;
      return daysAhead <= 3 ? today.plus({ days: daysAhead }) : today.minus({ days: daysBehind });
  }
}

const MONTH_INDEX: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

function resolveMonthRef(name: string, direction: "next" | "last" | "nearest", zone?: string): DateTime {
  const today = nowInZone(zone).startOf("day");
  const currentMonth = today.month; // 1–12
  const targetMonth = MONTH_INDEX[name];
  if (!targetMonth) throw new Error(`Unknown month: "${name}"`);

  const monthsAhead = ((targetMonth - currentMonth) % 12 + 12) % 12;
  const monthsBehind = ((currentMonth - targetMonth) % 12 + 12) % 12;

  let result: DateTime;
  switch (direction) {
    case "next":
      result = today.plus({ months: monthsAhead === 0 ? 12 : monthsAhead });
      break;
    case "last":
      result = today.minus({ months: monthsBehind === 0 ? 12 : monthsBehind });
      break;
    case "nearest":
      if (monthsAhead === 0) {
        result = today;
      } else {
        result = monthsAhead <= 6 ? today.plus({ months: monthsAhead }) : today.minus({ months: monthsBehind });
      }
      break;
  }
  return result.set({ day: 1 }).startOf("day");
}



