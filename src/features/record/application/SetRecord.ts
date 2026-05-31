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

export interface RecordWritePorts {
	config: RecordConfigPort;
	files: RecordFileReader;
	writer: RecordFileWriter;
}

export type { RecordWriteResult };

export async function setRecord(
	cwd: string,
	id: string,
	rawBody: string,
	ports: RecordWritePorts,
): Promise<RecordWriteResult> {
	const body = normalizeBody(rawBody);
	const facts = inspectBody(body);
	if (facts.id === null) {
		return invalid("body has no id or does not parse as YAML");
	}
	if (facts.id !== id) {
		return invalid(`body id (${facts.id}) does not match target id (${id})`);
	}
	if (isProtectedStatus(facts.status)) {
		return governed(
			`refusing to set lifecycle.status ${facts.status}; promote via sdd approve + sdd finalize`,
		);
	}

	const config = await ports.config.config(cwd);
	const entries = await ports.files.resolveSpecFiles(
		cwd,
		config.lint.specFiles,
	);

	const hits = locate(entries, id);
	if (hits.length === 0) {
		return notFound(`record not found: ${id}`);
	}
	if (hits.length > 1) {
		return ambiguous(
			`record id is ambiguous: ${id} matches ${hits.length} records`,
		);
	}
	const hit = hits[0];

	const current = lintRecordsFromMarkdown(
		hit.entry.path,
		hit.entry.content,
	).find((r) => r.id === id);
	if (current !== undefined && isProtectedStatus(current.lifecycleStatus)) {
		return governed(
			`refusing to edit ${current.lifecycleStatus} record ${id}; use sdd approve + sdd finalize`,
		);
	}

	const lines = hit.entry.content.split(/\r?\n/);
	const bodyLines = body.split("\n");
	const newLines = [
		...lines.slice(0, hit.startLine - 1),
		...bodyLines,
		...lines.slice(hit.endLine - 1),
	];
	await ports.writer.writeSpecFile(cwd, hit.entry.path, newLines.join("\n"));

	return {
		ok: true,
		action: "set",
		id,
		file: hit.entry.path,
		startLine: hit.startLine,
		endLine: hit.startLine + bodyLines.length,
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
	return { ok: false, exitCode: 1, reason: "record-not-found", message };
}
function ambiguous(message: string): RecordWriteResult {
	return { ok: false, exitCode: 1, reason: "record-ambiguous", message };
}
function governed(message: string): RecordWriteResult {
	return { ok: false, exitCode: 1, reason: "record-protected", message };
}
