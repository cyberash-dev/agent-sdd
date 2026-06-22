import type { LintRecord } from "../../../shared/domain/SpecRecord.js";

export function findBaseline(
	baselineId: string,
	recordsByPartition: ReadonlyMap<string, readonly LintRecord[]>,
): { freshnessToken: string } | null {
	for (const records of recordsByPartition.values()) {
		for (const rec of records) {
			if (rec.id !== baselineId) {
				continue;
			}
			const ft = rec.parsed.freshness_token;
			if (typeof ft === "string") {
				return { freshnessToken: ft };
			}
		}
	}
	return null;
}
