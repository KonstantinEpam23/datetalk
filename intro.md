# date-talk — A Quick Tour

date-talk is a small language for writing date and time calculations the way you'd say them out loud. You can write expressions like `tomorrow at 3pm in Tokyo` or `hours until next friday` and get back a proper result.

## How it works: primary + steps

Every date-talk expression follows one simple pattern:

```
<primary>  <step>  <step>  <step> ...
```

The **primary** is your starting point — a word like `now`, `tomorrow`, `friday`, `april`, or a quoted date like `"2026-06-15"`. It gives you an initial date/time value.

Then you chain zero or more **steps** after it. Each step transforms the result of the previous one, strictly left to right. Steps are things like `+ 2h`, `at 10:30am`, `in Tokyo`, `to local`, or `as "yyyy-MM-dd"`.

Here's a concrete example, broken down:

```
next monday   at 09:00   in Tokyo   to local   as "HH:mm"
│             │          │          │           │
│             │          │          │           └─ step 4: format as string
│             │          │          └─ step 3: convert to local timezone
│             │          └─ step 2: qualify as Tokyo time
│             └─ step 1: set time to 9:00
└─ primary: start of next Monday
```

The evaluator processes this pipeline one step at a time. After the primary resolves to a DateTime, each step receives the current value, transforms it, and passes the result to the next step.

There's also a second expression form for measuring time differences:

```
<unit>  until/since  <primary> <step> ...
```

For example, `hours until tomorrow 1am in Moscow`. Here, the right side is a normal primary-plus-steps expression, and the result is a number — the time distance from now.

## The basics

Start with a familiar word — `now`, `today`, `tomorrow`, `yesterday`, `midnight`, `midday` (or `noon`) — and then chain operations after it. Everything reads left to right:

```
now + 2h 30m          → two and a half hours from now
today - 5d            → five days ago
tomorrow + 1mo        → same day next month
midnight              → today at 00:00
midday                → today at 12:00
```

Durations can be compact (`2h30m`, `1d6h`) or spelled out (`2 hours 30 minutes`). You can mix units freely: `1y 2mo 3d`.

## Setting a specific time

Use `at` followed by a clock time, or just drop in the time directly:

```
tomorrow at 10:30am
next friday 15:00
today at 6am
yesterday 23:30
tomorrow at midnight
next monday noon
```

Both 12-hour (`3:45pm`, `12am`) and 24-hour (`14:30`, `09:00`) formats work. You can also use the aliases `midnight` (00:00), `midday` or `noon` (12:00) as time values in the `at` position. The `at` keyword is optional — it's there for readability when you want it.

## Weekdays and months

Refer to days of the week or months by name. By default the nearest one is picked — the closest occurrence in either direction:

```
friday                → this friday (or today if today is friday)
monday                → next monday if it's closer, last monday if not
october               → nearest october 1st
```

Add `next` or `last` to be explicit:

```
next friday           → the first friday strictly after today
last wednesday        → the most recent wednesday before today
next january          → january 1st of the coming year
last december         → december 1st of the past year
```

## Working with timezones

This is where date-talk gets interesting. There are two timezone operators, and they do different things:

**`in` — "this time IS in that zone"**

```
tomorrow at 2pm in India
```

This means the 2pm is India time. The clock reading stays at 2:00 PM, but the underlying instant shifts to match the India timezone.

**`to` / `into` — "show me this time in that zone"**

```
tomorrow at 2pm to India
```

This means 2pm in your default zone, converted for display in India. The instant stays the same, but the clock reading changes (to 7:30 PM in this case).

You can use both together: `tomorrow at 9am in London to Tokyo` — 9am London time, displayed as Tokyo time.

Timezones can be IANA identifiers (`Europe/London`, `America/New_York`) or friendly names — `Tokyo`, `New York`, `India`, `England`, `Belarus`, `Moscow`, and many more. There's even a `local` alias that resolves to your system timezone.

## Formatting

Append `as "..."` with a Luxon format string to get a formatted text result:

```
now as "yyyy-MM-dd"              → "2026-04-13"
tomorrow at 3pm as "HH:mm"      → "15:00"
last march as "MMMM yyyy"       → "March 2026"
```

There's also a shorthand: `as weekday` gives you the day name (equivalent to `as "EEEE"`).

## Counting time between dates

Want to know how long until something, or how long since? Put the unit first:

```
days until tomorrow              → 1
hours until midnight             → hours until next midnight
hours since midnight             → hours since last midnight
days since yesterday             → 1
months until "2026-12-31"        → months remaining in the year
```

When you use bare names like `midnight`, `midday`, weekday names, or month names inside `until`/`since`, they resolve contextually: `until` picks the **next** occurrence, `since` picks the **previous** one. This avoids surprises — `hours until friday` always means the coming Friday, and `days since friday` always means the most recent one. Explicit `next`/`last` modifiers still work and override this behavior.

These work with timezones too — `hours until tomorrow 1am in Moscow` accounts for Moscow time when computing the difference.

## Date literals and parentheses

For specific dates, use quoted strings:

```
"2026-06-15"
"2026-06-15 14:30"
"2026-06-15 14:30" + 2h to Tokyo
```

Parentheses group sub-expressions when you need them:

```
(now + 2h) to Tokyo
(tomorrow at 9am in London) as "HH:mm ZZ"
```

## Result types

Depending on the expression, you get one of three result types:

- **DateTime** — most expressions (`now + 2h`, `tomorrow in Tokyo`)
- **String** — when the last step is `as "..."` (`now as "yyyy-MM-dd"`)
- **Number** — relative amounts (`days until tomorrow`, `hours since yesterday`)

When timezone steps are involved, the result also includes metadata telling you which zones were applied — the `conversion` zone (from `in`) and/or the `representation` zone (from `to`/`into`). This means callers always know how the result was derived.

## Putting it all together

Remember the pattern: **primary → steps → result**. The power is in chaining — start with any date, transform it step by step, and end up exactly where you need:

```
next monday at 09:00 in Tokyo to local as "EEEE, MMMM d 'at' h:mm a"
```

This finds next Monday, sets the time to 9:00 AM Tokyo time, converts it to your local timezone, and formats it as something like "Monday, April 20 at 8:00 PM". All in one readable line.
