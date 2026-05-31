import type { PlanFileShape } from "../../../../shared/domain/PlanFile.js";

export type PlanLoad =
	| { kind: "found"; plan: PlanFileShape; sourcePath: string }
	| { kind: "no-active-plan" }
	| {
			kind: "invalid-plan-file";
			planId: string;
			sourcePath: string;
			reason: string;
	  };

export interface PlanRepo {
	load(
		repoRoot: string,
		plansDir: string,
		planId: string | undefined,
	): Promise<PlanLoad>;
	/** Atomically move the plan file to <plansDir>/finalized/<plan_id>.yaml.
	 *  Also clears <plansDir>/.active if it pointed at this plan_id. */
	archive(
		repoRoot: string,
		plansDir: string,
		planId: string,
	): Promise<{ archivedPath: string }>;
}
