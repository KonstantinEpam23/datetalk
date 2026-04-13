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

// ── Timezone display conversion (to/into) ────────────────────────

test("e2e: 'now to Tokyo' display-converts timezone", () => {
  const result = evaluate(parse("now to Tokyo"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T21:00:00.000+09:00");
  assert.deepEqual(result.tz, { representation: "Asia/Tokyo" });
});

test("e2e: 'now to New York' display-converts to US Eastern", () => {
  const result = evaluate(parse("now to New York"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  // EDT (UTC-4) in April
  assert.equal(result.value.toISO(), "2026-04-10T08:00:00.000-04:00");
  assert.deepEqual(result.tz, { representation: "America/New_York" });
});

test("e2e: 'now to Belarus' display-converts to Minsk time", () => {
  const result = evaluate(parse("now to Belarus"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T15:00:00.000+03:00");
});

test("e2e: 'now into Tokyo' alias for 'to'", () => {
  const result = evaluate(parse("now into Tokyo"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T21:00:00.000+09:00");
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

test("e2e: 'tomorrow to Tokyo as \"yyyy-MM-dd HH:mm\"'", () => {
  const result = evaluate(
    parse('tomorrow to Tokyo as "yyyy-MM-dd HH:mm"'),
    { defaultZone: "UTC" },
  );
  // tomorrow UTC = 2026-04-11T00:00:00Z → Tokyo (+9) = 2026-04-11T09:00
  assert.deepEqual(result, { type: "String", value: "2026-04-11 09:00", tz: { representation: "Asia/Tokyo" } });
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

test("e2e: date literal to timezone", () => {
  const result = evaluate(parse('"2026-03-15" to Tokyo'), { defaultZone: "UTC" });
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

test("e2e: 'now + 1d to Tokyo as \"yyyy-MM-dd HH:mm ZZ\"'", () => {
  const result = evaluate(
    parse('now + 1d to Tokyo as "yyyy-MM-dd HH:mm ZZ"'),
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

test("e2e: '(now + 2h) to Tokyo' parenthesized expression", () => {
  const result = evaluate(parse("(now + 2h) to Tokyo"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T23:00:00.000+09:00");
});

// ── Weekday primaries ────────────────────────────────────────────
// Stubbed now = 2026-04-10 (Friday)

test("e2e: 'friday' (nearest) returns today since today is Friday", () => {
  const result = evaluate(parse("friday"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T00:00:00.000Z");
});

test("e2e: 'FRIDAY' is case-insensitive", () => {
  const result = evaluate(parse("FRIDAY"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T00:00:00.000Z");
});

test("e2e: 'next friday' returns next week's Friday", () => {
  const result = evaluate(parse("next friday"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-17T00:00:00.000Z");
});

test("e2e: 'last friday' returns last week's Friday", () => {
  const result = evaluate(parse("last friday"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-03T00:00:00.000Z");
});

test("e2e: 'monday' (nearest) returns next Monday (3 days away)", () => {
  // Friday→Monday: 3 days ahead vs 4 days behind → ahead wins
  const result = evaluate(parse("monday"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-13T00:00:00.000Z");
});

test("e2e: 'wednesday' (nearest) returns last Wednesday (2 days behind)", () => {
  // Friday→Wednesday: 5 days ahead vs 2 days behind → behind wins
  const result = evaluate(parse("wednesday"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-08T00:00:00.000Z");
});

test("e2e: 'next monday to Tokyo' weekday with timezone step", () => {
  const result = evaluate(parse("next monday to Tokyo"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.zoneName, "Asia/Tokyo");
  assert.ok(result.value.toISO()!.startsWith("2026-04-13"));
});

test("e2e: 'days until next monday'", () => {
  const result = evaluate(parse("days until next monday"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 3 });
});

// ── Month primaries ──────────────────────────────────────────────
// Stubbed now = 2026-04-10 (April)

test("e2e: 'april' (nearest) returns this April 1st", () => {
  const result = evaluate(parse("april"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-01T00:00:00.000Z");
});

test("e2e: 'APRIL' is case-insensitive", () => {
  const result = evaluate(parse("APRIL"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-01T00:00:00.000Z");
});

test("e2e: 'next january' returns January of next year", () => {
  const result = evaluate(parse("next january"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2027-01-01T00:00:00.000Z");
});

test("e2e: 'last december' returns December of last year", () => {
  const result = evaluate(parse("last december"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2025-12-01T00:00:00.000Z");
});

test("e2e: 'next april' skips current month, returns next year", () => {
  const result = evaluate(parse("next april"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2027-04-01T00:00:00.000Z");
});

test("e2e: 'last april' skips current month, returns last year", () => {
  const result = evaluate(parse("last april"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2025-04-01T00:00:00.000Z");
});

test("e2e: 'october' (nearest) returns upcoming October (6 months away)", () => {
  // April→October: 6 months ahead vs 6 behind → ahead wins (tie-break)
  const result = evaluate(parse("october"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-10-01T00:00:00.000Z");
});

test("e2e: 'february' (nearest) returns last February (2 months behind)", () => {
  // April→February: 10 months ahead vs 2 behind → behind wins
  const result = evaluate(parse("february"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-02-01T00:00:00.000Z");
});

test("e2e: 'last march as \"yyyy-MM-dd\"' month with format step", () => {
  const result = evaluate(parse('last march as "yyyy-MM-dd"'), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "String", value: "2026-03-01" });
});

// ── At-time (with and without "at" keyword) ──────────────────────
// Stubbed now = 2026-04-10T12:00:00Z (Friday)

test("e2e: 'tomorrow at 10:30am'", () => {
  const result = evaluate(parse("tomorrow at 10:30am"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-11T10:30:00.000Z");
});

test("e2e: 'yesterday 23:30' (no at keyword, 24h)", () => {
  const result = evaluate(parse("yesterday 23:30"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-09T23:30:00.000Z");
});

test("e2e: 'next Friday 15:15' (weekday + bare time)", () => {
  const result = evaluate(parse("next Friday 15:15"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-17T15:15:00.000Z");
});

test("e2e: 'today at 12pm' (hour-only 12h format)", () => {
  const result = evaluate(parse("today at 12pm"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T12:00:00.000Z");
});

test("e2e: 'today at 6am'", () => {
  const result = evaluate(parse("today at 6am"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-10T06:00:00.000Z");
});

test("e2e: 'tomorrow 3:45pm' (12h with minutes, no at)", () => {
  const result = evaluate(parse("tomorrow 3:45pm"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-11T15:45:00.000Z");
});

test("e2e: 'next monday at 09:00 in Tokyo'", () => {
  const result = evaluate(parse("next monday at 09:00 in Tokyo"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  // "in Tokyo" = qualify: 09:00 IS Tokyo time → instant = 00:00 UTC
  assert.equal(result.value.zoneName, "Asia/Tokyo");
  assert.equal(result.value.toISO(), "2026-04-13T09:00:00.000+09:00");
  assert.deepEqual(result.tz, { conversion: "Asia/Tokyo" });
});

// ── Timezone-aware until/since ───────────────────────────────────
// Stubbed now = 2026-04-10T12:00:00Z (Friday)

test("e2e: 'hours until tomorrow 1am in Moscow' vs 'in New York' differ", () => {
  // Moscow = UTC+3: tomorrow(Moscow) 1am = April 11 01:00+03:00 = April 10 22:00 UTC
  // diff from 12:00 UTC = 10 hours
  const msk = evaluate(parse("hours until tomorrow 1am in Moscow"), { defaultZone: "UTC" });
  assert.deepEqual(msk, { type: "Number", value: 10, tz: { conversion: "Europe/Moscow" } });

  // New York = UTC-4 (EDT): tomorrow(NY) 1am = April 11 01:00-04:00 = April 11 05:00 UTC
  // diff from 12:00 UTC = 17 hours
  const ny = evaluate(parse("hours until tomorrow 1am in New York"), { defaultZone: "UTC" });
  assert.deepEqual(ny, { type: "Number", value: 17, tz: { conversion: "America/New_York" } });
});

test("e2e: 'hours until tomorrow in Tokyo' timezone context for until/since", () => {
  // In until/since, "in Tokyo" propagates to primary: tomorrow(Tokyo) = April 11 00:00+09:00
  // = April 10 15:00 UTC. diff from 12:00 UTC = 3 hours
  const result = evaluate(parse("hours until tomorrow in Tokyo"), { defaultZone: "UTC" });
  assert.deepEqual(result, { type: "Number", value: 3, tz: { conversion: "Asia/Tokyo" } });
});

test("e2e: 'tomorrow at 2pm in India' interprets 2pm as India time", () => {
  // "in India" = qualify: 2pm IS India time (+5:30) → instant = 08:30 UTC
  const result = evaluate(parse("tomorrow at 2pm in India"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-11T14:00:00.000+05:30");
  assert.deepEqual(result.tz, { conversion: "Asia/Kolkata" });
});

test("e2e: 'tomorrow at 2pm to India' display-converts to India", () => {
  // "to India" = display: 2pm UTC → India (+5:30) = 7:30pm
  const result = evaluate(parse("tomorrow at 2pm to India"), { defaultZone: "UTC" });
  assert.equal(result.type, "DateTime");
  assert.equal(result.value.toISO(), "2026-04-11T19:30:00.000+05:30");
  assert.deepEqual(result.tz, { representation: "Asia/Kolkata" });
});

test("e2e: 'in' vs 'to' produce different results with at-time", () => {
  const qualify = evaluate(parse("tomorrow at 2pm in India"), { defaultZone: "UTC" });
  const display = evaluate(parse("tomorrow at 2pm to India"), { defaultZone: "UTC" });
  assert.equal(qualify.type, "DateTime");
  assert.equal(display.type, "DateTime");
  assert.notEqual((qualify.value as DateTime).toMillis(), (display.value as DateTime).toMillis());
});

test("e2e: no tz info when no timezone steps", () => {
  const result = evaluate(parse("tomorrow at 2pm"), { defaultZone: "UTC" });
  assert.equal(result.tz, undefined);
});

// ── Restore real clock ───────────────────────────────────────────

test("e2e: teardown restore clock", () => {
  Settings.now = () => Date.now();
});
