import type { Partition, SddConfig } from "../../../shared/domain/Config.js";
import {
	appendDiagnostic,
	type Diagnostic,
	type LintReport,
} from "../../../shared/domain/LintReport.js";
import {
	lintRecordsFromMarkdown,
	type LintRecord,
} from "../../../shared/domain/SpecRecord.js";
import { TOKEN_MECHANISM } from "../../../shared/domain/Token.js";
import {
	aggregatedCheckViolations,
	aggregatedLintViolations,
} from "../domain/AggregatedRules.js";
import type { Marker } from "../domain/MarkerParser.js";
import {
	cascadeViolations,
	debtBudgetViolations,
} from "../domain/ReadyCascade.js";
import { toReadyError } from "../domain/ReadyErrors.js";
import {
	markerLevelViolations,
	perPartitionViolations,
	uniqueSpecPaths,
} from "../domain/ReadyEvaluation.js";
import { aggregatedCheckOutcome } from "../domain/ReadyFreshness.js";
import { aggregateLintReport } from "../domain/ReadyLintFile.js";
import {
	parsePartitionRecords,
	scanPartitionMarkers,
} from "../domain/ReadyParse.js";
import type { ReadyInput } from "../domain/ReadyInput.js";
import {
	envelopeFromError,
	type ReadyAdvisory,
	type ReadyEnvelope,
	type ReadyError,
	type ReadyViolation,
} from "../domain/ReadyViolation.js";
import type { ReadyConfigPort } from "../ports/outbound/ReadyConfigPort.js";
import type {
	ReadyFileReader,
	SpecFileEntry,
	TestFileEntry,
} from "../ports/outbound/ReadyFileReader.js";
import type { ReadyGitPort } from "../ports/outbound/ReadyGitPort.js";

/* Re-export domain types that adapters consume via the application boundary. */
export type { ReadyEnvelope, ReadyError, ReadyViolation };

export interface RunReadyPorts {
	config: ReadyConfigPort;
	files: ReadyFileReader;
	git: ReadyGitPort;
}

export async function runReady(
	cwd: string,
	input: ReadyInput,
	ports: RunReadyPorts,
): Promise<ReadyEnvelope> {
	let config: SddConfig;
	try {
		config = await ports.config.config(cwd);
	} catch (error) {
		return envelopeFromError(toReadyError(error, "config_invalid"));
	}

	const filterName = input.partitionFilter;
	if (
		filterName !== undefined &&
		!config.partitions.some((p) => p.name === filterName)
	) {
		return envelopeFromError({
			kind: "config_invalid",
			message: `unknown partition: ${filterName} (configured: ${config.partitions.map((p) => p.name).join(", ") || "<none>"})`,
		});
	}

	const partitions = config.partitions;
	const evaluatedPartitions =
		filterName === undefined
			? partitions
			: partitions.filter((p) => p.name === filterName);

	const recordsResult = await parseAllPartitionRecords(
		cwd,
		partitions,
		ports.files,
	);
	if (recordsResult.kind === "error") {
		return envelopeFromError(recordsResult.error);
	}
	const recordsByPartition = recordsResult.recordsByPartition;

	const markersResult = await scanAllPartitionMarkers(
		cwd,
		partitions,
		ports.files,
	);
	if (markersResult.kind === "error") {
		return envelopeFromError(markersResult.error);
	}
	const { markersByPartition, advisories } = markersResult;

	const violations: ReadyViolation[] = [
		...perPartitionViolations(
			evaluatedPartitions,
			recordsByPartition,
			markersByPartition,
		),
		...markerLevelViolations(
			partitions,
			recordsByPartition,
			markersByPartition,
		),
	];

	const aggregate = await collectAggregateViolations(
		{ cwd, config, evaluatedPartitions, recordsByPartition, input },
		ports,
	);
	if ("error" in aggregate) {
		return envelopeFromError(aggregate.error);
	}
	violations.push(...aggregate.violations);

	return { ok: violations.length === 0, error: null, violations, advisories };
}

interface AggregateInput {
	cwd: string;
	config: SddConfig;
	evaluatedPartitions: readonly Partition[];
	recordsByPartition: Map<string, LintRecord[]>;
	input: ReadyInput;
}

/* Steps 5-7: aggregated lint, freshness check, and the --against cascade. */
async function collectAggregateViolations(
	a: AggregateInput,
	ports: RunReadyPorts,
): Promise<{ violations: ReadyViolation[] } | { error: ReadyError }> {
	const lintSpecPaths = uniqueSpecPaths(a.evaluatedPartitions, a.config);
	const out: ReadyViolation[] = [];

	const entries = await resolveSpecEntriesSafe(
		a.cwd,
		ports.files,
		lintSpecPaths,
	);
	const lintReport = aggregateLintReport(
		entries,
		a.config.lint.approverBlocklist,
	);
	out.push(...aggregatedLintViolations(lintReport.diagnostics));

	const checkOutcome = await aggregatedCheckOutcome(
		a.cwd,
		a.config,
		a.recordsByPartition,
		ports.git,
	);
	if (checkOutcome.kind === "error") {
		return { error: checkOutcome.error };
	}
	out.push(...aggregatedCheckViolations(checkOutcome.outcome));

	out.push(...(await againstViolations(a.cwd, a.input, lintSpecPaths, ports)));
	return { violations: out };
}

