# date-talk Language Specification

Version: 0.1 — April 2026

This document is the complete specification of the date-talk expression language.

---

## 1. Overview

date-talk is a small expression language for date/time calculations. An expression evaluates to one of three result types:

| Result type | Produced by |
|-------------|-------------|
| **DateTime** | Most expressions (primaries, arithmetic, timezone steps) |
| **String** | Expressions ending with `as "format"` |
| **Number** | Relative amount expressions (`hours until ...`, `days since ...`) |

Every result may carry an optional `TimezoneInfo` object with `conversion` and/or `representation` fields indicating which timezone operators were applied.

---

## 2. Syntax

### 2.1 Entry point

```
Start = Expr
```

An expression is either a **DateTimeExpr** or a **RelativeAmountExpr**.

### 2.2 DateTimeExpr

```
DateTimeExpr = Primary Step*
```

A primary value followed by zero or more transformation steps, applied left to right.

### 2.3 RelativeAmountExpr

```
RelativeAmountExpr = Unit ("until" | "since") DateTimeExpr
```

Computes the numeric difference between `now` and the target expression in the given unit. Returns a **Number** value.

- `until` — target is in the future; result is positive
- `since` — target is in the past; result is positive

Examples:

```
hours until tomorrow 1am in Moscow
days since yesterday
months until "2026-12-31"
weeks until next friday
```

---

## 3. Primaries

A primary is the starting value of an expression.

### 3.1 Temporal keywords

| Keyword | Value |
|---------|-------|
| `now` | Current instant |
| `today` | Start of the current day (00:00:00.000) |
| `tomorrow` | Start of the next day |
| `yesterday` | Start of the previous day |

All keywords are case-sensitive and must not be followed by an identifier character (`[a-zA-Z0-9_]`).

### 3.2 Weekday references

```
WeekdayPrimary = ("next" | "last")? WeekdayName
```

Weekday names are case-insensitive: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`.

Resolution rules:

| Form | Resolution |
|------|------------|
| `friday` | **Nearest**: today if today is Friday; otherwise the closest Friday in either direction. Ties (3.5 days) favor the future. |
| `next friday` | The first Friday **strictly after** today. |
| `last friday` | The most recent Friday **strictly before** today. |

The result is always start-of-day (00:00:00.000).

### 3.3 Month references

```
MonthPrimary = ("next" | "last")? MonthName
```

Month names are case-insensitive: `january` through `december`.

Resolution rules:

| Form | Resolution |
|------|------------|
| `april` | **Nearest**: the 1st of April closest to the current date. If the current month matches, returns the 1st of the current month. Ties (6 months) favor the future. |
| `next april` | April 1st of the next occurrence **strictly after** the current month. |
| `last april` | April 1st of the most recent occurrence **strictly before** the current month. |

The result is always the 1st of the month at start-of-day.

### 3.4 Parenthesized expressions

```
Parens = "(" Expr ")"
```

Any expression can be grouped with parentheses. The inner expression is evaluated first.

### 3.5 String literals (date literals)

```
StringLiteral = '"' chars '"' | "'" chars "'"
```

Quoted strings are parsed as date/time values using ISO-like formats:

- `"2026-04-15"` — date only (time defaults to 00:00)
- `"2026-04-15 14:30"` — date and time
- `"2026-04-15T14:30:00"` — ISO format

Escape sequences: `\\`, `\"`, `\'`, `\n`, `\t`.

---

## 4. Steps

Steps are transformations applied to a DateTime, evaluated left to right. Any number of steps can follow a primary.

### 4.1 Arithmetic: `+` / `-`

```
AddSub = ("+" | "-") Duration
```

Adds or subtracts a duration from the current DateTime.

```
now + 2h 30m
today - 5d
tomorrow + 1y 2mo 3d
```

### 4.2 Timezone qualification: `in`

```
InTZ = "in" TimeZone
```

**Reinterprets** the current wall-clock time as being in the specified timezone. The local time stays the same; the underlying instant changes.

```
tomorrow at 2pm in India       → 2:00 PM India Standard Time
next monday at 09:00 in Tokyo  → 9:00 AM Japan Standard Time
```

