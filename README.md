# date-talk-simple

A tiny DSL for date/time expressions with a Peggy parser and a Luxon-based evaluator.

## What is currently implemented

- Parser: rich grammar from [src/grammar.pegjs](src/grammar.pegjs)
- Evaluator: currently supports a subset (`now`, `today`, quoted date literal, `+/- duration`, `in "TZ"`, parentheses)

This README documents the parser syntax first, then lists evaluator limits.

## Grammar overview

Entry point:

- `Start = Expr`

Top-level expressions:

- `DateTimeExpr`
- `<unit> until/since <DateTimeExpr>` (relative amount)

Examples:

- `now`
- `today + 2h`
- `now is within (today .. tomorrow)`

## Primaries

- `now`
- `today`
- `tomorrow`
- `yesterday`
- Parenthesized expression: `(Expr)`
- Quoted string literal: `"..."` or `'...'`

## Steps (applied left-to-right)

Any number of steps can follow a primary:

- `+ <duration>`
- `- <duration>`
- `in <IANA timezone>` or `in "<IANA timezone>"`
- `as "<format string>"`
- `start of <unit>`
- `end of <unit>`
- `next <week target>`
- `previous <week target>`
- `prev <week target>`
- `at <time literal>`
- `using <mode>`

Examples:

- `now + 72h in Europe/Belgrade`
- `now in Belarus`
- `tomorrow in Minsk`
- `today start of month`
- `now next Monday at 09:30`
- `"2026-01-28 14:30" - 90m as "yyyy-MM-dd HH:mm"`

## Duration

Durations are one or more parts.

Compact parts:

- `<int>ms`, `<int>s`, `<int>m`, `<int>h`, `<int>d`, `<int>w`, `<int>mo`, `<int>y`

Wordy parts:

- `<int> second(s)`
- `<int> minute(s)`
- `<int> hour(s)`
- `<int> day(s)`
- `<int> week(s)`
- `<int> month(s)`
- `<int> year(s)`

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

It does not yet evaluate parser nodes such as `start/end of`, `next/prev`, `at`, `using`.

## Known gaps (parser vs evaluator)

- [x] `- <duration>` is parsed and evaluated as subtraction.
- [x] Duration units `mo`/`y` (and wordy month/year) are evaluated.
- [x] `tomorrow` / `yesterday` primaries are evaluated.
- [x] `AsFormat` (`as "..."`) is evaluated.
- [x] `RelativeAmount` (`days until/since <expr>`) is evaluated.
- [ ] `Boundary` (`start of <unit>`, `end of <unit>`) parsing exists; evaluator does not implement it.
- [ ] `NextPrev` (`next/previous/prev <target>`) parsing exists; evaluator does not implement it.
- [ ] `AtTime` (`at HH:MM...`) parsing exists; evaluator does not implement it.
- [ ] `UsingMode` (`using clamp|roll|strict`) parsing exists; evaluator does not implement it.

## Run

```bash
npm install
npm run build
npm run dev -- 'now + 72h in "Europe/Belgrade"'
```
