import type { Diagnostic } from "./LintReport.js";
import {
	NORMATIVE_TEMPLATES,
	VALID_LIFECYCLE_STATUS,
	type LintRecord,
} from "./SpecRecord.js";
import {
	WEASEL_ABSOLUTE,
	WEASEL_MODAL_IN_NORMATIVE,
	WEASEL_WORDS as WEASEL_WORDS_SOT,
} from "./WeaselWords.js";

/*
 * Diagnostic rule-IDs emitted below are members of CTR-016 / SUR-009;
 * DiagnosticRegistry.ts holds the canonical list (INV-010 coverage test).
 */

/*
 * Pure rule functions. Each returns 0..N diagnostics for a single record.
 * No I/O. No globals. The caller wires Diagnostics together into a LintReport.
 */

export const REQUIRED_PARTITION_SECTIONS: ReadonlyArray<string> = [
	"1. Context",
	"2. Glossary",
	"3. Partition",
	"4. Brownfield baseline",
	"5. Surfaces",
	"6. Requirements",
	"7. Data contracts",
	"8. Invariants",
	"9. External dependencies",
	"10. Generated artifacts",
	"11. Localization",
	"12. Policies",
	"13. Constraints",
	"14. Migrations",
	"15. Deltas",
	"16. Implementation bindings",
	"17. Open questions",
	"18. Assumptions",
	"19. Out of scope",
];

export const NORMATIVE_SECTIONS: ReadonlyArray<string> = [
	"6. Requirements",
	"7. Data contracts",
	"8. Invariants",
	"9. External dependencies",
	"11. Localization",
	"12. Policies",
	"13. Constraints",
	"14. Migrations",
	"15. Deltas",
];

/*
 * Re-exported from WeaselWords.ts for backward-compatibility with the lint
 * feature's domain shim. Two narrower exports are the new canonical names.
 */
export const WEASEL_WORDS: ReadonlyArray<string> = WEASEL_WORDS_SOT;
export { WEASEL_ABSOLUTE, WEASEL_MODAL_IN_NORMATIVE };

const VALID_EVIDENCE: ReadonlySet<string> = new Set([
	"public_api",
	"test_probe",
	"db_constraint",
	"operational_signal",
]);
const VALID_STABILITY: ReadonlySet<string> = new Set([
	"contractual",
	"internal",
]);
const VALID_DATA_SCOPE_PREFIX: ReadonlyArray<string> = [
	"new_writes_only",
	"all_data",
	"post_migration:",
];
const VALID_VERIFICATION_STAGE: ReadonlySet<string> = new Set([
	"ci_unit",
	"ci_integration",
	"perf_lab",
	"staging_canary",
	"prod_slo",
]);
const VALID_RUNTIME_STATE: ReadonlySet<string> = new Set([
	"pre_cutover",
	"in_progress",
	"cutover_done",
	"rolled_back",
]);
const VALID_DIRECTION: ReadonlySet<string> = new Set([
	"forward_only",
	"reversible",
]);
const VALID_MODE: ReadonlySet<string> = new Set([
	"online",
	"offline",
	"dual_write",
	"backfill",
	"dual_emit_with_legacy_text",
]);
const VALID_BOUNDARY: ReadonlySet<string> = new Set([
	"api",
	"sdk",
	"event_bus",
	"cli",
	"public_db",
	"public_storage",
	"generated_published_artifact",
]);

const OBLIGATIONLESS_TEMPLATES: ReadonlySet<string> = new Set(["Surface"]);

function isMember(set: ReadonlySet<string>, value: string): boolean {
	return set.has(value);
}