/* ENF-004A / ENF-020 — semver cascade and debt-budget monotonicity run only
 * with --against; without it, ready behaves exactly as in v0.3.x. */
async function againstViolations(
	cwd: string,
	input: ReadyInput,
	lintSpecPaths: readonly string[],
	ports: RunReadyPorts,
): Promise<ReadyViolation[]> {
	if (input.against === undefined || ports.git === undefined) {
		return [];
	}
	const loaded = await loadComparisonRecords(
		cwd,
		input.against,
		lintSpecPaths,
		ports.files,
		ports.git,
	);
	if (loaded === null) {
		return [];
	}
	return [
		...cascadeViolations(loaded.prevRecords, loaded.currRecords),
		...debtBudgetViolations(
			loaded.prevRecords,
			loaded.currRecords,
			input.against,
		),
	];
}

type RecordsResult =
	| { kind: "ok"; recordsByPartition: Map<string, LintRecord[]> }
	| { kind: "error"; error: ReadyError };

/* Phase 1 parses spec files for every configured partition (orphan_covers needs
 * global record knowledge even when --partition filters evaluation). */
async function parseAllPartitionRecords(
	cwd: string,
	partitions: readonly Partition[],
	files: ReadyFileReader,
): Promise<RecordsResult> {
	const recordsByPartition = new Map<string, LintRecord[]>();
	for (const p of partitions) {
		let entries: SpecFileEntry[];
		try {
			entries = await files.resolveSpecFiles(cwd, p.specPaths);
		} catch (error) {
			return { kind: "error", error: toReadyError(error, "config_invalid") };
		}
		const parsed = parsePartitionRecords(entries);
		if (parsed.kind === "error") {
			return {
				kind: "error",
				error: {
					kind: "spec_parse_failed",
					message: parsed.message,
					file: parsed.file,
				},
			};
		}
		recordsByPartition.set(p.name, parsed.records);
	}
	return { kind: "ok", recordsByPartition };
}

type MarkersResult =
	| {
			kind: "ok";
			markersByPartition: Map<string, Marker[]>;
			advisories: ReadyAdvisory[];
	  }
	| { kind: "error"; error: ReadyError };

/* Phase 2 scans test files per partition. A unique file is read once per
 * partition that lists it; markers carry the file path. */
async function scanAllPartitionMarkers(
	cwd: string,
	partitions: readonly Partition[],
	files: ReadyFileReader,
): Promise<MarkersResult> {
	const markersByPartition = new Map<string, Marker[]>();
	const nearMissByKey = new Map<string, ReadyAdvisory>();
	for (const p of partitions) {
		if (p.testPaths.length === 0) {
			markersByPartition.set(p.name, []);
			continue;
		}
		let entries: TestFileEntry[];
		try {
			entries = await files.resolveTestFiles(cwd, p.testPaths);
		} catch (error) {
			return {
				kind: "error",
				error: {
					kind: "unreadable_test_paths",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
		const scanned = scanPartitionMarkers(entries);
		markersByPartition.set(p.name, scanned.markers);
		for (const nm of scanned.nearMisses) {
			nearMissByKey.set(`${nm.file}:${nm.line}:${nm.text}`, nm);
		}
	}
	return {
		kind: "ok",
		markersByPartition,
		advisories: [...nearMissByKey.values()],
	};
}

async function resolveSpecEntriesSafe(
	cwd: string,
	files: ReadyFileReader,
	specPaths: readonly string[],
): Promise<SpecFileEntry[]> {
	if (specPaths.length === 0) {
		return [];
	}
	try {
		return await files.resolveSpecFiles(cwd, specPaths);
	} catch {
		return [];
	}
}

async function loadComparisonRecords(
	cwd: string,
	ref: string,
	specPaths: readonly string[],
	files: ReadyFileReader,
	git: ReadyGitPort,
): Promise<{ prevRecords: LintRecord[]; currRecords: LintRecord[] } | null> {
	if (!(await git.isGitRepo(cwd))) {
		return null;
	}
	const repoRoot = await git.repoRoot(cwd);

	let curr: SpecFileEntry[];
	try {
		curr = await files.resolveSpecFiles(cwd, specPaths);
	} catch {
		return null;
	}

	const currRecords: LintRecord[] = [];
	for (const e of curr) {
		currRecords.push(...lintRecordsFromMarkdown(e.path, e.content));
	}
	const prevRecords: LintRecord[] = [];
	for (const e of curr) {
		const prevContent = await git.readAtRef(repoRoot, ref, e.path);
		if (prevContent === null) {
			continue;
		}
		prevRecords.push(...lintRecordsFromMarkdown(e.path, prevContent));
	}
	return { prevRecords, currRecords };
}

/* Side-effect-free public helper for tests/unit symmetry. */
export function appendLintDiagnostic(
	report: LintReport,
	d: Diagnostic,
): LintReport {
	return appendDiagnostic(report, d);
}

export { TOKEN_MECHANISM };
