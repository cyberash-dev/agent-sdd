import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface PlanConfigPort {
	config(repoRoot: string): Promise<SddConfig>;
}
