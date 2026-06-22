import type { LintRecord } from "../../../shared/domain/SpecRecord.js";
import {
	actualBump,
	bumpAtLeast,
	classifyDiff,
	generatedArtifactStructuralDiffs,
	requiredSurfaceBumps,
} from "./SpecDiff.js";
import type { ReadyViolation } from "./ReadyViolation.js";

/*
 * ENF-004A / ENF-019 — semver cascade over already-loaded prev/curr records.
 * Pure: the application layer fetches the records via git/files and threads
 * them in.
 */
export function cascadeViolations(
	prevRecords: readonly LintRecord[],
	currRecords: readonly LintRecord[],
): ReadyViolation[] {
	const diffs = classifyDiff(prevRecords, currRecords);
	const bumps = requiredSurfaceBumps(prevRecords, currRecords, diffs);
	return [
		...surfaceCascadeViolations(bumps, currRecords),
		...gaStructuralViolations(prevRecords, currRecords, diffs, bumps),
	];
}

function surfaceCascadeViolations(
	bumps: ReturnType<typeof requiredSurfaceBumps>,
	currRecords: readonly LintRecord[],
): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const b of bumps) {
		const actual = actualBump(b.prevDeclaredVersion, b.declaredVersion);
		if (b.required === "patch") {
			continue;
		}
		if (bumpAtLeast(actual, b.required)) {
			continue;
		}
		const surfaceRec = currRecords.find((r) => r.id === b.surfaceId);
		out.push({
			kind: "surface_semver_cascade",
			id: b.surfaceId,
			file: surfaceRec?.file,
			line: surfaceRec?.line,
			expected: b.required,
			actual: actual ?? "patch",
			remediation: `Surface ${b.surfaceId} reachable change requires a ${b.required} bump (declared ${b.prevDeclaredVersion ?? "?"} → ${b.declaredVersion ?? "?"}). Driven by: ${b.drivenBy
				.map((d) => `${d.id} (${d.classification})`)
				.slice(0, 4)
				.join(", ")}${b.drivenBy.length > 4 ? "..." : ""}`,
		});
	}
	return out;
}

/*
 * ENF-019 — emit a dedicated GA-naming violation (always, for traceability)
 * when a published GA structural diff lacks a major Surface bump.
 */
function gaStructuralViolations(
	prevRecords: readonly LintRecord[],
	currRecords: readonly LintRecord[],
	diffs: ReturnType<typeof classifyDiff>,
	bumps: ReturnType<typeof requiredSurfaceBumps>,
): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	const gaDiffs = generatedArtifactStructuralDiffs(
		prevRecords,
		currRecords,
		diffs,
	);
	for (const ga of gaDiffs) {
		const surfaceRec = currRecords.find((r) => r.id === ga.surfaceId);
		const bump = bumps.find((b) => b.surfaceId === ga.surfaceId);
		const actual =
			bump !== undefined
				? actualBump(bump.prevDeclaredVersion, bump.declaredVersion)
				: null;
		if (bumpAtLeast(actual, "major")) {
			continue;
		}
		out.push({
			kind: "generated_artifact_structural_diff_unbumped",
			id: ga.surfaceId,
			file: surfaceRec?.file,
			line: surfaceRec?.line,
			expected: "major",
			actual: actual ?? "patch",
			remediation: `Surface ${ga.surfaceId} reaches GeneratedArtifact ${ga.generatedArtifactId} (published_surface=yes) with ${ga.classification}; structural diff in a published GA requires a major bump on the parent Surface (ENF-019).`,
		});
	}
	return out;
}

/* ENF-020 — debt-budget monotonicity over already-loaded prev/curr records. */
export function debtBudgetViolations(
	prevRecords: readonly LintRecord[],
	currRecords: readonly LintRecord[],
	ref: string,
): ReadyViolation[] {
	const out: ReadyViolation[] = [];
	for (const part of currRecords.filter((r) => r.template === "Partition")) {
		const currBudget = readDebtBudget(part);
		if (currBudget === null) {
			continue;
		}
		const prevPart = prevRecords.find((r) => r.id === part.id);
		if (prevPart === undefined) {
			continue;
		}
		const prevBudget = readDebtBudget(prevPart);
		if (prevBudget === null) {
			continue;
		}
		const violationKind = compareBudgets(currBudget, prevBudget);
		if (violationKind === null) {
			continue;
		}
		out.push({
			kind: "debt_budget_increased",
			id: part.id,
			file: part.file,
			line: part.line,
			expected: violationKind.expected,
			actual: violationKind.actual,
			remediation: `Partition ${part.id} unmodeled_budget.current=${currBudget.current} (was ${prevBudget.current} at ${ref}, trend=${currBudget.trend}); ${violationKind.remediation}`,
		});
	}
	return out;
}

interface DebtBudget {
	current: number;
	trend: "monotonic_non_increasing" | "monotonic_decreasing";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDebtBudget(rec: LintRecord): DebtBudget | null {
	const b = rec.parsed.unmodeled_budget;
	if (!isRecord(b)) {
		return null;
	}
	const current = b.current;
	const trend = b.trend;
	if (typeof current !== "number") {
		return null;
	}
	if (
		trend !== "monotonic_non_increasing" &&
		trend !== "monotonic_decreasing"
	) {
		return null;
	}
	return { current, trend };
}

function compareBudgets(
	curr: DebtBudget,
	prev: DebtBudget,
): { expected: string; actual: string; remediation: string } | null {
	if (curr.trend === "monotonic_non_increasing") {
		if (curr.current > prev.current) {
			return {
				expected: `<= ${prev.current}`,
				actual: String(curr.current),
				remediation:
					"trend=monotonic_non_increasing requires current <= previous current; reduce debt or weaken the trend",
			};
		}
		return null;
	}
	/* monotonic_decreasing */
	if (curr.current >= prev.current) {
		return {
			expected: `< ${prev.current}`,
			actual: String(curr.current),
			remediation:
				"trend=monotonic_decreasing requires current < previous current; reduce debt this PR",
		};
	}
	return null;
}
