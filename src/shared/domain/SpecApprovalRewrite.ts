/*
 * CST-003 / INV-004: pure rewriter shared by the approve and finalize slices;
 * no I/O — the adapter handles read/write.
 */

export type ApprovalTargetStatus = "approved" | "deprecated" | "removed";

export interface ApprovalAttestation {
	id: string; /* exact ID or glob with `*` */
	approver: string;
	ownerRole: string;
	changeRequest: string;
	scope: string;
	targetStatus: ApprovalTargetStatus;
	reviewedTestOracle: string | null;
}

export interface IdMatch {
	id: string;
	startLine: number; /* 1-based, line containing `- id:` or `id:` */
	endLine: number; /* 1-based, exclusive end (next record start or end-of-fence) */
	indent: string; /* leading whitespace before the field-level keys */
}

export interface RewriteResult {
	newContent: string;
	matched: IdMatch[];
	/* Subset of `matched` whose lifecycle.status was actually rewritten. A
	 * record matched by id but carrying no rewritable lifecycle anchor stays in
	 * `matched` yet is absent here, so callers never over-count flips. */
	flipped: IdMatch[];
}

export function rewriteApproval(
	content: string,
	req: ApprovalAttestation,
	when: Date,
): RewriteResult {
	const lines = content.split(/\r?\n/);
	const matches = findMatches(lines, req.id);
	if (matches.length === 0) {
		return { newContent: content, matched: [], flipped: [] };
	}

	/* Apply matches from last to first so line indices stay stable. */
	const sorted = [...matches].sort((a, b) => b.startLine - a.startLine);
	let buf = [...lines];
	const flipped: IdMatch[] = [];
	for (const m of sorted) {
		const result = applyOne(buf, m, req, when);
		buf = result.lines;
		if (result.flipped) {
			flipped.push(m);
		}
	}
	return { newContent: buf.join("\n"), matched: matches, flipped };
}

type StatusKind = "flat" | "nested" | "flow" | null;

interface AnchorScan {
	statusKind: StatusKind;
	statusIdx: number;
	statusIndent: string;
	approvalIndent: string;
	approvalIdx: number;
}

/*
 * INV-007: the lifecycle anchor exists in two YAML shapes (flat
 * `lifecycle.status:` and nested `lifecycle:` + `status:`); pick the first
 * anchor found so it can be written back in the same shape.
 */
function scanAnchors(block: string[], fallbackIndent: string): AnchorScan {
	let statusKind: StatusKind = null;
	let statusIdx = -1;
	let statusIndent = fallbackIndent;
	let approvalIndent = fallbackIndent;
	let approvalIdx = -1;

	for (let i = 0; i < block.length; i++) {
		const line = block[i];
		if (statusKind === null) {
			const flat = /^(\s*)lifecycle\.status:/.exec(line);
			if (flat !== null) {
				statusKind = "flat";
				statusIdx = i;
				statusIndent = flat[1];
				approvalIndent = flat[1];
				continue;
			}
			/* INV-007: inline flow form `lifecycle: { status: … }`. The nested
			 * header below requires `lifecycle:` at end-of-line, so the two
			 * shapes never collide. */
			const flow = /^(\s*)lifecycle:\s*\{[^}]*\bstatus:\s*\S/.exec(line);
			if (flow !== null) {
				statusKind = "flow";
				statusIdx = i;
				statusIndent = flow[1];
				approvalIndent = flow[1];
				continue;
			}
			const nestedHeader = /^(\s*)lifecycle:\s*$/.exec(line);
			if (nestedHeader !== null) {
				const headerIndent = nestedHeader[1];
				const childIndent = `${headerIndent}  `;
				for (let j = i + 1; j < block.length; j++) {
					const child = block[j];
					if (new RegExp(`^${childIndent}status:\\s*\\S`).test(child)) {
						statusKind = "nested";
						statusIdx = j;
						statusIndent = childIndent;
						approvalIndent = childIndent;
						break;
					}
					if (child.length > 0 && !child.startsWith(headerIndent)) {
						break;
					}
					if (
						child.length > 0 &&
						child.startsWith(headerIndent) &&
						!child.startsWith(childIndent)
					) {
						break;
					}
				}
			}
		}
		if (approvalIdx < 0) {
			const ar = /^(\s*)approval_record:/.exec(line);
			if (ar !== null) {
				approvalIdx = i;
			}
		}
	}

	return { statusKind, statusIdx, statusIndent, approvalIndent, approvalIdx };
}

/*
 * Strip the existing block (header + its deeper-indented children) before
 * writing the new one, so repeated approvals don't interleave records.
 */
function approvalBlockEnd(block: string[], approvalIdx: number): number {
	const headerMatch = /^(\s*)approval_record:/.exec(block[approvalIdx] ?? "");
	const headerIndent = headerMatch !== null ? headerMatch[1].length : 0;
	let endExclusive = approvalIdx + 1;
	while (endExclusive < block.length) {
		const line = block[endExclusive];
		if (line.trim().length === 0) {
			break;
		}
		const indentMatch = /^(\s*)/.exec(line);
		const lineIndent = indentMatch !== null ? indentMatch[1].length : 0;
		if (lineIndent <= headerIndent) {
			break;
		}
		endExclusive++;
	}
	return endExclusive;
}