function stringifyValue(value: unknown): string {
	return typeof value === "string" ? value : JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* Per-record rules. */

export function lifecycleStatusRules(rec: LintRecord): Diagnostic[] {
	const out: Diagnostic[] = [];
	const isNormative =
		rec.template !== null && isMember(NORMATIVE_TEMPLATES, rec.template);
	if (!isNormative) {
		return out;
	}
	if (rec.lifecycleStatus === null) {
		out.push({
			severity: "error",
			rule: "sdd:lifecycle-status-present",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" missing lifecycle.status (SDD §1.6 + §14).`,
		});
		return out;
	}
	if (!isMember(VALID_LIFECYCLE_STATUS, rec.lifecycleStatus)) {
		out.push({
			severity: "error",
			rule: "sdd:lifecycle-status-valid",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" has invalid lifecycle.status="${rec.lifecycleStatus}". Valid: draft|proposed|approved|deprecated|removed.`,
		});
	}
	return out;
}

export function approvalRecordRules(rec: LintRecord): Diagnostic[] {
	const out: Diagnostic[] = [];
	const isNormative =
		rec.template !== null && isMember(NORMATIVE_TEMPLATES, rec.template);
	if (!isNormative) {
		return out;
	}
	const status = rec.lifecycleStatus;
	const ar = rec.approvalRecord;
	if (
		status === "approved" ||
		status === "deprecated" ||
		status === "removed"
	) {
		if (ar === null || ar === "" || ar.startsWith("not_applicable")) {
			out.push({
				severity: "error",
				rule: "sdd:approval-record-required",
				file: rec.file,
				line: rec.line,
				message: `ID "${rec.id}" has lifecycle.status=${status} but no real approval_record (SDD §7.5).`,
			});
		}
	}
	if (
		(status === "draft" || status === "proposed") &&
		ar !== null &&
		ar !== "" &&
		!ar.startsWith("not_applicable")
	) {
		out.push({
			severity: "error",
			rule: "sdd:approval-record-forbidden",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" has lifecycle.status=${status} but approval_record is set (SDD §7.3).`,
		});
	}
	return out;
}

export function testObligationRules(rec: LintRecord): Diagnostic[] {
	const out: Diagnostic[] = [];
	const isNormative =
		rec.template !== null && isMember(NORMATIVE_TEMPLATES, rec.template);
	if (!isNormative) {
		return out;
	}
	if (rec.template !== null && OBLIGATIONLESS_TEMPLATES.has(rec.template)) {
		return out;
	}
	const hasAny = rec.testObligations.length > 0 || rec.hasAliasedObligations;
	if (hasAny) {
		return out;
	}
	out.push({
		severity: rec.template === "Constraint" ? "warn" : "error",
		rule: "sdd:test-obligation-required",
		file: rec.file,
		line: rec.line,
		message: `ID "${rec.id}" (template=${rec.template}) has no test_obligations / aliased obligation entry (SDD §4).`,
	});
	return out;
}

export function fieldTypeRules(rec: LintRecord): Diagnostic[] {
	const out: Diagnostic[] = [];
	const v = rec.parsed;

	if (rec.template !== "Surface") {
		const versionV = v.version;
		if (
			versionV !== undefined &&
			(typeof versionV !== "number" || !Number.isInteger(versionV))
		) {
			out.push({
				severity: "error",
				rule: "sdd:type-version-int",
				file: rec.file,
				line: rec.line,
				message: `ID "${rec.id}" version="${stringifyValue(versionV)}" is not an integer (SDD §1.5).`,
			});
		}
	}

	if (rec.template === "Invariant") {
		out.push(...invariantFieldTypeRules(rec));
	}

	const ds = v.data_scope;
	if (typeof ds === "string" && ds !== "not_applicable") {
		const ok = VALID_DATA_SCOPE_PREFIX.some(
			(p) => ds === p || ds.startsWith(p),
		);
		if (!ok) {
			out.push({
				severity: "error",
				rule: "sdd:type-data-scope",
				file: rec.file,
				line: rec.line,
				message: `ID "${rec.id}" data_scope="${ds}" not in {new_writes_only, all_data, post_migration:<MIG-ID>} (SDD §14).`,
			});
		}
	}

	if (rec.template === "NFR") {
		const stage = readVerificationStage(v);
		if (stage !== null && !VALID_VERIFICATION_STAGE.has(stage)) {
			out.push({
				severity: "error",
				rule: "sdd:type-nfr-stage",
				file: rec.file,
				line: rec.line,
				message: `ID "${rec.id}" verification_stage="${stage}" not in {ci_unit, ci_integration, perf_lab, staging_canary, prod_slo} (SDD §9.4).`,
			});
		}
	}

	if (rec.template === "Migration") {
		out.push(...migrationFieldTypeRules(rec));
	}

	if (rec.template === "Surface") {
		const bt = v.boundary_type;
		if (typeof bt === "string" && !VALID_BOUNDARY.has(bt)) {
			out.push({
				severity: "error",
				rule: "sdd:type-surface-boundary-type",
				file: rec.file,
				line: rec.line,
				message: `ID "${rec.id}" boundary_type="${bt}" not in {api, sdk, event_bus, cli, public_db, public_storage, generated_published_artifact} (SDD §1.4).`,
			});
		}
	}

	return out;
}

function invariantFieldTypeRules(rec: LintRecord): Diagnostic[] {
	const out: Diagnostic[] = [];
	const v = rec.parsed;
	const ev = v.evidence;
	if (typeof ev === "string" && !VALID_EVIDENCE.has(ev)) {
		out.push({
			severity: "error",
			rule: "sdd:type-invariant-evidence",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" evidence="${ev}" not in {public_api, test_probe, db_constraint, operational_signal} (SDD §1.7).`,
		});
	}
	const st = v.stability;
	if (typeof st === "string" && !VALID_STABILITY.has(st)) {
		out.push({
			severity: "error",
			rule: "sdd:type-invariant-stability",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" stability="${st}" not in {contractual, internal} (SDD §1.7).`,
		});
	}
	return out;
}

function migrationFieldTypeRules(rec: LintRecord): Diagnostic[] {
	const out: Diagnostic[] = [];
	const v = rec.parsed;
	const dir = v.direction;
	if (typeof dir === "string" && !VALID_DIRECTION.has(dir)) {
		out.push({
			severity: "error",
			rule: "sdd:type-migration-direction",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" direction="${dir}" not in {forward_only, reversible} (SDD §14).`,
		});
	}
	const mode = v.mode;
	if (typeof mode === "string" && !VALID_MODE.has(mode)) {
		out.push({
			severity: "error",
			rule: "sdd:type-migration-mode",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" mode="${mode}" not in {online, offline, dual_write, backfill, dual_emit_with_legacy_text} (SDD §14).`,
		});
	}
	const rs = v.runtime_state;
	if (typeof rs === "string" && !VALID_RUNTIME_STATE.has(rs)) {
		out.push({
			severity: "error",
			rule: "sdd:type-migration-runtime-state",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" runtime_state="${rs}" not in {pre_cutover, in_progress, cutover_done, rolled_back} (SDD §11.3-bis).`,
		});
	}
	return out;
}

function readVerificationStage(v: Record<string, unknown>): string | null {
	const vo = v.verification_obligation;
	if (isRecord(vo)) {
		const stage = vo.verification_stage;
		return typeof stage === "string" ? stage : null;
	}
	return null;
}

/*
 * P1 — cheap requiredness rules (ENF-003/009/010/011/012). Each follows the
 * same `(rec: LintRecord) => Diagnostic[]` signature as the §1.4 rules above.
 */

import { isBlockedApprover } from "./AgentBlocklist.js";

/** ENF-003: Delta and Migration records MUST pin a baseline_version. */
export function baselineVersionRequiredRule(rec: LintRecord): Diagnostic[] {
	if (rec.template !== "Delta" && rec.template !== "Migration") {
		return [];
	}
	const v = rec.parsed.baseline_version;
	if (typeof v === "string" && v.length > 0) {
		return [];
	}
	if (typeof v === "number" && Number.isInteger(v)) {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:baseline-version-required",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" (template=${rec.template}) is missing baseline_version (SDD §3 + §11).`,
		},
	];
}

/** ENF-009: records with lifecycle.status=deprecated MUST carry both
 *  sunset_version and replacement_id (SDD §1.6). */
export function deprecatedFieldsRequiredRule(rec: LintRecord): Diagnostic[] {
	if (rec.lifecycleStatus !== "deprecated") {
		return [];
	}
	const out: Diagnostic[] = [];
	const sunset = rec.parsed.sunset_version;
	if (typeof sunset !== "string" || sunset.length === 0) {
		out.push({
			severity: "error",
			rule: "sdd:deprecated-fields-required",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" has lifecycle.status=deprecated but no sunset_version (SDD §1.6).`,
		});
	}
	const repl = rec.parsed.replacement_id;
	if (typeof repl !== "string" || repl.length === 0) {
		out.push({
			severity: "error",
			rule: "sdd:deprecated-fields-required",
			file: rec.file,
			line: rec.line,
			message: `ID "${rec.id}" has lifecycle.status=deprecated but no replacement_id (SDD §1.6).`,
		});
	}
	return out;
}

