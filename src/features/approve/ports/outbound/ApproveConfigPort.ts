import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface ApproveConfigPort {
	config(repoRoot: string): Promise<SddConfig>;
}
