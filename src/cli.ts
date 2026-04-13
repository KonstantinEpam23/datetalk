import { evaluate } from "./evaluator.js";
import { parse } from "./parser.js";

const input = process.argv.slice(2).join(" ").trim();

if (!input) {
	console.log("Usage:");
	console.log(`  npm run dev -- 'now + 72h in Europe/Belgrade'`);
	console.log(`  npm run dev -- '"2026-01-28 14:30" + 90m in UTC'`);
	process.exit(1);
}

try {
	const ast = parse(input);
	const out = evaluate(ast, { defaultZone: "Europe/Belgrade" });

	console.log("AST:", JSON.stringify(ast, null, 2));
	if (out.type === "DateTime") {
		console.log("Result (ISO):", out.value.toISO());
	} else {
		console.log("Result:", out.value);
	}
	if (out.tz) {
		console.log("Timezone:", JSON.stringify(out.tz));
	}
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Error: ${message}`);
	process.exit(1);
}
