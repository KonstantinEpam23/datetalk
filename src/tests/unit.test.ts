import assert from "node:assert/strict";
import test from "node:test";

import { evaluate, parse, resolveTimeZone } from "../index.js";

test("parses unquoted and multi-word time zones", () => {
  const ast = parse("tomorrow in New York");

  assert.equal(ast.type, "DateTimeExpr");
  assert.equal(ast.head.type, "Tomorrow");
  assert.equal(ast.steps.length, 1);
  assert.deepEqual(ast.steps[0], { type: "InTZ", tz: "New York" });
});

test("evaluates date arithmetic and formatting", () => {
  const result = evaluate(
    parse('"2026-01-28 14:30" + 90m as "yyyy-MM-dd HH:mm"'),
    { defaultZone: "UTC" }
  );

  assert.equal(result.type, "String");
  assert.equal(result.value, "2026-01-28 16:00");
});

test("resolves country and city timezone aliases", () => {
  assert.equal(resolveTimeZone("Belarus"), "Europe/Minsk");
  assert.equal(resolveTimeZone("Los Angeles"), "America/Los_Angeles");
  assert.equal(resolveTimeZone("UTC"), "UTC");
});

test("parses relative amount expressions", () => {
  const ast = parse("days until tomorrow");

  assert.equal(ast.type, "RelativeAmount");
  assert.equal(ast.unit, "d");
  assert.equal(ast.direction, "until");
  assert.equal(ast.target.type, "DateTimeExpr");
  assert.equal(ast.target.head.type, "Tomorrow");
});

test("evaluates until/since expressions to numeric results", () => {
  const untilTomorrow = evaluate(parse("days until tomorrow"));
  const sinceYesterday = evaluate(parse("days since yesterday"));
  const minutesUntilTomorrow = evaluate(parse("minutes until tomorrow"));

  assert.deepEqual(untilTomorrow, { type: "Number", value: 1 });
  assert.deepEqual(sinceYesterday, { type: "Number", value: 1 });

  assert.equal(minutesUntilTomorrow.type, "Number");
  assert.ok(minutesUntilTomorrow.value > 0);
  assert.ok(minutesUntilTomorrow.value <= 24 * 60);
});
