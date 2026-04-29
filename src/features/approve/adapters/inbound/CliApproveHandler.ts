import { failed, ok, type CommandResult, type OutputFormat } from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import { applyApproval, type ApplyApprovalPorts, type ApproveRefusal } from "../../application/ApplyApproval.js";
import type { ApproveCommand, ApproveRequest } from "../../ports/inbound/ApproveCommand.js";

export class CliApproveHandler implements ApproveCommand {
  constructor(private readonly ports: ApplyApprovalPorts) {}

  async execute(cwd: string, req: ApproveRequest, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult> {
    try {
      const outcome = await applyApproval(cwd, req, this.ports);
      if (outcome.kind === "refused") {
        return refusalResult(outcome.refusal, format);
      }
      if (format === "json") {
        return ok(JSON.stringify({
          format_version: 1,
          ok: true,
          matched_ids: outcome.matchedIds,
          files_changed: outcome.filesChanged,
        }));
      }
      const lines: string[] = [];
      for (const id of outcome.matchedIds) {
        lines.push(`approve: ${id} → ${req.targetStatus} (approver=${req.approver})`);
      }
      lines.push("");
      lines.push(`approve: rewrote ${outcome.matchedIds.length} record(s) in ${outcome.filesChanged.length} file(s).`);
      lines.push(`approve: re-run \`sdd lint\` to verify spec-valid.`);
      return ok(lines.join("\n"));
    } catch (error) {
      if (error instanceof CliFailure) {
        return failed(error, format);
      }
      throw error;
    }
  }
}

function refusalResult(refusal: ApproveRefusal, format: Exclude<OutputFormat, "yaml">): CommandResult {
  const message = refusalMessage(refusal);
  if (format === "json") {
    return {
      exitCode: 1,
      stdout: `${JSON.stringify({
        format_version: 1,
        ok: false,
        reason: refusal.kind,
        detail: message,
      })}\n`,
      stderr: "",
    };
  }
  return { exitCode: 1, stdout: "", stderr: `approve: REFUSED — ${message}\n` };
}

function refusalMessage(refusal: ApproveRefusal): string {
  if (refusal.kind === "agent-approver") {
    return `approver "${refusal.approver}" is in the agent blocklist (SDD §7.5: self-approval forbidden). See spec/APPROVAL.md for the human-owned workflow.`;
  }
  if (refusal.kind === "invalid-owner-role") {
    return `owner-role "${refusal.ownerRole}" not in valid set: tech-lead, architect, security-owner, platform-runtime-lead, product-owner, compliance.`;
  }
  return `no normative ID records matched "${refusal.id}".`;
}
