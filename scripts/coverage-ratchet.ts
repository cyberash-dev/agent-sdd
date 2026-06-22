/*
 * Coverage ratchet. Blocks a commit whose total coverage falls below the floor
 * recorded in coverage-baseline.json; on an improvement it raises the floor and
 * stages the new value into the in-flight commit. Reads the summary produced by
 * `npm run test:coverage` (coverage/coverage-summary.json). Bypass intentional
 * drops with `git commit -n`.
 *
 *   tsx scripts/coverage-ratchet.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUMMARY_PATH = join(ROOT, "coverage", "coverage-summary.json");
const BASELINE_PATH = join(ROOT, "coverage-baseline.json");

const METRICS = ["lines", "statements", "functions", "branches"] as const;
type Metric = (typeof METRICS)[number];
type Coverage = Record<Metric, number>;

/*
 * pct in coverage-summary is rounded to two decimals, so a hundredth of a
 * percent of slack absorbs float noise on the downside without masking a real
 * regression. Math.max on bump keeps the recorded floor from eroding into it.
 */
const EPSILON = 0.005;

function readCurrent(): Coverage {
	if (!existsSync(SUMMARY_PATH)) {
		console.error(
			`coverage-ratchet: ${SUMMARY_PATH} not found — run \`npm run test:coverage\` first`,
		);
		process.exit(1);
	}
	const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8")) as {
		total: Record<Metric, { pct: number }>;
	};
	const current = {} as Coverage;
	for (const metric of METRICS) {
		current[metric] = summary.total[metric].pct;
	}
	return current;
}

function readBaseline(): Coverage | null {
	if (!existsSync(BASELINE_PATH)) {
		return null;
	}
	return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Coverage;
}

function writeBaseline(values: Coverage): void {
	writeFileSync(BASELINE_PATH, `${JSON.stringify(values, null, "\t")}\n`);
	execFileSync("git", ["add", BASELINE_PATH], { cwd: ROOT });
}

function format(values: Coverage): string {
	return METRICS.map((metric) => `${metric} ${values[metric]}%`).join(", ");
}

function main(): void {
	const current = readCurrent();
	const baseline = readBaseline();

	if (baseline === null) {
		writeBaseline(current);
		console.log(`coverage-ratchet: initialised floor at ${format(current)}`);
		return;
	}

	const regressions = METRICS.filter(
		(metric) => current[metric] < baseline[metric] - EPSILON,
	);
	if (regressions.length > 0) {
		console.error(
			"coverage-ratchet: coverage dropped below the recorded floor:",
		);
		for (const metric of regressions) {
			console.error(`  ${metric}: ${current[metric]}% < ${baseline[metric]}%`);
		}
		console.error(
			"Add tests to restore coverage, or bypass intentionally with `git commit -n`.",
		);
		process.exit(1);
	}

	const isRaised = METRICS.some(
		(metric) => current[metric] > baseline[metric] + EPSILON,
	);
	if (isRaised) {
		const next = {} as Coverage;
		for (const metric of METRICS) {
			next[metric] = Math.max(baseline[metric], current[metric]);
		}
		writeBaseline(next);
		console.log(`coverage-ratchet: raised floor to ${format(next)}`);
		return;
	}

	console.log(
		`coverage-ratchet: coverage holds at floor (${format(baseline)})`,
	);
}

main();
