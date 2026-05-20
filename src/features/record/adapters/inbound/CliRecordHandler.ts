import { failed, ok, type CommandResult, type OutputFormat } from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import { getRecord, type RecordSlice } from "../../application/GetRecord.js";
import { listRecords, type RecordPorts, type RecordSummary } from "../../application/ListRecords.js";
import type { RecordAction, RecordCommand } from "../../ports/inbound/RecordCommand.js";

type Format = Exclude<OutputFormat, "yaml">;

export class CliRecordHandler implements RecordCommand {
  constructor(private readonly ports: RecordPorts) {}

  async execute(cwd: string, action: RecordAction, format: Format): Promise<CommandResult> {
    try {
      if (action.kind === "list") {
        const records = await listRecords(cwd, this.ports, action.partition);
        return format === "json" ? listJson(records) : listHuman(records);
      }
      const matches = await getRecord(cwd, action.id, this.ports);
      return format === "json" ? getJson(action.id, matches) : getHuman(action.id, matches);
    } catch (error) {
      if (error instanceof CliFailure) {
        return failed(error, format);
      }
      throw error;
    }
  }
}

function listJson(records: readonly RecordSummary[]): CommandResult {
  return ok(JSON.stringify({
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
  }));
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
    return { exitCode: 1, stdout: `${JSON.stringify({ format_version: 1, found: false, id })}\n`, stderr: "" };
  }
  return ok(JSON.stringify({
    format_version: 1,
    found: true,
    id: found.id,
    file: found.file,
    start_line: found.startLine,
    end_line: found.endLine,
    raw: found.raw,
  }));
}

function getHuman(id: string, matches: readonly RecordSlice[]): CommandResult {
  if (matches.length === 0) {
    return { exitCode: 1, stdout: "", stderr: `record not found: ${id}\n` };
  }
  return ok(matches.map((m) => m.raw).join("\n---\n"));
}