/** ENF-059: an Open-Q with blocking=yes fails spec-valid (SDD §0);
 *  a `removed` Open-Q is already resolved and does not fire. */
export function openQBlockingRule(rec: LintRecord): Diagnostic[] {
	if (rec.template !== "Open-Q") {
		return [];
	}
	if (rec.lifecycleStatus === "removed") {
		return [];
	}
	const blocking = rec.parsed.blocking;
	if (blocking !== "yes" && blocking !== true) {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:open-q-blocking",
			file: rec.file,
			line: rec.line,
			message: `Open-Q "${rec.id}" is unresolved with blocking=yes (SDD §0 spec-valid).`,
		},
	];
}

/** ENF-010: ASSUMPTIONs downgraded to blocking=advisory MUST carry an
 *  approval_record with a non-agent approver (SDD §7.5); OQ-018 tracks
 *  whether blocking=no should also fire. */
export function assumptionDowngradeApprovalRule(
	rec: LintRecord,
	approverBlocklist: readonly string[] = [],
): Diagnostic[] {
	if (rec.template !== "ASSUMPTION") {
		return [];
	}
	const blocking = rec.parsed.blocking;
	if (blocking !== "advisory") {
		return [];
	}

	const approverIdent = readApproverIdentity(rec);
	if (approverIdent === null) {
		return [
			{
				severity: "error",
				rule: "sdd:assumption-downgrade-approval",
				file: rec.file,
				line: rec.line,
				message: `ASSUMPTION "${rec.id}" has blocking=advisory (downgrade) but no approval_record.approver_identity (SDD §7.5).`,
			},
		];
	}
	if (isBlockedApprover(approverIdent, approverBlocklist)) {
		return [
			{
				severity: "error",
				rule: "sdd:assumption-downgrade-approval",
				file: rec.file,
				line: rec.line,
				message: `ASSUMPTION "${rec.id}" downgrade approver "${approverIdent}" is in the agent blocklist (SDD §7.5: self-approval forbidden).`,
			},
		];
	}
	return [];
}

