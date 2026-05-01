import type { PendingAttestation, PlanFileShape } from "../../../../shared/domain/PlanFile.js";

export interface AppendAttestationResult {
  planId: string;
  planPath: string;             // relative to repoRoot
  isNewPlan: boolean;           // true if the plan file was created by this call
  pendingAfter: number;         // attestation count after the append
}

export interface PlanFileWriter {
  /** Append `attestation` to the plan identified by `planId`, or to the
   *  active plan if `planId` is undefined. If no active plan exists, mints
   *  a new plan_id (timestamp + 5-char base32 random) and writes a fresh
   *  plan file plus updates the .active marker.
   *
   *  Implementations are responsible for the plan_id grammar (CTR-019) and
   *  for keeping `<plansDir>/.active` in sync. */
  appendAttestation(
    repoRoot: string,
    plansDir: string,
    planId: string | undefined,
    attestation: PendingAttestation,
  ): Promise<AppendAttestationResult>;

  /** Read-only helper used by `sdd plan show`-style consumers and by tests.
   *  Returns null when the plan does not exist. */
  readPlan(repoRoot: string, plansDir: string, planId: string): Promise<PlanFileShape | null>;
}
