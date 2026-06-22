import type { Diagnostic } from "./LintReport.js";
import {
	isMember,
	isRecord,
	OBLIGATIONLESS_TEMPLATES,
	stringifyValue,
	VALID_BOUNDARY,
	VALID_DATA_SCOPE_PREFIX,
	VALID_DIRECTION,
	VALID_EVIDENCE,
	VALID_MODE,
	VALID_RUNTIME_STATE,
	VALID_STABILITY,
	VALID_VERIFICATION_STAGE,
} from "./LintRuleHelpers.js";
import {
	NORMATIVE_TEMPLATES,
	VALID_LIFECYCLE_STATUS,
	type LintRecord,
} from "./SpecRecord.js";

/*
 * Per-record field and type rules (SDD §1.4-1.7). Each returns 0..N diagnostics
 * for a single record. Diagnostic rule-IDs are members of CTR-016 / SUR-009;
 * DiagnosticRegistry.ts holds the canonical list (INV-010 coverage test).
 */

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
		const isValidDataScope = VALID_DATA_SCOPE_PREFIX.some(
			(p) => ds === p || ds.startsWith(p),
		);
		if (!isValidDataScope) {
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
