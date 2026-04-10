import { DateTime } from "luxon";

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
  | { type: "Literal"; kind: "string"; value: string }
  | DateTimeExpr; // parentheses return Expr directly

export type Step = AddStep | InTzStep | AsFormatStep;

export interface AddStep {
  type: "AddSub";
  op: "+" | "-";
  duration: DurationNode;
}

export interface InTzStep {
  type: "InTZ";
  tz: string;
}

export interface AsFormatStep {
  type: "AsFormat";
  format: string;
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

export type Value =
  | { type: "DateTime"; value: DateTime }
  | { type: "String"; value: string }
  | { type: "Number"; value: number };

export function assertNever(x: never): never {
  throw new Error(`Unexpected: ${JSON.stringify(x)}`);
}
