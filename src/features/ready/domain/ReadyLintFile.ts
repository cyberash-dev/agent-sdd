import { reachableBoundaryIds } from "../../../shared/domain/BoundaryReachability.js";
import {
	appendDiagnostic,
	emptyReport,
	type LintReport,
} from "../../../shared/domain/LintReport.js";
import {
	applicabilityRequiredRule,
	approvalRecordRules,
	assumptionDowngradeApprovalRule,
	baselineVersionRequiredRule,
	boundaryConcurrencyModelRule,
	boundaryPolicyRefRule,
	dataScopeRequiredRule,
	debtBudgetFormRule,
	deprecatedFieldsRequiredRule,
	fieldTypeRules,
	generatedArtifactSurfaceRefRule,
	lifecycleStatusRules,
	migrationCrossPartitionRule,
	migrationEnforcementStageRule,
	partitionDefaultPolicySetRule,
	REQUIRED_PARTITION_SECTIONS,
	sectionViolations,
	testObligationRules,
	weaselFindings,
} from "../../../shared/domain/LintRules.js";
import { lintRecordsFromMarkdown } from "../../../shared/domain/SpecRecord.js";

/* Structural shape of a resolved spec file; mirrors the port's SpecFileEntry
 * without importing it (domain must not depend on ports). */
interface SpecFile {
	path: string;
	content: string;
}

export function aggregateLintReport(
	entries: readonly SpecFile[],
	approverBlocklist: readonly string[],
): LintReport {
	let report = emptyReport();
	for (const entry of entries) {
		report = lintFileInto(report, entry, approverBlocklist);
	}
	return report;
}

function lintFileInto(
	report: LintReport,
	entry: SpecFile,
	approverBlocklist: readonly string[],
): LintReport {
	let next = report;
	if (looksLikePartitionFile(entry.content)) {
		for (const v of sectionViolations(entry.content)) {
			next = appendDiagnostic(next, {
				severity: "error",
				rule: v.rule,
				file: entry.path,
				message: v.message,
			});
		}
	}
	const records = lintRecordsFromMarkdown(entry.path, entry.content);
	const boundaryIds = reachableBoundaryIds(records);
	for (const w of weaselFindings(entry.content, records)) {
		const where =
			w.field !== undefined
				? `normative field ${w.field}`
				: `normative section "${w.section}"`;
		next = appendDiagnostic(next, {
			severity: "error",
			rule: "sdd:weasel-word",
			file: entry.path,
			line: w.line,
			message: `Banned phrase "${w.word}" in ${where} (SDD §5.1).`,
		});
	}
	for (const rec of records) {
		for (const d of [
			...lifecycleStatusRules(rec),
			...approvalRecordRules(rec),
			...testObligationRules(rec),
			...fieldTypeRules(rec),
			...baselineVersionRequiredRule(rec),
			...deprecatedFieldsRequiredRule(rec),
			...assumptionDowngradeApprovalRule(rec, approverBlocklist),
			...partitionDefaultPolicySetRule(rec),
			...generatedArtifactSurfaceRefRule(rec),
			...boundaryPolicyRefRule(rec, boundaryIds),
			...boundaryConcurrencyModelRule(rec, boundaryIds),
			...applicabilityRequiredRule(rec, boundaryIds),
			...dataScopeRequiredRule(rec, boundaryIds),
			...migrationEnforcementStageRule(rec, records),
			...migrationCrossPartitionRule(rec),
			...debtBudgetFormRule(rec),
		]) {
			next = appendDiagnostic(next, d);
		}
	}
	return next;
}

function looksLikePartitionFile(markdown: string): boolean {
	const firstNumberedHeading = REQUIRED_PARTITION_SECTIONS[0];
	const re = new RegExp(
		`^##\\s+${firstNumberedHeading.replace(/\./g, "\\.").replace(/ /g, "\\s+")}`,
		"m",
	);
	return re.test(markdown);
}
