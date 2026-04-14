# date-talk-simple

A tiny, human-readable DSL for date/time expressions. Powered by a [Peggy](https://peggyjs.org/) PEG parser and a [Luxon](https://moment.github.io/luxon/)-based evaluator.

See [intro.md](intro.md) for a friendly walkthrough, or [language-spec.md](language-spec.md) for the full specification.

## Quick examples

```
now
today + 2h 30m
tomorrow at 10:30am
midnight
hours until midnight
next Friday 15:00 in Tokyo
hours until tomorrow 1am in Moscow
now to New York as "HH:mm"
last march as "yyyy-MM-dd"
"2026-01-28 14:30" - 90m as "yyyy-MM-dd HH:mm"
```

## Features

- **Date primaries** — `now`, `today`, `tomorrow`, `yesterday`, `midnight`, `midday`/`noon`, weekday names (`friday`, `next monday`, `last wednesday`), month names (`april`, `next january`, `last december`)
- **Arithmetic** — `+ / -` with compact (`2h30m`) or wordy (`2 hours 30 minutes`) durations
- **Time setting** — `at 10:30am`, `14:00`, `3pm` (the `at` keyword is optional)
- **Timezone qualification (`in`)** — reinterprets the wall-clock time as being in the given zone: `tomorrow at 2pm in India`
- **Timezone display (`to` / `into`)** — converts the result to another zone for display: `now to Tokyo`
- **Formatting** — `as "yyyy-MM-dd HH:mm"` or `as weekday` (Luxon format tokens)
- **Relative amounts** — `hours until midnight`, `days since friday`, `months until january`. Bare weekday/month names and `midnight`/`midday` resolve contextually: `until` → next occurrence, `since` → previous occurrence
- **Date literals** — `"2026-04-15"`, `"2026-04-15 14:30"`
- **Parentheses** — `(now + 2h) to Tokyo`
- **Timezone info in results** — the evaluation result includes metadata about which timezones were applied (conversion vs. representation)
- **Rich timezone aliases** — use `Tokyo`, `New York`, `India`, `Belarus`, `England`, `local`, etc. instead of IANA identifiers

## Timezone semantics: `in` vs `to`

This is the most important distinction in the language:

| Operator | Meaning | Example | Effect |
|----------|---------|---------|--------|
| `in` | **Qualify / reinterpret** | `tomorrow at 2pm in India` | 2pm IS India time (wall-clock stays, instant changes) |
| `to` / `into` | **Display / convert** | `tomorrow at 2pm to India` | 2pm UTC shown as India time (instant stays, wall-clock changes) |

The evaluation result carries a `TimezoneInfo` object with optional `conversion` (from `in`) and `representation` (from `to`/`into`) fields, so callers always know how the result was derived.

## Installation & usage

```bash
npm install
npm run build
```

### CLI

```bash
npm run dev -- 'now + 2h to Tokyo'
npm run dev -- 'hours until tomorrow 1am in Moscow'
```

### Programmatic API

```typescript
import { parse, evaluate } from "date-talk-simple";

const result = evaluate(parse("tomorrow at 3pm in Tokyo to local"));
// result.type === "DateTime"
// result.value  — Luxon DateTime
// result.tz     — { conversion: "Asia/Tokyo", representation: "America/New_York" }
```

## Build & test

```bash
npm run build        # peggy → tsc → copy parser
npm test             # build + run all tests (Node.js built-in test runner)
```

## Tech stack

- **Parser**: [Peggy](https://peggyjs.org/) v4 — PEG grammar → ES module
- **Runtime**: [Luxon](https://moment.github.io/luxon/) v3 — DateTime/Duration/timezone handling
- **Language**: TypeScript 5 — ES2022 target, ESM modules
- **Tests**: Node.js built-in test runner (`node --test`)

Examples:

- `2h 30m`
- `1 day 12 hours`
- `1mo 3d`

## Week targets

- Weekday names: `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`
- Full names: `Monday` ... `Sunday`
- Special targets: `weekday`, `weekend`

## Time literals

24-hour:

- `HH:MM`
- `HH:MM:SS`
- Hour must be `00..23`, minute/second must be `00..59`

12-hour:

- `H am|pm` (hour only, e.g. `12pm`, `6am`)
- `H:MM am|pm`
- `H:MM:SS am|pm`
- Hour must be `1..12`, minute/second must be `00..59`
- `am/pm` is case-insensitive

## Mode

- `using clamp`
- `using roll`
- `using strict`

## String literal escapes

Supported in both quote styles:

- `\\n`
- `\\t`
- `\\\\`
- Quote-specific escape (`\\"` in double quotes, `\\'` in single quotes)

## Lexing notes

- Whitespace rule is currently spaces only (`" "*`).
- Keywords are case-sensitive, except `am/pm`.
- Keywords are guarded with identifier boundaries (for example, `todayX` is not `today`).

## Evaluator subset (today)

Current evaluator implementation (see [src/evaluator.ts](src/evaluator.ts)) supports:

- Primaries: `now`, `today`, quoted string literal, parenthesized DateTime expressions
- Steps: `+/- <duration>`, `in "<IANA timezone>"`

It does not yet evaluate parser nodes such as `start/end of`, `next/prev`, `using`.

## Known gaps (parser vs evaluator)

- [x] `- <duration>` is parsed and evaluated as subtraction.
- [x] Duration units `mo`/`y` (and wordy month/year) are evaluated.
- [x] `tomorrow` / `yesterday` primaries are evaluated.
- [x] `AsFormat` (`as "..."`) is evaluated.
- [x] `RelativeAmount` (`days until/since <expr>`) is evaluated.
- [x] Weekday primaries (`Friday`, `next Friday`, `last Friday`) are evaluated.
- [x] Month primaries (`April`, `next April`, `last April`) are evaluated.
- [x] `AtTime` (`at HH:MM`, `HH:MM`, `12pm`) is evaluated.
- [ ] `Boundary` (`start of <unit>`, `end of <unit>`) parsing exists; evaluator does not implement it.
- [ ] `NextPrev` (`next/previous/prev <target>`) parsing exists; evaluator does not implement it.
- [ ] `UsingMode` (`using clamp|roll|strict`) parsing exists; evaluator does not implement it.

## Run

```bash
npm install
npm run build
npm run dev -- 'now + 72h in "Europe/Belgrade"'
```
