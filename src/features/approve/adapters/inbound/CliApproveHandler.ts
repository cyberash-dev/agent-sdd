import {
	failed,
	ok,
	type CommandResult,
	type OutputFormat,
} from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import {
	applyApproval,
	type ApplyApprovalPorts,
	type ApproveRefusal,
} from "../../application/ApplyApproval.js";
import {
	writeAttestation,
	type WriteAttestationPorts,
} from "../../application/WriteAttestation.js";
import type {
	ApproveCommand,
	ApproveRequest,
} from "../../ports/inbound/ApproveCommand.js";

export interface ApproveCliPorts
	extends ApplyApprovalPorts, WriteAttestationPorts {}

export interface ApproveExecutionMode {
	inline: boolean;
	planId?: string;
}

export class CliApproveHandler implements ApproveCommand {
	constructor(private readonly ports: ApproveCliPorts) {}

	async execute(
		cwd: string,
		req: ApproveRequest,
		format: Exclude<OutputFormat, "yaml">,
		mode?: ApproveExecutionMode,
	): Promise<CommandResult> {
		const isInline = mode?.inline === true;
		try {
			if (isInline) {
				return await this.executeInline(cwd, req, format);
			}
			return await this.executePlan(cwd, req, mode?.planId, format);
		} catch (error) {
			if (error instanceof CliFailure) {
				return failed(error, format);
			}
			throw error;
		}
	}

	private async executeInline(
		cwd: string,
		req: ApproveRequest,
		format: Exclude<OutputFormat, "yaml">,
	): Promise<CommandResult> {
		const outcome = await applyApproval(cwd, req, this.ports);
		if (outcome.kind === "refused") {
			return refusalResult(outcome.refusal, format);
		}
		const stderr = `DEPRECATED: --inline will be removed in v1.1.0; use \`sdd approve\` + \`sdd finalize\` instead.\n`;
		if (format === "json") {
			return {
				exitCode: 0,
				stdout: `${JSON.stringify({
					format_version: 1,
					ok: true,
					mode: "inline",
					matched_ids: outcome.matchedIds,
					files_changed: outcome.filesChanged,
				})}\n`,
				stderr,
			};
		}
		const lines: string[] = [];
		for (const id of outcome.matchedIds) {
			lines.push(
				`approve: ${id} → ${req.targetStatus} (approver=${req.approver})`,
			);
		}
		lines.push("");
		lines.push(
			`approve --inline: rewrote ${outcome.matchedIds.length} record(s) in ${outcome.filesChanged.length} file(s).`,
		);
		lines.push(`approve: re-run \`sdd lint\` to verify spec-valid.`);
		return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr };
	}

	private async executePlan(
		cwd: string,
		req: ApproveRequest,
		planId: string | undefined,
		format: Exclude<OutputFormat, "yaml">,
	): Promise<CommandResult> {
		const outcome = await writeAttestation(cwd, req, planId, this.ports);
		if (outcome.kind === "refused") {
			return refusalResult(outcome.refusal, format);
		}
		if (format === "json") {
			return ok(
				JSON.stringify({
					format_version: 1,
					ok: true,
					mode: "plan",
					plan_id: outcome.result.planId,
					plan_path: outcome.result.planPath,
					is_new_plan: outcome.result.isNewPlan,
					attestation: {
						id: outcome.attestation.id,
						owner_role: outcome.attestation.ownerRole,
						approver_identity: outcome.attestation.approverIdentity,
						timestamp: outcome.attestation.timestamp,
						target_status: outcome.attestation.targetStatus,
					},
				}),
			);
		}
		const lines: string[] = [];
		lines.push(
			`approve: ${req.id} → ${req.targetStatus} (approver=${req.approver})`,
		);
		lines.push("");
		lines.push(`approve: queued attestation in ${outcome.result.planPath}`);
		lines.push(
			`         plan_id=${outcome.result.planId} (${outcome.result.isNewPlan ? "new plan" : "existing plan"})`,
		);
		lines.push(
			`approve: run \`sdd plan show\` to review, \`sdd finalize\` to apply.`,
		);
		return ok(lines.join("\n"));
	}
}

function refusalResult(
	refusal: ApproveRefusal,
	format: Exclude<OutputFormat, "yaml">,
): CommandResult {
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
