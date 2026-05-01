import type { PlanFileShape } from "../../../../shared/domain/PlanFile.js";

export type PlanLookup =
  | { kind: "found"; planId: string; plan: PlanFileShape; sourcePath: string }
  | { kind: "no-active-plan" }
  | { kind: "invalid-plan-file"; planId: string; sourcePath: string; reason: string };

export interface PlanReader {
  /** Reads and parses the requested plan, or the active plan if `planId` is
   *  undefined. Returns a discriminated outcome — never throws. */
  read(repoRoot: string, plansDir: string, planId: string | undefined): Promise<PlanLookup>;
}