function readApproverIdentity(rec: LintRecord): string | null {
	/*
	 * approval_record may live nested under lifecycle: or flat at the top level
	 * (the spec's two YAML shapes). Both expose approver_identity as a string.
	 */
	const lifecycle = rec.parsed.lifecycle;
	if (isRecord(lifecycle)) {
		const nested = lifecycle.approval_record;
		if (isRecord(nested)) {
			const id = nested.approver_identity;
			if (typeof id === "string" && id.length > 0) {
				return id;
			}
		}
	}
	const flat = rec.parsed.approval_record;
	if (isRecord(flat)) {
		const id = flat.approver_identity;
		if (typeof id === "string" && id.length > 0) {
			return id;
		}
	}
	return null;
}

/** ENF-011: Partition records MUST carry a default_policy_set field (an array;
 *  empty allowed — explicit "no policies" is still a typed value). */
export function partitionDefaultPolicySetRule(rec: LintRecord): Diagnostic[] {
	if (rec.template !== "Partition") {
		return [];
	}
	const v = rec.parsed.default_policy_set;
	if (Array.isArray(v)) {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:partition-default-policy-set",
			file: rec.file,
			line: rec.line,
			message: `Partition "${rec.id}" is missing default_policy_set (must be an array, may be empty) (SDD §3).`,
		},
	];
}

/** ENF-012: GeneratedArtifact records that publish a Surface (published_surface
 *  == "yes") MUST carry a surface_ref. */
export function generatedArtifactSurfaceRefRule(rec: LintRecord): Diagnostic[] {
	if (rec.template !== "GeneratedArtifact") {
		return [];
	}
	if (rec.parsed.published_surface !== "yes") {
		return [];
	}
	const ref = rec.parsed.surface_ref;
	if (typeof ref === "string" && ref.length > 0) {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:generated-artifact-surface-ref",
			file: rec.file,
			line: rec.line,
			message: `GeneratedArtifact "${rec.id}" has published_surface=yes but no surface_ref (SDD §10).`,
		},
	];
}

