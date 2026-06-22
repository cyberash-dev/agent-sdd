import type { PendingAttestation } from "../../../shared/domain/PlanFile.js";
import {
	rewriteApproval,
	type ApprovalAttestation,
} from "../../../shared/domain/SpecApprovalRewrite.js";
import {
	lintRecordsFromMarkdown,
	type LintRecord,
} from "../../../shared/domain/SpecRecord.js";
import {
	applySurfaceMutations,
	computeSurfaceMutations,
} from "../domain/ApplySurfaceImpact.js";
import {
	validateFinalizeGraph,
	type GraphViolation,
} from "../domain/ValidateFinalizeGraph.js";
import type { FinalizeClock } from "../ports/outbound/FinalizeClock.js";
import type { FinalizeConfigPort } from "../ports/outbound/FinalizeConfigPort.js";
import type { FinalizeFileSystem } from "../ports/outbound/FinalizeFileSystem.js";
import type { PlanLoad, PlanRepo } from "../ports/outbound/PlanRepo.js";

export interface RunFinalizePorts {
	clock: FinalizeClock;
	config: FinalizeConfigPort;
	files: FinalizeFileSystem;
	plans: PlanRepo;
}

export type RunFinalizeOutcome =
	| { kind: "no-active-plan" }
	| { kind: "invalid-plan"; planId: string; sourcePath: string; reason: string }
	| { kind: "graph-violation"; planId: string; violations: GraphViolation[] }
	| { kind: "no-id-match"; planId: string; missingIds: string[] }
	| { kind: "unflippable"; planId: string; unflippableIds: string[] }
	| {
			kind: "finalized";
			planId: string;
			finalizedIds: string[];
			filesChanged: string[];
			archivedPath: string;
	  };

export async function runFinalize(
	cwd: string,
	planId: string | undefined,
	ports: RunFinalizePorts,
): Promise<RunFinalizeOutcome> {
	const config = await ports.config.config(cwd);
	const load: PlanLoad = await ports.plans.load(cwd, config.plansDir, planId);
	if (load.kind === "no-active-plan") {
		return { kind: "no-active-plan" };
	}
	if (load.kind === "invalid-plan-file") {
		return {
			kind: "invalid-plan",
			planId: load.planId,
			sourcePath: load.sourcePath,
			reason: load.reason,
		};
	}
	const plan = load.plan;

	const entries = await ports.files.resolveSpecFiles(
		cwd,
		config.lint.specFiles,
	);
	const records = entries.flatMap((e) =>
		lintRecordsFromMarkdown(e.path, e.content),
	);

	const violations = validateFinalizeGraph(records, plan.pendingAttestations);
	if (violations.length > 0) {
		return { kind: "graph-violation", planId: plan.planId, violations };
	}

	/*
	 * INV-012: apply each attestation as a rewriteApproval against the matching
	 * record; abort before writing if any attestation fails to match.
	 */
	const applied = applyAttestations(
		entries,
		plan.pendingAttestations,
		ports.clock.now(),
	);

	if (applied.missingIds.length > 0) {
		return {
			kind: "no-id-match",
			planId: plan.planId,
			missingIds: applied.missingIds,
		};
	}
	/*
	 * BEH-074: a record matched by id but with no rewritable lifecycle anchor
	 * must fail finalize loudly rather than be counted as flipped. Abort before
	 * any write so the spec stays byte-stable, mirroring graph-violation.
	 */
	if (applied.unflippableIds.length > 0) {
		return {
			kind: "unflippable",
			planId: plan.planId,
			unflippableIds: applied.unflippableIds,
		};
	}
	const { filesChanged, archivedPath } = await materializeFinalize({
		cwd,
		plansDir: config.plansDir,
		planId: plan.planId,
		ports,
		entries,
		records,
		attestations: plan.pendingAttestations,
		applied,
	});

	return {
		kind: "finalized",
		planId: plan.planId,
		finalizedIds: applied.finalizedIds,
		filesChanged,
		archivedPath,
	};
}

