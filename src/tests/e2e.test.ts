import assert from "node:assert/strict";
import test from "node:test";
import { DateTime, Settings } from "luxon";

import { evaluate, parse } from "../index.js";

/**
 * Stub Luxon's "now" so every test is fully deterministic.
 * Pinned to 2026-04-10T12:00:00 UTC.
 */
const STUB_NOW = DateTime.fromISO("2026-04-10T12:00:00.000Z", { zone: "UTC" });

test("e2e: setup stub clock", () => {
  Settings.now = () => STUB_NOW.toMillis();
});

// ── Basic expressions ────────────────────────────────────────────

test("e2e: 'now' returns the stubbed time", () => {
  const result = evaluate(parse("now"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T12:00:00.000Z");
});

test("e2e: 'today' returns start of the stubbed day", () => {
  const result = evaluate(parse("today"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T00:00:00.000Z");
});

test("e2e: 'tomorrow' returns start of the next day", () => {
  const result = evaluate(parse("tomorrow"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-11T00:00:00.000Z");
});

test("e2e: 'yesterday' returns start of the previous day", () => {
  const result = evaluate(parse("yesterday"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-09T00:00:00.000Z");
});

// ── Arithmetic ───────────────────────────────────────────────────

test("e2e: 'now + 2h' adds hours", () => {
  const result = evaluate(parse("now + 2h"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T14:00:00.000Z");
});

test("e2e: 'now - 30m' subtracts minutes", () => {
  const result = evaluate(parse("now - 30m"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T11:30:00.000Z");
});

test("e2e: 'now + 1d 6h' compound duration", () => {
  const result = evaluate(parse("now + 1d 6h"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-11T18:00:00.000Z");
});

test("e2e: 'today + 3w' adds weeks", () => {
  const result = evaluate(parse("today + 3w"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-05-01T00:00:00.000Z");
});

test("e2e: 'today + 1mo' adds a month", () => {
  const result = evaluate(parse("today + 1mo"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-05-10T00:00:00.000Z");
});

test("e2e: 'today + 1y' adds a year", () => {
  const result = evaluate(parse("today + 1y"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2027-04-10T00:00:00.000Z");
});

// ── Timezone conversion ──────────────────────────────────────────

test("e2e: 'now in Tokyo' converts timezone", () => {
  const result = evaluate(parse("now in Tokyo"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T21:00:00.000+09:00");
});

test("e2e: 'now in New York' converts to US Eastern", () => {
  const result = evaluate(parse("now in New York"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  // EDT (UTC-4) in April
  assert.equal(result.value.toISO(), "2026-04-10T08:00:00.000-04:00");
});

test("e2e: 'now in Belarus' converts to Minsk time", () => {
  const result = evaluate(parse("now in Belarus"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T15:00:00.000+03:00");
});

// ── Formatting ───────────────────────────────────────────────────

test("e2e: 'now as \"yyyy-MM-dd\"' formats date", () => {
  const result = evaluate(parse('now as "yyyy-MM-dd"'), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "String", value: "2026-04-10" });
});

test("e2e: 'now + 2h 30m as \"HH:mm\"' arithmetic then format", () => {
  const result = evaluate(parse('now + 2h 30m as "HH:mm"'), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "String", value: "14:30" });
});

test("e2e: 'tomorrow in Tokyo as \"yyyy-MM-dd HH:mm\"'", () => {
  const result = evaluate(
    parse('tomorrow in Tokyo as "yyyy-MM-dd HH:mm"'),
    { defaultZone: "UTC" },
  );
  // tomorrow UTC = 2026-04-11T00:00:00Z → Tokyo (+9) = 2026-04-11T09:00
  assert.deepEqual(result, { type: "String", value: "2026-04-11 09:00" });
});

// ── Date literals ────────────────────────────────────────────────

test("e2e: date literal with arithmetic", () => {
  const result = evaluate(parse('"2026-01-15" + 10d'), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.ok(result.value.toISO()!.startsWith("2026-01-25"));
});

test("e2e: date-time literal with arithmetic and formatting", () => {
  const result = evaluate(
    parse('"2026-06-01 08:00" + 4h 30m as "HH:mm"'),
    { defaultZone: "UTC" },
  );
  assert.deepEqual(result, { type: "String", value: "12:30" });
});

test("e2e: date literal in timezone", () => {
  const result = evaluate(parse('"2026-03-15" in Tokyo'), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.zoneName, "Asia/Tokyo");
});

// ── Until / since with stubbed now ───────────────────────────────

test("e2e: 'days until tomorrow' is always 1", () => {
  const result = evaluate(parse("days until tomorrow"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 1 });
});

test("e2e: 'days since yesterday' is always 1", () => {
  const result = evaluate(parse("days since yesterday"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 1 });
});

test("e2e: 'hours until tomorrow' from stubbed noon is 12", () => {
  const result = evaluate(parse("hours until tomorrow"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 12 });
});

test("e2e: 'days until a specific date'", () => {
  const result = evaluate(parse("days until '2026-05-10'"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 30 });
});

test("e2e: 'days since a specific date'", () => {
  const result = evaluate(parse("days since '2026-01-01'"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 99 });
});

test("e2e: 'months until end of year'", () => {
  const result = evaluate(parse("months until '2027-01-01'"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 9 });
});

test("e2e: 'weeks until a future date'", () => {
  const result = evaluate(parse("weeks until '2026-05-08'"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 4 });
});

// ── Chained steps ────────────────────────────────────────────────

test("e2e: 'now + 1d in Tokyo as \"yyyy-MM-dd HH:mm ZZ\"'", () => {
  const result = evaluate(
    parse('now + 1d in Tokyo as "yyyy-MM-dd HH:mm ZZ"'),
    { defaultZone: "UTC" },
  );
  assert.equal(result.type, "String");
  assert.equal(result.value, "2026-04-11 21:00 +09:00");
});

test("e2e: 'today + 2mo - 5d as \"yyyy-MM-dd\"'", () => {
  const result = evaluate(
    parse('today + 2mo - 5d as "yyyy-MM-dd"'),
    { defaultZone: "UTC" },
  );
  assert.deepEqual(result, { type: "String", value: "2026-06-05" });
});

// ── Parenthesized sub-expressions ────────────────────────────────

test("e2e: '(now + 2h) in Tokyo' parenthesized expression", () => {
  const result = evaluate(parse("(now + 2h) in Tokyo"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T23:00:00.000+09:00");
});

// ── Restore real clock ───────────────────────────────────────────

test("e2e: teardown restore clock", () => {
  Settings.now = () => Date.now();
});