/*
 * P2.1 — Boundary requiredness (ENF-013/014/015/016). Each rule fires only
 * when `rec.id ∈ boundaryIds`. The caller computes boundaryIds once per
 * partition view via reachableBoundaryIds() and threads it in.
 */

const REQUIRED_CONCURRENCY_FIELDS: ReadonlyArray<string> = [
	"actor_concurrency",
	"read_consistency",
	"idempotency",
	"time_source",
];

/** ENF-013: boundary CTR/BEH must declare policy_refs (or an explicit
 *  policy_override block with a rationale). */
export function boundaryPolicyRefRule(
	rec: LintRecord,
	boundaryIds: ReadonlySet<string>,
): Diagnostic[] {
	if (!boundaryIds.has(rec.id)) {
		return [];
	}
	const refs = rec.parsed.policy_refs;
	if (Array.isArray(refs) && refs.length > 0) {
		return [];
	}
	if (isObject(refs) && typeof refs.not_applicable === "string") {
		return [];
	}
	const override = rec.parsed.policy_override;
	if (isObject(override) && typeof override.rationale === "string") {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:boundary-policy-ref",
			file: rec.file,
			line: rec.line,
			message: `Boundary ${rec.template} "${rec.id}" must declare policy_refs (or policy_override.rationale) (SDD §12).`,
		},
	];
}

/** ENF-014: boundary CTR/BEH must declare concurrency_model with the four
 *  required sub-fields. */
export function boundaryConcurrencyModelRule(
	rec: LintRecord,
	boundaryIds: ReadonlySet<string>,
): Diagnostic[] {
	if (!boundaryIds.has(rec.id)) {
		return [];
	}
	const cm = rec.parsed.concurrency_model;
	if (isObject(cm) && typeof cm.not_applicable === "string") {
		return [];
	}
	if (!isObject(cm)) {
		return [
			{
				severity: "error",
				rule: "sdd:boundary-concurrency-model",
				file: rec.file,
				line: rec.line,
				message: `Boundary ${rec.template} "${rec.id}" must declare concurrency_model with sub-fields ${REQUIRED_CONCURRENCY_FIELDS.join(", ")} (SDD §1.4).`,
			},
		];
	}
	const obj = cm;
	const missing = REQUIRED_CONCURRENCY_FIELDS.filter(
		(k) => obj[k] === undefined || obj[k] === "",
	);
	if (missing.length === 0) {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:boundary-concurrency-model",
			file: rec.file,
			line: rec.line,
			message: `Boundary ${rec.template} "${rec.id}" concurrency_model is missing sub-fields: ${missing.join(", ")} (SDD §1.4).`,
		},
	];
}

/** ENF-015: boundary CTR/BEH must declare an applicability field (a typed
 *  axis-classification block; `invariant_to_all_axes: true` is acceptable). */
export function applicabilityRequiredRule(
	rec: LintRecord,
	boundaryIds: ReadonlySet<string>,
): Diagnostic[] {
	if (!boundaryIds.has(rec.id)) {
		return [];
	}
	const a = rec.parsed.applicability;
	if (isObject(a) && Object.keys(a).length > 0) {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:applicability-required",
			file: rec.file,
			line: rec.line,
			message: `Boundary ${rec.template} "${rec.id}" is missing applicability (SDD §1.4 — feature_flag/tenant/locale/env/plan_tier/api_version axes).`,
		},
	];
}

/** ENF-016: boundary CTR/BEH touching persistent state must declare
 *  data_scope (allowing `not_applicable` with a reason); persistence is
 *  detected heuristically — see the spec record for the predicate. */
export function dataScopeRequiredRule(
	rec: LintRecord,
	boundaryIds: ReadonlySet<string>,
): Diagnostic[] {
	if (!boundaryIds.has(rec.id)) {
		return [];
	}
	const ds = rec.parsed.data_scope;
	if (typeof ds === "string" && ds.length > 0) {
		return [];
	}
	if (isObject(ds) && typeof ds.not_applicable === "string") {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:data-scope-required",
			file: rec.file,
			line: rec.line,
			message: `Boundary ${rec.template} "${rec.id}" is missing data_scope (SDD §14 — set new_writes_only / all_data / post_migration:<MIG>, or use not_applicable + reason).`,
		},
	];
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/*
 * P2.2 — Migration consistency (ENF-017/018). These rules need cross-record
 * lookup so the per-record signature carries the full records list.
 */

