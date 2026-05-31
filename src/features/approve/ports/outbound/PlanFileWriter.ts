import type {
	PendingAttestation,
	PlanFileShape,
} from "../../../../shared/domain/PlanFile.js";

export interface AppendAttestationResult {
	planId: string;
	planPath: string; /* relative to repoRoot */
	isNewPlan: boolean; /* true if the plan file was created by this call */
	pendingAfter: number; /* attestation count after the append */
}

export interface PlanFileWriter {
	/* CTR-019: append `attestation` to `planId` (or the active plan; mints a
	 * new plan_id + .active marker when none exists). See spec record. */
	appendAttestation(
		repoRoot: string,
		plansDir: string,
		planId: string | undefined,
		attestation: PendingAttestation,
	): Promise<AppendAttestationResult>;

	/** Read-only helper used by `sdd plan show`-style consumers and by tests.
	 *  Returns null when the plan does not exist. */
	readPlan(
		repoRoot: string,
		plansDir: string,
		planId: string,
	): Promise<PlanFileShape | null>;
}