function applyOne(
	lines: string[],
	m: IdMatch,
	req: ApprovalAttestation,
	when: Date,
): { lines: string[]; flipped: boolean } {
	const sliceStart = m.startLine - 1;
	const sliceEndExclusive = m.endLine - 1;
	const before = lines.slice(0, sliceStart);
	const block = lines.slice(sliceStart, sliceEndExclusive);
	const after = lines.slice(sliceEndExclusive);

	const { statusKind, statusIdx, statusIndent, approvalIndent, approvalIdx } =
		scanAnchors(block, m.indent);

	if (statusKind === null) {
		return { lines: [...before, ...block, ...after], flipped: false };
	}

	if (statusKind === "flat") {
		block[statusIdx] = `${statusIndent}lifecycle.status: ${req.targetStatus}`;
	} else if (statusKind === "flow") {
		block[statusIdx] = block[statusIdx].replace(
			/(lifecycle:\s*\{[^}]*\bstatus:\s*)[A-Za-z_][\w-]*/,
			`$1${req.targetStatus}`,
		);
	} else {
		block[statusIdx] = `${statusIndent}status: ${req.targetStatus}`;
	}

	const approvalLines = approvalBlock(req, when, approvalIndent);
	if (approvalIdx >= 0) {
		const endExclusive = approvalBlockEnd(block, approvalIdx);
		block.splice(approvalIdx, endExclusive - approvalIdx, ...approvalLines);
	} else {
		block.splice(statusIdx + 1, 0, ...approvalLines);
	}

	return { lines: [...before, ...block, ...after], flipped: true };
}

function approvalBlock(
	req: ApprovalAttestation,
	when: Date,
	indent: string,
): string[] {
	const out = [
		`${indent}approval_record:`,
		`${indent}  owner_role: ${yamlScalar(req.ownerRole)}`,
		`${indent}  approver_identity: ${yamlScalar(req.approver)}`,
		`${indent}  timestamp: ${when.toISOString()}`,
		`${indent}  change_request: ${yamlScalar(req.changeRequest)}`,
		`${indent}  scope: ${yamlScalar(req.scope)}`,
	];
	if (req.reviewedTestOracle !== null) {
		out.push(
			`${indent}  reviewed_test_oracle: ${yamlScalar(req.reviewedTestOracle)}`,
		);
	}
	return out;
}

/*
 * Emit a value as a YAML scalar, quoting only when the raw string would parse
 * differently as plain YAML (e.g. `:` followed by whitespace reads as a nested
 * mapping). Plain URLs lack `: ` and stay unquoted.
 */
function yamlScalar(value: string): string {
	if (value.length === 0) {
		return '""';
	}
	const needsQuoting =
		/:\s/.test(value) || /^[\s?\-#&*!|>'"%@`]/.test(value) || /\s$/.test(value);
	if (!needsQuoting) {
		return value;
	}
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

class RecordCursor {
	private start = -1;
	private id = "";
	private indent = "";
	private anchorIndent = "";

	constructor(
		private readonly idOrGlob: string,
		private readonly out: IdMatch[],
	) {}

	close(endLine: number): void {
		if (this.start < 0) {
			return;
		}
		if (matchId(this.idOrGlob, this.id)) {
			this.out.push({
				id: this.id,
				startLine: this.start + 1,
				endLine: endLine + 1,
				indent: this.indent,
			});
		}
		this.start = -1;
		this.id = "";
		this.indent = "";
		this.anchorIndent = "";
	}

	open(start: number, id: string, indent: string, anchorIndent: string): void {
		this.start = start;
		this.id = id;
		this.indent = indent;
		this.anchorIndent = anchorIndent;
	}

	isOpen(): boolean {
		return this.start >= 0;
	}

	anchorIndentLength(): number {
		return this.anchorIndent.length;
	}
}

function classifyLine(
	line: string,
	i: number,
	fenceStart: number,
	cursor: RecordCursor,
): void {
	if (line === "---") {
		cursor.close(i);
		return;
	}
	const listM = /^(\s*)-\s+id:\s*(\S+)/.exec(line);
	if (listM !== null) {
		/*
		 * INV-007: a `- id:` is a record boundary only when no record is open or
		 * it is a sibling-or-shallower list item; a deeper `- id:` is record body.
		 */
		const lead = listM[1];
		if (!cursor.isOpen() || lead.length <= cursor.anchorIndentLength()) {
			cursor.close(i);
			cursor.open(i, listM[2], `${lead}  `, lead);
			return;
		}
	}
	const flatM = /^(\s*)id:\s*(\S+)/.exec(line);
	if (flatM !== null && fenceStart >= 0 && i === fenceStart + 1) {
		cursor.close(i);
		cursor.open(i, flatM[2], flatM[1], flatM[1]);
		return;
	}
	if (flatM !== null && !cursor.isOpen()) {
		cursor.open(i, flatM[2], flatM[1], flatM[1]);
	}
}

export function findMatches(
	lines: readonly string[],
	idOrGlob: string,
): IdMatch[] {
	const out: IdMatch[] = [];
	const cursor = new RecordCursor(idOrGlob, out);
	let inFence = false;
	let fenceStart = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!inFence && /^```yaml\s*$/.test(line)) {
			inFence = true;
			fenceStart = i;
			continue;
		}
		if (inFence && /^```\s*$/.test(line)) {
			cursor.close(i);
			inFence = false;
			fenceStart = -1;
			continue;
		}
		if (!inFence) {
			continue;
		}

		classifyLine(line, i, fenceStart, cursor);
	}
	return out;
}

export function matchId(pattern: string, candidate: string): boolean {
	if (pattern === candidate) {
		return true;
	}
	if (!pattern.includes("*")) {
		return false;
	}
	const re = new RegExp(
		`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
	);
	return re.test(candidate);
}
