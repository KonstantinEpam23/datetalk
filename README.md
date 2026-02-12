# date-talk-simple

A tiny toy language for **time addition** and **timezone conversion**.

## Supported syntax

### DateTime primaries
- `now`
- `today` (start of day in the default zone)
- `"2026-01-28"`, `"2026-01-28 14:30"`, `"2026-01-28T14:30"` (quoted date/datetime strings)

### Steps (left-to-right)
- `+ <duration>` where duration parts support: `ms s m h d w` and can be chained (e.g. `2h 30m`)
- `in "<IANA timezone>"`

Examples:
- `now + 72h in "Europe/Belgrade"`
- `"2026-01-28 14:30" + 90m in "UTC"`
- `("2026-01-28" + 7d) in "America/New_York"`

## Run

```bash
npm install
npm run dev -- 'now + 72h in "Europe/Belgrade"'
```
