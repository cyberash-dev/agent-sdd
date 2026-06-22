import type { LintRecord } from "../../../shared/domain/SpecRecord.js";

const NORMATIVE: ReadonlySet<string> = new Set([
	"Behavior",
	"Invariant",
	"Contract",
	"Scenario",
	"NFR",
	"Constraint",
	"Policy",
	"Migration",
	"Delta",
	"GeneratedArtifact",
	"ExternalDependency",
	"LocalizationContract",
	"Surface",
]);

export function isNormative(rec: LintRecord): boolean {
	return rec.template !== null && NORMATIVE.has(rec.template);
}

export function isNotApplicableTestObligation(rec: LintRecord): boolean {
	const v = rec.parsed.test_obligation;
	if (typeof v === "string" && v.startsWith("not_applicable")) {
		return true;
	}
	if (isObject(v) && v.not_applicable !== undefined) {
		return true;
	}
	return false;
}

export function readCompatibilityAction(rec: LintRecord): string | null {
	const ca = rec.parsed.compatibility_action;
	return typeof ca === "string" ? ca : null;
}

export function readMembers(rec: LintRecord): string[] {
	const m = rec.parsed.members;
	if (!Array.isArray(m)) {
		return [];
	}
	return m.filter((v): v is string => typeof v === "string");
}

export function readVersion(rec: LintRecord): string | null {
	const v = rec.parsed.version;
	return typeof v === "string" ? v : null;
}

export function isTerminalStatus(status: string | null): boolean {
	return (
		status === "approved" || status === "deprecated" || status === "removed"
	);
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
