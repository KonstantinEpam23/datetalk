{
  function node(type, props) { return { type, ...props }; }
}

/* =========================
 * Entry
 * ========================= */

Start
  = _ e:Expr _ { return e; }

/* =========================
 * Helpers / Lexing
 * ========================= */

_         = " "*

IdentChar = [a-zA-Z0-9_]

Int "integer"
  = digits:[0-9]+ { return parseInt(digits.join(""), 10); }

TwoDigits "two-digit number"
  = a:[0-9] b:[0-9] { return a + b; }

/* =========================
 * Strings
 * ========================= */

StringLiteral
  = "\"" chars:DoubleQuotedChar* "\"" { return chars.join(""); }
  / "'"  chars:SingleQuotedChar* "'"  { return chars.join(""); }

DoubleQuotedChar
  = "\\\"" { return "\""; }
  / "\\n"  { return "\n"; }
  / "\\t"  { return "\t"; }
  / "\\\\" { return "\\"; }
  / c:(!"\"" .) { return c[1]; }

SingleQuotedChar
  = "\\'"  { return "'"; }
  / "\\n"  { return "\n"; }
  / "\\t"  { return "\t"; }
  / "\\\\" { return "\\"; }
  / c:(!"'" .) { return c[1]; }

/* =========================
 * Expressions
 * ========================= */

Expr
  = RelativeAmountExpr
  / DateTimeExpr

RelativeAmountExpr
  = u:Unit _ dir:("until" / "since") !IdentChar _ target:DateTimeExpr {
      return node("RelativeAmount", { unit: u.norm, direction: dir, target });
    }

DateTimeExpr "date/time expression"
  = head:Primary tail:(_ Step)* {
      const steps = tail.map(t => t[1]);
      return node("DateTimeExpr", { head, steps });
    }

/* =========================
 * Primary values
 * ========================= */

Primary "primary date/time value"
  = Now
  / Today
  / Tomorrow
  / Yesterday
  / Midnight
  / Midday
  / WeekdayPrimary
  / MonthPrimary
  / Parens
  / s:StringLiteral { return node("Literal", { kind: "string", value: s }); }

Parens
  = "(" _ e:Expr _ ")" { return e; }

Now
  = "now" !IdentChar { return node("Now", {}); }

Today
  = "today" !IdentChar { return node("Today", {}); }

Tomorrow
  = "tomorrow" !IdentChar { return node("Tomorrow", {}); }

Yesterday
  = "yesterday" !IdentChar { return node("Yesterday", {}); }

Midnight
  = "midnight"i !IdentChar { return node("Midnight", {}); }

Midday
  = ("midday"i / "noon"i) !IdentChar { return node("Midday", {}); }

WeekdayPrimary
  = dir:("next"i / "last"i) !IdentChar _ w:WeekdayNameCI !IdentChar {
      return node("WeekdayRef", { name: w, direction: dir.toLowerCase() });
    }
  / w:WeekdayNameCI !IdentChar {
      return node("WeekdayRef", { name: w, direction: "nearest" });
    }

MonthPrimary
  = dir:("next"i / "last"i) !IdentChar _ m:MonthNameCI !IdentChar {
      return node("MonthRef", { name: m, direction: dir.toLowerCase() });
    }
  / m:MonthNameCI !IdentChar {
      return node("MonthRef", { name: m, direction: "nearest" });
    }

WeekdayNameCI "weekday name"
  = "monday"i    { return "Monday"; }
  / "tuesday"i   { return "Tuesday"; }
  / "wednesday"i { return "Wednesday"; }
  / "thursday"i  { return "Thursday"; }
  / "friday"i    { return "Friday"; }
  / "saturday"i  { return "Saturday"; }
  / "sunday"i    { return "Sunday"; }

MonthNameCI "month name"
  = "january"i   { return "January"; }
  / "february"i  { return "February"; }
  / "march"i     { return "March"; }
  / "april"i     { return "April"; }
  / "may"i       { return "May"; }
  / "june"i      { return "June"; }
  / "july"i      { return "July"; }
  / "august"i    { return "August"; }
  / "september"i { return "September"; }
  / "october"i   { return "October"; }
  / "november"i  { return "November"; }
  / "december"i  { return "December"; }

/* =========================
 * Steps (DateTime transforms)
 * ========================= */

Step "date/time transformation step"
  = AddSub
  / InTZ
  / ToTZ
  / AsFormat
  / StartEndOf
  / NextPrev
  / AtTime
  / UsingMode

AddSub
  = op:("+" / "-") _ d:Duration {
      return node("AddSub", { op, duration: d });
    }

InTZ
  = "in" !IdentChar _ tz:TimeZone {
      return node("InTZ", { tz });
    }

ToTZ
  = ("into" / "to") !IdentChar _ tz:TimeZone {
      return node("ToTZ", { tz });
    }

AsFormat
  = "as" !IdentChar _ fmt:StringLiteral {
      return node("AsFormat", { format: fmt });
    }
  / "as" !IdentChar _ "weekday" !IdentChar {
      return node("AsFormat", { format: "EEEE" });
    }

StartEndOf
  = se:("start" / "end") !IdentChar _ "of" !IdentChar _ u:Unit {
      return node("Boundary", { which: se, unit: u });
    }

NextPrev
  = np:("next" / "previous" / "prev") !IdentChar _ w:WeekTarget {
      return node("NextPrev", { which: (np === "prev" ? "previous" : np), target: w });
    }