const POST_MIGRATION_PREFIX = "post_migration:";

/** ENF-017: an Invariant/Contract/Behavior with data_scope
 *  `post_migration:<MIG-ID>` requires the referenced Migration to exist and
 *  to declare a non-empty `enforcement_stage` (presence is what we check). */
export function migrationEnforcementStageRule(
	rec: LintRecord,
	records: ReadonlyArray<LintRecord>,
): Diagnostic[] {
	if (
		rec.template !== "Invariant" &&
		rec.template !== "Contract" &&
		rec.template !== "Behavior"
	) {
		return [];
	}
	const ds = rec.parsed.data_scope;
	if (typeof ds !== "string") {
		return [];
	}
	if (!ds.startsWith(POST_MIGRATION_PREFIX)) {
		return [];
	}
	const migId = ds.slice(POST_MIGRATION_PREFIX.length).trim();
	if (migId.length === 0) {
		return [];
	}
	const mig = records.find((r) => r.id === migId);
	if (mig === undefined) {
		return [
			{
				severity: "error",
				rule: "sdd:migration-enforcement-stage",
				file: rec.file,
				line: rec.line,
				message: `${rec.template} "${rec.id}" data_scope=${ds} but referenced Migration "${migId}" is not present in the partition spec (SDD §11.3-bis).`,
			},
		];
	}
	const stage = mig.parsed.enforcement_stage;
	if (typeof stage === "string" && stage.length > 0) {
		return [];
	}
	if (isObject(stage) && typeof stage.marker === "string") {
		return [];
	}
	return [
		{
			severity: "error",
			rule: "sdd:migration-enforcement-stage",
			file: mig.file,
			line: mig.line,
			message: `Migration "${mig.id}" must declare enforcement_stage with a test-controllable marker because ${rec.template} "${rec.id}" depends on it via data_scope=${ds} (SDD §11.3-bis).`,
		},
	];
}

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
	const missingCoord = slices.some(
		(s) => !isObject(s) || typeof s.coordinator_id !== "string",
	);
	if (missingCoord) {
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

/* Section presence (per partition file). Operates on raw markdown. */

export interface SectionViolation {
	rule: "sdd:section-presence" | "sdd:section-order";
	message: string;
}

export function sectionViolations(markdown: string): SectionViolation[] {
	const headings = parseHeadings(markdown);
	const out: SectionViolation[] = [];
	for (let i = 0; i < REQUIRED_PARTITION_SECTIONS.length; i++) {
		const required = REQUIRED_PARTITION_SECTIONS[i];
		if (headings[i] === required) {
			continue;
		}
		if (!headings.includes(required)) {
			out.push({
				rule: "sdd:section-presence",
				message: `Missing required section "${required}" (SDD §2).`,
			});
		} else {
			out.push({
				rule: "sdd:section-order",
				message: `Section "${required}" is out of order; expected position ${i + 1}, found at position ${headings.indexOf(required) + 1}.`,
			});
		}
	}
	return out;
}

function parseHeadings(markdown: string): string[] {
	const out: string[] = [];
	for (const line of markdown.split(/\r?\n/)) {
		const m = /^##\s+(.+?)\s*$/.exec(line);
		if (m !== null && /^\d+\./.test(m[1])) {
			out.push(m[1]);
		}
	}
	return out;
}

/*
 * Weasel-word scan (per file) over raw markdown, in two passes: ABSOLUTE
 * words trigger anywhere in a normative section; MODAL words only inside
 * fields whose IS_NORMATIVE entry is `true`. The modal pass needs the
 * parsed records and is skipped when `records` is omitted.
 */

export interface WeaselFinding {
	line: number;
	word: string;
	section: string;
	/** Present only for modal-pass findings. Names the normative field where
	 *  the word was found, e.g. "Behavior.then". */
	field?: string;
}

import { isFieldNormative } from "./TemplateFieldMetadata.js";

export function weaselFindings(
	markdown: string,
	records?: ReadonlyArray<LintRecord>,
): WeaselFinding[] {
	const lines = markdown.split(/\r?\n/);
	const out = absoluteWeaselFindings(lines);
	if (records !== undefined && records.length > 0) {
		out.push(...modalWeaselFindings(lines, records));
	}
	return out;
}

/* Pass 1: absolute weasels — section-aware only. */
function absoluteWeaselFindings(lines: ReadonlyArray<string>): WeaselFinding[] {
	const out: WeaselFinding[] = [];
	let currentSection = "";
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const headingM = /^##\s+(.+?)\s*$/.exec(line);
		if (headingM !== null) {
			currentSection = headingM[1];
			continue;
		}
		if (!NORMATIVE_SECTIONS.includes(currentSection)) {
			continue;
		}
		const trimmed = line.trim();
		if (trimmed.startsWith("#")) {
			continue;
		}
		if (
			/^-?\s*(id:|test_obligations:|to:|target_ids:|target_id:|source_open_q:)/.test(
				trimmed,
			)
		) {
			continue;
		}
		if (/^to:[a-z-]+:[a-z-]+:/.test(trimmed)) {
			continue;
		}
		const lower = line.toLowerCase();
		for (const w of WEASEL_ABSOLUTE) {
			if (lower.includes(w.toLowerCase())) {
				out.push({ line: i + 1, word: w, section: currentSection });
				break;
			}
		}
	}
	return out;
}

