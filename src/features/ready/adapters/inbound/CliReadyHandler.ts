import type { CommandResult, OutputFormat } from "../../../../shared/domain/CliOutput.js";
import { runReady, type ReadyEnvelope, type ReadyViolation, type RunReadyPorts } from "../../application/RunReady.js";
import type { ReadyCommand } from "../../ports/inbound/ReadyCommand.js";

export class CliReadyHandler implements ReadyCommand {
  constructor(private readonly ports: RunReadyPorts) {}

  async execute(cwd: string, format: Exclude<OutputFormat, "yaml">, partition?: string, against?: string): Promise<CommandResult> {
    let envelope: ReadyEnvelope;
    try {
      envelope = await runReady(cwd, { partitionFilter: partition, against }, this.ports);
    } catch (error) {
      // Anything not converted into a ReadyError by RunReady itself is an
      // internal evaluate-failure (exit 2).
      const message = error instanceof Error ? error.message : String(error);
      envelope = { ok: false, error: { kind: "internal", message }, violations: [], advisories: [] };
    }
    const exitCode = envelope.error !== null ? 2 : envelope.violations.length > 0 ? 1 : 0;
    if (format === "json") {
      return { exitCode, stdout: `${JSON.stringify(envelope)}\n`, stderr: "" };
    }
    return humanResult(envelope, exitCode);
  }
}

function humanResult(envelope: ReadyEnvelope, exitCode: 0 | 1 | 2): CommandResult {
  if (envelope.error !== null) {
    return {
      exitCode,
      stdout: "",
      stderr: `${envelope.error.kind}: ${envelope.error.message}${envelope.error.file !== undefined ? ` (${envelope.error.file})` : ""}\n`,
    };
  }
  const lines: string[] = [];
  for (const v of envelope.violations) {
    lines.push(formatViolationLine(v));
  }
  for (const a of envelope.advisories) {
    lines.push(`[advisory:${a.kind}] ${a.file}:${a.line}  ${truncate(a.remediation, 200)}`);
  }
  if (envelope.violations.length === 0) {
    lines.push("sdd ready: 0 violation(s).");
    if (envelope.advisories.length > 0) lines.push(`sdd ready: ${envelope.advisories.length} advisory(ies).`);
    return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
  }
  lines.push("");
  lines.push(`sdd ready: ${envelope.violations.length} violation(s).`);
  return { exitCode, stdout: `${lines.join("\n")}\n`, stderr: "" };
}

function formatViolationLine(v: ReadyViolation): string {
  const where = v.file !== undefined ? `${v.file}${v.line !== undefined ? `:${v.line}` : ""}` : "(no-file)";
  const ctx = v.id ?? v.partition ?? "";
  const remediation = truncate(v.remediation ?? defaultRemediation(v), 200);
  return `[${v.kind}] ${where}  ${ctx}: ${remediation}`;
}

function defaultRemediation(v: ReadyViolation): string {
  if (v.kind === "removed_compat_action_mismatch" && v.expected !== undefined && v.actual !== undefined) {
    return `expected compatibility_action=${v.expected}, found ${v.actual}`;
  }
  return "(see CTR-014)";
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
