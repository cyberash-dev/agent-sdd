import type { PendingAttestation } from "../../../shared/domain/PlanFile.js";
import {
	classifyRefusal,
	type ApproveRefusal,
	type ApproveRequest,
} from "../domain/ApproveRequest.js";
import type { ApproveClock } from "../ports/outbound/ApproveClock.js";
import type { ApproveConfigPort } from "../ports/outbound/ApproveConfigPort.js";
import type {
	AppendAttestationResult,
	PlanFileWriter,
} from "../ports/outbound/PlanFileWriter.js";

export interface WriteAttestationPorts {
	clock: ApproveClock;
	config: ApproveConfigPort;
	plans: PlanFileWriter;
}

export type WriteAttestationOutcome =
	| { kind: "refused"; refusal: ApproveRefusal }
	| {
			kind: "appended";
			result: AppendAttestationResult;
			attestation: PendingAttestation;
	  };

export async function writeAttestation(
	cwd: string,
	req: ApproveRequest,
	planId: string | undefined,
	ports: WriteAttestationPorts,
): Promise<WriteAttestationOutcome> {
	const config = await ports.config.config(cwd);
	const refusal = classifyRefusal(req, config.lint.approverBlocklist);
	if (refusal !== null) {
		return { kind: "refused", refusal };
	}

	const when = ports.clock.now();
	const attestation: PendingAttestation = {
		id: req.id,
		ownerRole: req.ownerRole,
		approverIdentity: req.approver,
		timestamp: when.toISOString(),
		changeRequest: req.changeRequest,
		scope: req.scope,
		targetStatus: req.targetStatus,
		...(req.reviewedTestOracle !== null
			? { reviewedTestOracle: req.reviewedTestOracle }
			: {}),
	};
	const result = await ports.plans.appendAttestation(
		cwd,
		config.plansDir,
		planId,
		attestation,
	);
	return { kind: "appended", result, attestation };
}
