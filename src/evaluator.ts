import { DateTime, Duration } from "luxon";
import type { Ast, DateTimeExpr, Primary, Step, DurationNode, RelativeAmountExpr, Value } from "./ast.js";
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
    const dt = evalExpr(exprWithoutFormat, opts.defaultZone);
    return { type: "String", value: dt.toFormat(lastStep.format) };
  }

  const dt = evalExpr(ast, opts.defaultZone);
  return { type: "DateTime", value: dt };
}

function evalExpr(expr: DateTimeExpr, zone?: string): DateTime {
  let dt = evalPrimary(expr.head, zone);
  for (const step of expr.steps) {
    dt = applyStep(dt, step);
  }
  return dt;
}

function evaluateRelativeAmount(expr: RelativeAmountExpr, opts: EvalOptions): Value {
  const base = nowInZone(opts.defaultZone);
  const target = evalExpr(expr.target, opts.defaultZone);
  const [normalizedBase, normalizedTarget] = normalizeDiffEndpoints(base, target, expr.unit);
  const diffValue = diffDateTimes(normalizedBase, normalizedTarget, expr.unit, expr.direction);

  return { type: "Number", value: diffValue };
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