/* Pass 2: modal weasels — field-aware. */
function modalWeaselFindings(
	lines: ReadonlyArray<string>,
	records: ReadonlyArray<LintRecord>,
): WeaselFinding[] {
	const out: WeaselFinding[] = [];
	let currentSection = "";
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const headingM = /^##\s+(.+?)\s*$/.exec(line);
		if (headingM !== null) {
			currentSection = headingM[1];
			continue;
		}
		if (!NORMATIVE_SECTIONS.includes(currentSection)) {
			continue;
		}
		const lower = line.toLowerCase();
		let matched: string | null = null;
		for (const w of WEASEL_MODAL_IN_NORMATIVE) {
			if (lower.includes(w.toLowerCase())) {
				matched = w;
				break;
			}
		}
		if (matched === null) {
			continue;
		}
		const fieldInfo = findFieldAtLine(lines, records, i + 1);
		if (fieldInfo === null) {
			continue;
		}
		if (!isFieldNormative(fieldInfo.record.template, fieldInfo.field)) {
			continue;
		}
		out.push({
			line: i + 1,
			word: matched,
			section: currentSection,
			field: `${fieldInfo.record.template}.${fieldInfo.field}`,
		});
	}
	return out;
}

/**
 * Map a 1-based file line to the owning LintRecord + top-level YAML field:
 * the most recent unindented `<key>:` at or before `line`, bounded by the
 * record's closing fence (or the next record's start).
 */
function findFieldAtLine(
	lines: ReadonlyArray<string>,
	records: ReadonlyArray<LintRecord>,
	line: number,
): { record: LintRecord; field: string } | null {
	let owner: LintRecord | null = null;
	for (const r of records) {
		if (r.line <= line && (owner === null || r.line > owner.line)) {
			owner = r;
		}
	}
	if (owner === null) {
		return null;
	}

	const ownerIdx = owner.line - 1;
	let recordEndIdx = lines.length - 1;
	for (let i = ownerIdx; i < lines.length; i++) {
		if (i > ownerIdx && /^```\s*$/.test(lines[i])) {
			recordEndIdx = i - 1;
			break;
		}
	}
	if (line - 1 > recordEndIdx) {
		return null;
	}

	const topLevelRe = /^([a-z_][a-z0-9_]*)\s*:/i;
	let currentField: string | null = null;
	for (let i = ownerIdx; i <= recordEndIdx; i++) {
		if (i > line - 1) {
			break;
		}
		const m = topLevelRe.exec(lines[i]);
		if (m !== null) {
			currentField = m[1];
		}
	}
	if (currentField === null) {
		return null;
	}

	return { record: owner, field: currentField };
}
