import type { Diagnostic } from "./LintReport.js";
import {
	isRecord as isObject,
	POST_MIGRATION_PREFIX,
	REQUIRED_CONCURRENCY_FIELDS,
} from "./LintRuleHelpers.js";
import type { LintRecord } from "./SpecRecord.js";

/*
 * P2.1 — Boundary requiredness (ENF-013/014/015/016). Each rule fires only
 * when `rec.id ∈ boundaryIds`. The caller computes boundaryIds once per
 * partition view via reachableBoundaryIds() and threads it in.
 */

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

/*
 * P2.2 — Migration consistency (ENF-017). This rule needs cross-record lookup
 * so the per-record signature carries the full records list.
 */

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
