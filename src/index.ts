import { parse } from "./parser.js";
import { evaluate } from "./evaluator.js";

const input = process.argv.slice(2).join(" ").trim();

if (!input) {
  console.log("Usage:");
  console.log(`  npm run dev -- 'now + 72h in "Europe/Belgrade"'`);
  console.log(`  npm run dev -- '"2026-01-28 14:30" + 90m in "UTC"'`);
  process.exit(1);
}

const ast = parse(input);
const out = evaluate(ast as any, { defaultZone: "Europe/Belgrade" });

console.log("AST:", JSON.stringify(ast, null, 2));
console.log("Result (ISO):", out.value.toISO());
