import { parseAllDocuments, parseDocument } from "yaml";

/*
 * Normalised representation of a single normative ID record extracted from a
 * spec markdown file. Lifted from features/lint/domain/{Record.ts,SpecParser.ts}
 * into the shared kernel so multiple slices (lint, ready) can consume the same
 * parsed shape without crossing the cross-feature import boundary.
 */

export type LintTemplate =
	| "Behavior"
	| "Invariant"
	| "Contract"
	| "Scenario"
	| "NFR"
	| "Constraint"
	| "Policy"
	| "Migration"
	| "Delta"
	| "GeneratedArtifact"
	| "ExternalDependency"
	| "LocalizationContract"
	| "Surface"
	| "BrownfieldBaseline"
	| "Partition"
	| "ImplementationBinding";

export const NORMATIVE_TEMPLATES: ReadonlySet<LintTemplate> =
	new Set<LintTemplate>([
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

export type LifecycleStatus =
	| "draft"
	| "proposed"
	| "approved"
	| "deprecated"
	| "removed";

export const VALID_LIFECYCLE_STATUS: ReadonlySet<LifecycleStatus> =
	new Set<LifecycleStatus>([
		"draft",
		"proposed",
		"approved",
		"deprecated",
		"removed",
	]);

export interface LintRecord {
	id: string;
	template: string | null;
	lifecycleStatus: string | null;
	approvalRecord: string | null;
	testObligations: string[];
	hasAliasedObligations: boolean;
	parsed: Record<string, unknown>;
	file: string;
	line: number;
	rawBlock: string;
}

const ALIAS_FIELDS: ReadonlyArray<string> = [
	"negative_test_obligations",
	"tests_pre",
	"tests_during",
	"tests_post",
	"tests_old_behavior",
	"tests_new_behavior",
];

export function lintRecordsFromMarkdown(
	file: string,
	markdown: string,
): LintRecord[] {
	const out: LintRecord[] = [];
	for (const fence of yamlFences(markdown)) {
		out.push(...lintRecordsFromFence(file, fence));
	}
	return out;
}

interface YamlFence {
	raw: string;
	startLine: number;
}

function yamlFences(markdown: string): YamlFence[] {
	const lines = markdown.split(/\r?\n/);
	const fences: YamlFence[] = [];
	let inFence = false;
	let buffer: string[] = [];
	let startLine = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!inFence && /^```yaml\s*$/.test(line)) {
			inFence = true;
			buffer = [];
			startLine = i + 2;
			continue;
		}
		if (inFence && /^```\s*$/.test(line)) {
			fences.push({ raw: buffer.join("\n"), startLine });
			inFence = false;
			continue;
		}
		if (inFence) {
			buffer.push(line);
		}
	}
	return fences;
}

function lintRecordsFromFence(file: string, fence: YamlFence): LintRecord[] {
	const hasSeparator = fence.raw.split(/\r?\n/).some((l) => l === "---");

	if (hasSeparator) {
		const docs = parseAllDocuments(fence.raw, { prettyErrors: false });
		const out: LintRecord[] = [];
		for (const doc of docs) {
			if (doc.errors.length > 0) {
				continue;
			}
			const value = doc.toJS() as unknown;
			if (!isObject(value)) {
				continue;
			}
			const rec = recordFromObject(
				file,
				value,
				fence.startLine + (doc.range?.[0] ?? 0),
			);
			if (rec !== null) {
				out.push(rec);
			}
		}
		return out;
	}

	const doc = parseDocument(fence.raw, { prettyErrors: false });
	if (doc.errors.length > 0) {
		return [];
	}
	const value = doc.toJS() as unknown;

	if (Array.isArray(value)) {
		const out: LintRecord[] = [];
		const fenceLines = fence.raw.split(/\r?\n/);
		let cursor = 0;
		for (const item of value) {
			if (!isObject(item)) {
				continue;
			}
			const id = typeof item.id === "string" ? item.id : null;
			let lineWithin = cursor;
			if (id !== null) {
				for (let j = cursor; j < fenceLines.length; j++) {
					if (
						new RegExp(`^-\\s+id:\\s*${escapeRe(id)}\\b`).test(fenceLines[j])
					) {
						lineWithin = j;
						cursor = j + 1;
						break;
					}
				}
			}
			const rec = recordFromObject(file, item, fence.startLine + lineWithin);
			if (rec !== null) {
				out.push(rec);
			}
		}
		return out;
	}

	if (isObject(value)) {
		const rec = recordFromObject(file, value, fence.startLine);
		return rec === null ? [] : [rec];
	}

	return [];
}

function recordFromObject(
	file: string,
	value: Record<string, unknown>,
	line: number,
): LintRecord | null {
	const id = typeof value.id === "string" ? value.id : null;
	if (id === null) {
		return null;
	}

	const template = pickTemplate(value);
	const lifecycleStatus = pickLifecycleStatus(value);
	const approvalRecord = pickApprovalRecord(value);
	const testObligations = stringArray(value.test_obligations);
	const hasAliasedObligations =
		ALIAS_FIELDS.some((k) => value[k] !== undefined) ||
		hasSingularTestObligation(value);

	return {
		id,
		template,
		lifecycleStatus,
		approvalRecord,
		testObligations,
		hasAliasedObligations,
		parsed: value,
		file,
		line,
		rawBlock: "",
	};
}

function hasSingularTestObligation(value: Record<string, unknown>): boolean {
	const v = value.test_obligation;
	if (isObject(v)) {
		return true;
	}
	if (typeof v === "string" && v.startsWith("not_applicable")) {
		return true;
	}
	return false;
}

function pickTemplate(value: Record<string, unknown>): string | null {
	const t = value.template ?? value.type;
	return typeof t === "string" ? t : null;
}

function pickLifecycleStatus(value: Record<string, unknown>): string | null {
	const flat = value["lifecycle.status"];
	if (typeof flat === "string") {
		return flat;
	}
	const nested = value.lifecycle;
	if (isObject(nested) && typeof nested.status === "string") {
		return nested.status;
	}
	return null;
}

function pickApprovalRecord(value: Record<string, unknown>): string | null {
	const top = value.approval_record;
	const fromTop = describeApprovalRecord(top);
	if (fromTop !== null) {
		return fromTop;
	}
	const lifecycle = value.lifecycle;
	if (isObject(lifecycle)) {
		return describeApprovalRecord(lifecycle.approval_record);
	}
	return null;
}

function describeApprovalRecord(v: unknown): string | null {
	if (v === undefined) {
		return null;
	}
	if (typeof v === "string") {
		return v;
	}
	if (isObject(v)) {
		const tag =
			typeof v.approver_identity === "string"
				? `obj:${v.approver_identity}`
				: "obj:unknown";
		return tag;
	}
	return null;
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((v): v is string => typeof v === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRe(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
