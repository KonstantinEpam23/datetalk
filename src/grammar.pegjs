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

DOTS      = ".."

Int
  = digits:[0-9]+ { return parseInt(digits.join(""), 10); }

TwoDigits
  = d:[0-9][0-9] { return d.join(""); }

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
  = WithinExpr
  / RangeExpr
  / DateTimeExpr

WithinExpr
  = dt:DateTimeExpr _ "is" !IdentChar _ "within" !IdentChar _ r:RangeValue {
      return node("Within", { value: dt, range: r });
    }

RangeExpr
  = a:DateTimeExpr _ DOTS _ b:DateTimeExpr {
      return node("DateRange", { start: a, end: b });
    }

DateTimeExpr
  = head:Primary tail:(_ Step)* {
      const steps = tail.map(t => t[1]);
      return node("DateTimeExpr", { head, steps });
    }

/* =========================
 * Primary values
 * ========================= */

Primary
  = RangeStart
  / RangeEnd
  / RangeDays
  / Now
  / Today
  / Tomorrow
  / Yesterday
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

/* =========================
 * Range queries
 * ========================= */

RangeValue
  = RangeExpr
  / "(" _ r:RangeExpr _ ")" { return r; }

RangeStart
  = "start" !IdentChar _ "of" !IdentChar _ r:RangeValue {
      return node("RangeStart", { range: r });
    }

RangeEnd
  = "end" !IdentChar _ "of" !IdentChar _ r:RangeValue {
      return node("RangeEnd", { range: r });
    }

RangeDays
  = "days" !IdentChar _ "in" !IdentChar _ r:RangeValue {
      return node("RangeDays", { range: r });
    }

/* =========================
 * Steps (DateTime transforms)
 * ========================= */

Step
  = AddSub
  / InTZ
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

AsFormat
  = "as" !IdentChar _ fmt:StringLiteral {
      return node("AsFormat", { format: fmt });
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

UsingMode
  = "using" !IdentChar _ m:Mode {
      return node("UsingMode", { mode: m });
    }

/* =========================
 * Atoms
 * ========================= */

TimeZone
  = StringLiteral

WeekTarget
  = Weekday
  / "weekday" !IdentChar { return node("WeekTarget", { kind: "weekday" }); }
  / "weekend" !IdentChar { return node("WeekTarget", { kind: "weekend" }); }

Weekday
  = w:(
      "Mon" / "Tue" / "Wed" / "Thu" / "Fri" / "Sat" / "Sun" /
      "Monday" / "Tuesday" / "Wednesday" / "Thursday" / "Friday" / "Saturday" / "Sunday"
    ) !IdentChar {
      return node("WeekTarget", { kind: "weekdayName", value: w });
    }

Unit
  = u:(
      "second" / "seconds" / "minute" / "minutes" / "hour" / "hours" /
      "day" / "days" / "week" / "weeks" / "month" / "months" / "year" / "years"
    ) !IdentChar {
      const map = {
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

Duration
  = first:DurationPart rest:(_ DurationPart)* {
      return node("Duration", { parts: [first, ...rest.map(x => x[1])] });
    }

DurationPart
  = CompactDurationPart
  / WordyDurationPart

CompactDurationPart
  = n:Int unit:CompactUnit {
      return node("DurationPart", { value: n, unit });
    }

CompactUnit
  = u:("ms" / "s" / "m" / "h" / "d" / "w" / "mo" / "y") { return u; }

WordyDurationPart
  = n:Int _ u:Unit {
      return node("DurationPart", { value: n, unit: u.norm });
    }

/* =========================
 * Time literal (24h + 12h)
 * ========================= */

TimeLiteral
  = Time12
  / Time24

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

Meridiem
  = m:("am"i / "pm"i) { return m.toUpperCase(); }