interface MaterializeFinalizeInput {
	cwd: string;
	plansDir: string;
	planId: string;
	ports: RunFinalizePorts;
	entries: ReadonlyArray<SpecEntry>;
	records: ReadonlyArray<LintRecord>;
	attestations: ReadonlyArray<PendingAttestation>;
	applied: AppliedAttestations;
}

/*
 * BEH-073: after the lifecycle flips, materialise the surface_impact of any
 * Delta approved in this plan, then write the batch and archive the plan.
 */
async function materializeFinalize(
	input: MaterializeFinalizeInput,
): Promise<{ filesChanged: string[]; archivedPath: string }> {
	const {
		cwd,
		plansDir,
		planId,
		ports,
		entries,
		records,
		attestations,
		applied,
	} = input;
	const fileContent = applied.fileContent;

	const approvedIds = approvedAfterPlan(records, attestations);
	const mutations = computeSurfaceMutations(records, approvedIds);
	if (mutations.length > 0) {
		for (const e of entries) {
			const current = fileContent.get(e.path);
			if (current === undefined) {
				continue;
			}
			fileContent.set(e.path, applySurfaceMutations(current, mutations));
		}
	}

	const filesChanged: string[] = [];
	const batch: Array<{ path: string; content: string }> = [];
	for (const e of entries) {
		const next = fileContent.get(e.path);
		if (next !== undefined && next !== e.content) {
			batch.push({ path: e.path, content: next });
			filesChanged.push(e.path);
		}
	}
	await ports.files.writeBatch(cwd, batch);

	const archive = await ports.plans.archive(cwd, plansDir, planId);
	return { filesChanged, archivedPath: archive.archivedPath };
}

interface SpecEntry {
	path: string;
	content: string;
}

const TERMINAL_STATUSES = new Set(["approved", "deprecated", "removed"]);

/*
 * IDs that are >=approved after the plan is applied: those already terminal in
 * the spec plus those the plan flips to a terminal status.
 */
function approvedAfterPlan(
	records: ReadonlyArray<LintRecord>,
	attestations: ReadonlyArray<PendingAttestation>,
): Set<string> {
	const out = new Set<string>();
	for (const r of records) {
		if (
			r.lifecycleStatus !== null &&
			TERMINAL_STATUSES.has(r.lifecycleStatus)
		) {
			out.add(r.id);
		}
	}
	for (const a of attestations) {
		if (TERMINAL_STATUSES.has(a.targetStatus)) {
			out.add(a.id);
		}
	}
	return out;
}

interface AppliedAttestations {
	fileContent: Map<string, string>;
	finalizedIds: string[];
	missingIds: string[];
	unflippableIds: string[];
}

function applyAttestations(
	entries: ReadonlyArray<SpecEntry>,
	attestations: ReadonlyArray<PendingAttestation>,
	when: Date,
): AppliedAttestations {
	const fileContent = new Map<string, string>();
	for (const e of entries) {
		fileContent.set(e.path, e.content);
	}
	const finalizedIds: string[] = [];
	const missingIds: string[] = [];
	const unflippableIds: string[] = [];

	for (const a of attestations) {
		const req: ApprovalAttestation = {
			id: a.id,
			approver: a.approverIdentity,
			ownerRole: a.ownerRole,
			changeRequest: a.changeRequest,
			scope: a.scope,
			targetStatus: a.targetStatus,
			reviewedTestOracle: a.reviewedTestOracle ?? null,
		};
		const reqWhen = new Date(a.timestamp);
		const reqClock = isNaN(reqWhen.valueOf()) ? when : reqWhen;

		let isMatched = false;
		for (const e of entries) {
			const current = fileContent.get(e.path);
			if (current === undefined) {
				continue;
			}
			const result = rewriteApproval(current, req, reqClock);
			if (result.matched.length === 0) {
				continue;
			}
			isMatched = true;
			if (result.flipped.length === 0) {
				unflippableIds.push(a.id);
				break;
			}
			fileContent.set(e.path, result.newContent);
			for (const m of result.flipped) {
				finalizedIds.push(m.id);
			}
			break;
		}
		if (!isMatched) {
			missingIds.push(a.id);
		}
	}

	return { fileContent, finalizedIds, missingIds, unflippableIds };
}
