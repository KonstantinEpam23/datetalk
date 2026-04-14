import type { DateTime } from "luxon";

export type Ast = DateTimeExpr | RelativeAmountExpr;

export interface DateTimeExpr {
  type: "DateTimeExpr";
  head: Primary;
  steps: Step[];
}

export interface RelativeAmountExpr {
  type: "RelativeAmount";
  unit: DurationPartNode["unit"];
  direction: "until" | "since";
  target: DateTimeExpr;
}

export type Primary =
  | { type: "Now" }
  | { type: "Today" }
  | { type: "Tomorrow" }
  | { type: "Yesterday" }
  | { type: "Midnight" }
  | { type: "Midday" }
  | { type: "WeekdayRef"; name: string; direction: "next" | "last" | "nearest" }
  | { type: "MonthRef"; name: string; direction: "next" | "last" | "nearest" }
  | { type: "Literal"; kind: "string"; value: string }
  | DateTimeExpr; // parentheses return Expr directly

export type Step = AddStep | InTzStep | ToTzStep | AsFormatStep | AtTimeStep;

export interface AddStep {
  type: "AddSub";
  op: "+" | "-";
  duration: DurationNode;
}

export interface InTzStep {
  type: "InTZ";
  tz: string;
}

export interface ToTzStep {
  type: "ToTZ";
  tz: string;
}

export interface AsFormatStep {
  type: "AsFormat";
  format: string;
}

export interface AtTimeStep {
  type: "AtTime";
  time: { hh: number; mm: number; ss: number };
}

export interface DurationNode {
  type: "Duration";
  parts: DurationPartNode[];
}

export interface DurationPartNode {
  type: "DurationPart";
  value: number;
  unit: "ms" | "s" | "m" | "h" | "d" | "w" | "mo" | "y";
}

export interface TimezoneInfo {
  /** The zone the wall-clock time was qualified/interpreted in ("in <tz>") */
  conversion?: string;
  /** The zone the result is displayed in ("to/into <tz>") */
  representation?: string;
}

export type Value =
  | { type: "DateTime"; value: DateTime; tz?: TimezoneInfo }
  | { type: "String"; value: string; tz?: TimezoneInfo }
  | { type: "Number"; value: number; tz?: TimezoneInfo };
