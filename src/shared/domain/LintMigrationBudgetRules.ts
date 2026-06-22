import type { Diagnostic } from "./LintReport.js";
import { isRecord as isObject } from "./LintRuleHelpers.js";
import type { LintRecord } from "./SpecRecord.js";

/*
 * P3.1 / P2.2 — debt-budget form (ENF-020) and cross-partition Migration
 * consistency (ENF-018). Each returns 0..N diagnostics for a single record.
 */

/** ENF-020 (P3.1): every Partition record must carry an `unmodeled_budget`
 *  block with the required sub-fields (current, baseline_at, baseline_value,
 *  trend) — see the spec record for the per-field constraints. */
export function debtBudgetFormRule(rec: LintRecord): Diagnostic[] {
	if (rec.template !== "Partition") {
		return [];
	}
	const budget = rec.parsed.unmodeled_budget;
	if (!isObject(budget)) {
		return [
			{
				severity: "error",
				rule: "sdd:debt-budget-form",
				file: rec.file,
				line: rec.line,
				message: `Partition "${rec.id}" is missing unmodeled_budget block (must declare current, baseline_at, baseline_value, trend) (SDD §3 — debt budget).`,
			},
		];
	}
	const out: Diagnostic[] = [];
	const obj = budget;
	const current = obj.current;
	const baselineAt = obj.baseline_at;
	const baselineValue = obj.baseline_value;
	const trend = obj.trend;
	const validTrends = new Set([
		"monotonic_non_increasing",
		"monotonic_decreasing",
	]);

	if (typeof current !== "number" || !Number.isFinite(current) || current < 0) {
		out.push({
			severity: "error",
			rule: "sdd:debt-budget-form",
			file: rec.file,
			line: rec.line,
			message: `Partition "${rec.id}" unmodeled_budget.current must be an integer >= 0 (SDD §3 — debt budget).`,
		});
	}
	if (
		typeof baselineAt !== "string" ||
		!/^\d{4}-\d{2}-\d{2}/.test(baselineAt)
	) {
		out.push({
			severity: "error",
			rule: "sdd:debt-budget-form",
			file: rec.file,
			line: rec.line,
			message: `Partition "${rec.id}" unmodeled_budget.baseline_at must be an ISO date (SDD §3 — debt budget).`,
		});
	}
	if (
		typeof baselineValue !== "number" ||
		!Number.isFinite(baselineValue) ||
		baselineValue < 0
	) {
		out.push({
			severity: "error",
			rule: "sdd:debt-budget-form",
			file: rec.file,
			line: rec.line,
			message: `Partition "${rec.id}" unmodeled_budget.baseline_value must be an integer >= 0 (SDD §3 — debt budget).`,
		});
	}
	if (typeof trend !== "string" || !validTrends.has(trend)) {
		out.push({
			severity: "error",
			rule: "sdd:debt-budget-form",
			file: rec.file,
			line: rec.line,
			message: `Partition "${rec.id}" unmodeled_budget.trend must be in {monotonic_non_increasing, monotonic_decreasing} (SDD §3 — debt budget).`,
		});
	}
	return out;
}

/** ENF-018: a Migration whose target_ids reference IDs from more than one
 *  partition MUST declare partition_slice[] entries with coordinator_id set. */
export function migrationCrossPartitionRule(rec: LintRecord): Diagnostic[] {
	if (rec.template !== "Migration") {
		return [];
	}
	const targets = rec.parsed.target_ids;
	if (!Array.isArray(targets)) {
		return [];
	}
	const partitions = new Set<string>();
	for (const t of targets) {
		if (typeof t !== "string") {
			continue;
		}
		const idx = t.indexOf(":");
		if (idx <= 0) {
			continue;
		}
		partitions.add(t.slice(0, idx));
	}
	if (partitions.size <= 1) {
		return [];
	}

	const slices = rec.parsed.partition_slice;
	if (!Array.isArray(slices) || slices.length === 0) {
		return [
			{
				severity: "error",
				rule: "sdd:migration-cross-partition",
				file: rec.file,
				line: rec.line,
				message: `Migration "${rec.id}" target_ids span ${partitions.size} partitions (${[...partitions].sort().join(", ")}); cross-partition Migrations must declare partition_slice[] with coordinator_id (SDD §11.3-bis).`,
			},
		];
	}
	const hasMissingCoord = slices.some(
		(s) => !isObject(s) || typeof s.coordinator_id !== "string",
	);
	if (hasMissingCoord) {
		return [
			{
				severity: "error",
				rule: "sdd:migration-cross-partition",
				file: rec.file,
				line: rec.line,
				message: `Migration "${rec.id}" partition_slice[] entries must each carry coordinator_id (SDD §11.3-bis).`,
			},
		];
	}
	return [];
}
