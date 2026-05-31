import {
	failed,
	ok,
	type CommandResult,
	type OutputFormat,
} from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import { showPlan, type ShowPlanPorts } from "../../application/ShowPlan.js";
import type { PlanLookup } from "../../ports/outbound/PlanReader.js";
import type {
	PlanShowCommand,
	PlanShowRequest,
} from "../../ports/inbound/PlanShowCommand.js";

export class CliPlanShowHandler implements PlanShowCommand {
	constructor(private readonly ports: ShowPlanPorts) {}

	async execute(
		cwd: string,
		req: PlanShowRequest,
		format: Exclude<OutputFormat, "yaml">,
	): Promise<CommandResult> {
		try {
			const lookup = await showPlan(cwd, req.planId, this.ports);
			return renderLookup(lookup, format);
		} catch (error) {
			if (error instanceof CliFailure) {
				return failed(error, format);
			}
			throw error;
		}
	}
}

function renderLookup(
	lookup: PlanLookup,
	format: Exclude<OutputFormat, "yaml">,
): CommandResult {
	if (lookup.kind === "found") {
		if (format === "json") {
			return ok(
				JSON.stringify({
					format_version: 1,
					ok: true,
					plan: {
						plan_id: lookup.plan.planId,
						created_at: lookup.plan.createdAt,
						pending_attestations: lookup.plan.pendingAttestations.map((a) => ({
							id: a.id,
							owner_role: a.ownerRole,
							approver_identity: a.approverIdentity,
							timestamp: a.timestamp,
							change_request: a.changeRequest,
							scope: a.scope,
							target_status: a.targetStatus,
							...(a.reviewedTestOracle !== undefined
								? { reviewed_test_oracle: a.reviewedTestOracle }
								: {}),
						})),
					},
				}),
			);
		}
		const lines: string[] = [];
		lines.push(`plan_id: ${lookup.plan.planId}`);
		lines.push(`created_at: ${lookup.plan.createdAt}`);
		lines.push(`source: ${lookup.sourcePath}`);
		lines.push(
			`pending_attestations: ${lookup.plan.pendingAttestations.length}`,
		);
		for (const a of lookup.plan.pendingAttestations) {
			lines.push(
				`  - ${a.id} → ${a.targetStatus} (approver=${a.approverIdentity}, role=${a.ownerRole})`,
			);
		}
		return ok(lines.join("\n"));
	}
	if (lookup.kind === "no-active-plan") {
		return refusal(
			{ format_version: 1, ok: false, kind: "no-active-plan" },
			"no active plan",
			format,
		);
	}
	return refusal(
		{
			format_version: 1,
			ok: false,
			kind: "invalid-plan-file",
			plan_id: lookup.planId,
			source: lookup.sourcePath,
			reason: lookup.reason,
		},
		`invalid plan file at ${lookup.sourcePath}: ${lookup.reason}`,
		format,
	);
}

function refusal(
	envelope: object,
	human: string,
	format: Exclude<OutputFormat, "yaml">,
): CommandResult {
	if (format === "json") {
		return { exitCode: 2, stdout: `${JSON.stringify(envelope)}\n`, stderr: "" };
	}
	return { exitCode: 2, stdout: "", stderr: `plan show: ${human}\n` };
}
