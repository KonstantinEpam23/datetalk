import { DateTime } from "luxon";
import type { RelativeAmountExpr } from "../ast.js";

const DIFF_UNIT_MAP = {
  ms: "milliseconds",
  s: "seconds",
  m: "minutes",
  h: "hours",
  d: "days",
  w: "weeks",
  mo: "months",
  y: "years",
} as const;

export function normalizeDiffEndpoints(
  base: DateTime,
  target: DateTime,
  unit: RelativeAmountExpr["unit"],
): [DateTime, DateTime] {
  if (unit === "d" || unit === "w" || unit === "mo" || unit === "y") {
    return [base.startOf("day"), target.startOf("day")];
  }
  return [base, target];
}

export function diffDateTimes(
  base: DateTime,
  target: DateTime,
  unit: RelativeAmountExpr["unit"],
  direction: RelativeAmountExpr["direction"],
): number {
  const luxonUnit = DIFF_UNIT_MAP[unit];
  const diff = direction === "until"
    ? target.diff(base, luxonUnit)
    : base.diff(target, luxonUnit);
  const value = diff.get(luxonUnit) ?? 0;

  if (value > -1 && value < 1) {
    return Number(value.toFixed(2).replace(/\.?0+$/, ""));
  }
  return Math.round(value);
}
