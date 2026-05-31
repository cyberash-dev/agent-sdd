import {
	ok,
	type CommandResult,
	type OutputFormat,
} from "../../../../shared/domain/CliOutput.js";
import { addRecord } from "../../application/AddRecord.js";
import { getRecord, type RecordSlice } from "../../application/GetRecord.js";
import {
	listRecords,
	type RecordSummary,
} from "../../application/ListRecords.js";
import {
	setRecord,
	type RecordWritePorts,
	type RecordWriteResult,
} from "../../application/SetRecord.js";
import type {
	RecordAction,
	RecordCommand,
} from "../../ports/inbound/RecordCommand.js";

type Format = Exclude<OutputFormat, "yaml">;

export class CliRecordHandler implements RecordCommand {
	constructor(private readonly ports: RecordWritePorts) {}

	async execute(
		cwd: string,
		action: RecordAction,
		format: Format,
	): Promise<CommandResult> {
		if (action.kind === "list") {
			const records = await listRecords(cwd, this.ports, action.partition);
			return format === "json" ? listJson(records) : listHuman(records);
		}
		if (action.kind === "get") {
			const matches = await getRecord(cwd, action.id, this.ports);
			return format === "json"
				? getJson(action.id, matches)
				: getHuman(action.id, matches);
		}
		const result =
			action.kind === "set"
				? await setRecord(cwd, action.id, action.body, this.ports)
				: await addRecord(cwd, action.afterId, action.body, this.ports);
		return writeResult(result, format);
	}
}

function listJson(records: readonly RecordSummary[]): CommandResult {
	return ok(
		JSON.stringify({
			format_version: 1,
			count: records.length,
			records: records.map((r) => ({
				id: r.id,
				type: r.type,
				status: r.status,
				title: r.title,
				file: r.file,
				line: r.line,
			})),
		}),
	);
}

function listHuman(records: readonly RecordSummary[]): CommandResult {
	if (records.length === 0) {
		return ok("");
	}
	const idW = Math.max(...records.map((r) => r.id.length));
	const typeW = Math.max(...records.map((r) => (r.type ?? "—").length));
	const statusW = Math.max(...records.map((r) => (r.status ?? "—").length));
	const lines = records.map((r) => {
		const id = r.id.padEnd(idW);
		const type = (r.type ?? "—").padEnd(typeW);
		const status = (r.status ?? "—").padEnd(statusW);
		return `${id}  ${type}  ${status}  ${r.title ?? ""}`.trimEnd();
	});
	return ok(lines.join("\n"));
}

function getJson(id: string, matches: readonly RecordSlice[]): CommandResult {
	const found = matches[0];
	if (found === undefined) {
		return {
			exitCode: 1,
			stdout: `${JSON.stringify({ format_version: 1, found: false, id })}\n`,
			stderr: "",
		};
	}
	return ok(
		JSON.stringify({
			format_version: 1,
			found: true,
			id: found.id,
			file: found.file,
			start_line: found.startLine,
			end_line: found.endLine,
			raw: found.raw,
		}),
	);
}

function getHuman(id: string, matches: readonly RecordSlice[]): CommandResult {
	if (matches.length === 0) {
		return { exitCode: 1, stdout: "", stderr: `record not found: ${id}\n` };
	}
	return ok(matches.map((m) => m.raw).join("\n---\n"));
}

function writeResult(result: RecordWriteResult, format: Format): CommandResult {
	if (!result.ok) {
		if (format === "json") {
			const body = JSON.stringify({
				format_version: 1,
				ok: false,
				reason: result.reason,
				detail: result.message,
			});
			return { exitCode: result.exitCode, stdout: `${body}\n`, stderr: "" };
		}
		return {
			exitCode: result.exitCode,
			stdout: "",
			stderr: `${result.reason}: ${result.message}\n`,
		};
	}
	if (format === "json") {
		return ok(
			JSON.stringify({
				format_version: 1,
				ok: true,
				action: result.action,
				id: result.id,
				file: result.file,
				start_line: result.startLine,
				end_line: result.endLine,
			}),
		);
	}
	return ok(
		`record ${result.action}: ${result.id} (${result.file}:${result.startLine}-${result.endLine})`,
	);
}
