import {
	NORMATIVE_SECTIONS,
	REQUIRED_PARTITION_SECTIONS,
} from "./LintSections.js";
import type { LintRecord } from "./SpecRecord.js";
import { isFieldNormative } from "./TemplateFieldMetadata.js";
import { WEASEL_ABSOLUTE, WEASEL_MODAL_IN_NORMATIVE } from "./WeaselWords.js";

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
