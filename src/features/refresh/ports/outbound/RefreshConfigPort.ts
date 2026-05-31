import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface RefreshConfigPort {
	config(repoRoot: string): Promise<SddConfig>;
}
