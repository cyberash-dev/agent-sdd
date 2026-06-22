import { isBlockedApprover } from "./AgentBlocklist.js";
import type { Diagnostic } from "./LintReport.js";
import { isRecord } from "./LintRuleHelpers.js";
import type { LintRecord } from "./SpecRecord.js";

/*
 * P1 — cheap requiredness rules (ENF-003/009/010/011/012). Each follows the
 * same `(rec: LintRecord) => Diagnostic[]` signature as the §1.4 rules.
 */

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