**Semantics**: Equivalent to Luxon's `dt.setZone(zone, { keepLocalTime: true })`. Recorded as `TimezoneInfo.conversion`.

### 4.3 Timezone display: `to` / `into`

```
ToTZ = ("to" | "into") TimeZone
```

**Converts** the current DateTime into the specified timezone for display. The underlying instant stays the same; the wall-clock reading changes.

```
now to Tokyo               → current instant shown in Tokyo time
tomorrow at 2pm to India   → 2pm UTC shown as 7:30pm IST
```

**Semantics**: Equivalent to Luxon's `dt.setZone(zone)`. Recorded as `TimezoneInfo.representation`.

### 4.4 Combined `in` + `to`

Both can appear in the same expression:

```
tomorrow at 9am in London to Tokyo
```

This means: 9am IS London time (`in`), then display the result in Tokyo time (`to`).

### 4.5 Time setting: `at`

```
AtTime = "at"? TimeLiteral
```

Sets the hour, minute, and second of the current DateTime. The `at` keyword is optional.

```
tomorrow at 10:30am
yesterday 23:30
next friday 3pm
today at 6am
```

### 4.6 Formatting: `as`

```
AsFormat = "as" (StringLiteral | "weekday")
```

Formats the DateTime into a string using [Luxon format tokens](https://moment.github.io/luxon/#/formatting?id=table-of-tokens). **Must be the last step** in an expression. Changes the result type to **String**.

```
now as "yyyy-MM-dd"            → "2026-04-13"
tomorrow at 3pm as "HH:mm"    → "15:00"
friday as weekday              → "Friday"
```

The `weekday` shorthand is equivalent to `as "EEEE"`.

### 4.7 Boundary: `start of` / `end of` (parser only)

```
StartEndOf = ("start" | "end") "of" Unit
```

Truncates or extends the DateTime to the start or end of the given unit.

```
today start of month
now end of year
```

### 4.8 Relative navigation: `next` / `previous` / `prev` (parser only)

```
NextPrev = ("next" | "previous" | "prev") WeekTarget
```

Moves the DateTime to the next or previous occurrence of a week target.

```
now next Monday
today previous Friday
```

### 4.9 Mode: `using` (parser only)

```
UsingMode = "using" ("clamp" | "roll" | "strict")
```

Sets the overflow mode for arithmetic operations.

> **Note**: Steps 4.7–4.9 are recognized by the parser but not yet implemented in the evaluator.

---

## 5. Durations

A duration is one or more parts, evaluated additively.

### 5.1 Compact format

Parts are an integer immediately followed by a unit suffix (no space):

| Suffix | Unit |
|--------|------|
| `ms` | milliseconds |
| `s` | seconds |
| `m` | minutes |
| `h` | hours |
| `d` | days |
| `w` | weeks |
| `mo` | months |
| `y` | years |

Examples: `2h`, `30m`, `1d6h`, `2h30m`, `1y2mo3d`.

### 5.2 Wordy format

Parts are an integer, optional whitespace, then a unit word:

| Words | Unit |
|-------|------|
| `millisecond`, `milliseconds` | milliseconds |
| `second`, `seconds` | seconds |
| `minute`, `minutes` | minutes |
| `hour`, `hours` | hours |
| `day`, `days` | days |
| `week`, `weeks` | weeks |
| `month`, `months` | months |
| `year`, `years` | years |

Examples: `2 hours`, `30 minutes`, `1 day 6 hours`.

### 5.3 Mixing formats

Compact and wordy parts can be mixed in a single duration:

```
1d 2 hours 30m
```

---

## 6. Time Literals

### 6.1 24-hour format

```
HH:MM
HH:MM:SS
```

- Hours: `00`–`23`
- Minutes: `00`–`59`
- Seconds: `00`–`59` (optional, defaults to `00`)

Examples: `14:30`, `09:00`, `23:59:59`.

### 6.2 12-hour format

```
H:MMam/pm
H:MM:SSam/pm
Ham/pm
```

- Hours: `1`–`12`
- Meridiem: `am` or `pm` (case-insensitive)
- Hour-only form is allowed: `3pm`, `12am`

Examples: `10:30am`, `3:45PM`, `12am`, `6pm`.

---

## 7. Timezones

Timezones can be specified as:

### 7.1 IANA identifiers

Standard `Region/City` format:

```
now in Europe/London
now to America/New_York
```

### 7.2 Quoted strings

```
now in "US/Eastern"
```

### 7.3 Bare multi-word names

Unquoted names that may contain multiple words. Parsing stops at step boundaries (`+`, `-`, `as`, `to`, `in`, `at`, `into`, `start`, `end`, `next`, `previous`, `prev`, `using`, `until`, `since`).

```
now in New York
now to Sri Lanka
```

### 7.4 Aliases

The resolver accepts friendly names in addition to IANA identifiers:

| Category | Examples |
|----------|----------|
| **Countries** | `England`, `France`, `Germany`, `India`, `Japan`, `Belarus`, `Russia`, `Turkey`, ... |
| **Cities** | `Tokyo`, `New York`, `London`, `Paris`, `Moscow`, `Mumbai`, `Sydney`, ... |
| **Short codes** | `UTC`, `GMT` |
| **Special** | `local` — resolves to the system's local timezone |

City and country names are matched case-insensitively with normalization (accents stripped, spaces and special characters collapsed).

The full alias table is maintained in `src/utils/timezone-aliases.ts`. Additionally, all IANA timezone leaf names (the part after the last `/`) and trailing paths are registered automatically at startup.

---

## 8. Evaluation Result

The `evaluate()` function returns a `Value`:

```typescript
type Value =
  | { type: "DateTime"; value: DateTime; tz?: TimezoneInfo }
  | { type: "String";   value: string;   tz?: TimezoneInfo }
  | { type: "Number";   value: number;   tz?: TimezoneInfo };

interface TimezoneInfo {
  conversion?: string;     // zone from "in <tz>"
  representation?: string; // zone from "to/into <tz>"
}
```

### 8.1 Result type rules

| Expression form | Result type |
|----------------|-------------|
| Primary + steps (no `as`) | DateTime |
| Any expression ending with `as "..."` | String |
| `<unit> until/since <expr>` | Number |

### 8.2 TimezoneInfo

Present only when the expression includes an `in` or `to`/`into` step. Both fields are optional:

- `conversion` — the resolved IANA zone from an `in` step
- `representation` — the resolved IANA zone from a `to`/`into` step

If neither timezone step is used, the `tz` field is `undefined`.

### 8.3 EvalOptions

```typescript
interface EvalOptions {
  defaultZone?: string;  // default timezone for evaluation (e.g. "Europe/Belgrade")
}
```

When `defaultZone` is set, `now`, `today`, `tomorrow`, `yesterday`, weekday, and month primaries are all resolved in that timezone.

---

## 9. Operator Precedence and Evaluation Order

1. Parenthesized expressions are evaluated first (innermost to outermost).
2. A primary is evaluated to produce an initial DateTime.
3. Steps are applied strictly left to right.
4. `as "format"` must be the final step; it converts DateTime → String.
5. In a RelativeAmountExpr, the target DateTimeExpr is evaluated first, then the difference from `now` is computed.

---

## 10. Whitespace and Case Sensitivity

- Whitespace between tokens is optional (spaces only; no tabs or newlines in the grammar).
- Keywords (`now`, `today`, `tomorrow`, `yesterday`, `in`, `to`, `into`, `as`, `at`, `next`, `last`, `until`, `since`, `start`, `end`, `using`, `prev`, `previous`) are case-sensitive.
- Weekday names and month names are case-insensitive.
- Timezone names are case-insensitive during resolution.
- Meridiem (`am`/`pm`) is case-insensitive.

---

## 11. Error Conditions

| Condition | Error |
|-----------|-------|
| Invalid date literal | `Invalid date literal: "..." (reason)` |
| Unknown timezone | `Invalid time zone: "..."` |
| `as` not in last position | `"as" formatting must be the last step in an expression` |
| 24h time hour > 23 | `24h time hour must be 00..23` |
| Minutes > 59 | `minutes must be 00..59` |
| Seconds > 59 | `seconds must be 00..59` |
| Syntax error | Peggy parse error with position info |