AtTime
  = "at" !IdentChar _ t:TimeLiteral {
      return node("AtTime", { time: t });
    }
  / t:TimeLiteral {
      return node("AtTime", { time: t });
    }

UsingMode
  = "using" !IdentChar _ m:Mode {
      return node("UsingMode", { mode: m });
    }

/* =========================
 * Atoms
 * ========================= */

TimeZone "time zone"
  = StringLiteral
  / BareTimeZone

BareTimeZone
  = head:TimeZoneToken tail:(_ !TimeZoneStepBoundary part:TimeZoneToken { return part; })* {
      return [head, ...tail].join(" ");
    }

TimeZoneToken
  = head:[A-Za-z_] tail:[A-Za-z0-9_+\/:-]* {
      return head + tail.join("");
    }

TimeZoneStepBoundary
  = "+"
  / "-"
  / "as" !IdentChar
  / "start" !IdentChar
  / "end" !IdentChar
  / "next" !IdentChar
  / "previous" !IdentChar
  / "prev" !IdentChar
  / "at" !IdentChar
  / "into" !IdentChar
  / "to" !IdentChar
  / "using" !IdentChar
  / "until" !IdentChar
  / "since" !IdentChar

WeekTarget "week target"
  = Weekday
  / "weekday" !IdentChar { return node("WeekTarget", { kind: "weekday" }); }
  / "weekend" !IdentChar { return node("WeekTarget", { kind: "weekend" }); }

Weekday "weekday name"
  = w:(
      "Monday" / "Tuesday" / "Wednesday" / "Thursday" / "Friday" / "Saturday" / "Sunday" /
      "Mon" / "Tue" / "Wed" / "Thu" / "Fri" / "Sat" / "Sun"
    ) !IdentChar {
      return node("WeekTarget", { kind: "weekdayName", value: w });
    }

Unit "unit of time"
  = u:(
      "milliseconds" / "millisecond" /
      "seconds" / "second" / "minutes" / "minute" / "hours" / "hour" /
      "days" / "day" / "weeks" / "week" / "months" / "month" / "years" / "year"
    ) !IdentChar {
      const map = {
        millisecond:"ms", milliseconds:"ms",
        second:"s", seconds:"s",
        minute:"m", minutes:"m",
        hour:"h", hours:"h",
        day:"d", days:"d",
        week:"w", weeks:"w",
        month:"mo", months:"mo",
        year:"y", years:"y",
      };
      return node("Unit", { raw: u, norm: map[u] || u });
    }

Mode
  = m:("clamp" / "roll" / "strict") !IdentChar { return m; }

/* =========================
 * Durations
 * ========================= */

Duration "duration"
  = first:DurationPart rest:(_ DurationPart)* {
      return node("Duration", { parts: [first, ...rest.map(x => x[1])] });
    }

DurationPart "duration part"
  = CompactDurationPart
  / WordyDurationPart

CompactDurationPart
  = n:Int unit:CompactUnit {
      return node("DurationPart", { value: n, unit });
    }

CompactUnit
  = u:("ms" / "s" / "mo" / "m" / "h" / "d" / "w" / "y") { return u; }

WordyDurationPart
  = n:Int _ u:Unit {
      return node("DurationPart", { value: n, unit: u.norm });
    }

/* =========================
 * Time literal (24h + 12h)
 * ========================= */

TimeLiteral "time"
  = TimeAlias
  / Time12
  / Time12HourOnly
  / Time24

TimeAlias
  = "midnight"i !IdentChar {
      return node("Time", { clock: 24, hh: 0, mm: 0, ss: 0 });
    }
  / ("midday"i / "noon"i) !IdentChar {
      return node("Time", { clock: 24, hh: 12, mm: 0, ss: 0 });
    }

Time24
  = hh:TwoDigits ":" mm:TwoDigits ss:(":" TwoDigits)? {
      const H = parseInt(hh, 10);
      const M = parseInt(mm, 10);
      const S = ss ? parseInt(ss[1], 10) : 0;

      if (H > 23) throw new Error("24h time hour must be 00..23");
      if (M > 59) throw new Error("minutes must be 00..59");
      if (S > 59) throw new Error("seconds must be 00..59");

      return node("Time", { clock: 24, hh: H, mm: M, ss: S });
    }

Time12
  = h:Hour12 ":" mm:TwoDigits ss:(":" TwoDigits)? _ mer:Meridiem {
      const H12 = parseInt(h, 10);
      const M = parseInt(mm, 10);
      const S = ss ? parseInt(ss[1], 10) : 0;

      if (M > 59) throw new Error("minutes must be 00..59");
      if (S > 59) throw new Error("seconds must be 00..59");

      let H24 = H12 % 12;
      if (mer === "PM") H24 += 12;

      return node("Time", {
        clock: 12,
        hh: H24,
        mm: M,
        ss: S,
        meridiem: mer,
        inputHour: H12
      });
    }

Hour12
  = "10" { return "10"; }
  / "11" { return "11"; }
  / "12" { return "12"; }
  / d:[1-9] { return d; }

Time12HourOnly
  = h:Hour12 _ mer:Meridiem {
      const H12 = parseInt(h, 10);
      let H24 = H12 % 12;
      if (mer === "PM") H24 += 12;

      return node("Time", {
        clock: 12,
        hh: H24,
        mm: 0,
        ss: 0,
        meridiem: mer,
        inputHour: H12
      });
    }

Meridiem
  = m:("am"i / "pm"i) { return m.toUpperCase(); }
