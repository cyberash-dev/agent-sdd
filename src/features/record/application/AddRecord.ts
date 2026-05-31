import { findMatches } from "../../../shared/domain/SpecApprovalRewrite.js";
import { lintRecordsFromMarkdown } from "../../../shared/domain/SpecRecord.js";
import { inspectBody, normalizeBody } from "../domain/RecordBody.js";
import {
	isProtectedStatus,
	type RecordWriteResult,
} from "../domain/RecordWrite.js";
import type { RecordConfigPort } from "../ports/outbound/RecordConfigPort.js";
import type {
	RecordFileReader,
	SpecFileEntry,
} from "../ports/outbound/RecordFileReader.js";
import type { RecordFileWriter } from "../ports/outbound/RecordFileWriter.js";

type WritePorts = {
	config: RecordConfigPort;
	files: RecordFileReader;
	writer: RecordFileWriter;
};

export async function addRecord(
	cwd: string,
	afterId: string,
	rawBody: string,
	ports: WritePorts,
): Promise<RecordWriteResult> {
	const body = normalizeBody(rawBody);
	const facts = inspectBody(body);
	if (facts.id === null) {
		return invalid("body has no id or does not parse as YAML");
	}
	if (isProtectedStatus(facts.status)) {
		return governed(
			`refusing to add a record with lifecycle.status ${facts.status}; add as draft/proposed`,
		);
	}

	const config = await ports.config.config(cwd);
	const entries = await ports.files.resolveSpecFiles(
		cwd,
		config.lint.specFiles,
	);

	for (const entry of entries) {
		if (
			lintRecordsFromMarkdown(entry.path, entry.content).some(
				(r) => r.id === facts.id,
			)
		) {
			return duplicate(`id already exists: ${facts.id}`);
		}
	}

	const anchors = locate(entries, afterId);
	if (anchors.length === 0) {
		return notFound(`anchor not found: ${afterId}`);
	}
	if (anchors.length > 1) {
		return ambiguous(
			`anchor id is ambiguous: ${afterId} matches ${anchors.length} records`,
		);
	}
	const anchor = anchors[0];

	const lines = anchor.entry.content.split(/\r?\n/);
	let fenceClose = -1;
	for (let i = anchor.endLine - 1; i < lines.length; i++) {
		if (/^```\s*$/.test(lines[i])) {
			fenceClose = i;
			break;
		}
	}
	if (fenceClose === -1) {
		return invalid(`could not locate the fence enclosing anchor ${afterId}`);
	}

	const bodyLines = body.split("\n");
	const block = ["", "```yaml", "---", ...bodyLines, "---", "```"];
	const newLines = [
		...lines.slice(0, fenceClose + 1),
		...block,
		...lines.slice(fenceClose + 1),
	];
	await ports.writer.writeSpecFile(cwd, anchor.entry.path, newLines.join("\n"));

	const startLine =
		fenceClose +
		1 +
		3 +
		1; /* ``` (1-based) + blank + ```yaml + --- → first body line */
	return {
		ok: true,
		action: "add",
		id: facts.id,
		file: anchor.entry.path,
		startLine,
		endLine: startLine + bodyLines.length,
	};
}

interface Hit {
	entry: SpecFileEntry;
	startLine: number;
	endLine: number;
}

function locate(entries: readonly SpecFileEntry[], id: string): Hit[] {
	const hits: Hit[] = [];
	for (const entry of entries) {
		for (const m of findMatches(entry.content.split(/\r?\n/), id)) {
			hits.push({ entry, startLine: m.startLine, endLine: m.endLine });
		}
	}
	return hits;
}

function invalid(message: string): RecordWriteResult {
	return { ok: false, exitCode: 2, reason: "invalid-body", message };
}
function notFound(message: string): RecordWriteResult {
	return { ok: false, exitCode: 1, reason: "anchor-not-found", message };
}
function ambiguous(message: string): RecordWriteResult {
	return { ok: false, exitCode: 1, reason: "record-ambiguous", message };
}
function duplicate(message: string): RecordWriteResult {
	return { ok: false, exitCode: 1, reason: "duplicate-id", message };
}
function governed(message: string): RecordWriteResult {
	return { ok: false, exitCode: 1, reason: "record-protected", message };
}
