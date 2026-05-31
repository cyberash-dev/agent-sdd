import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface ReadyConfigPort {
	config(repoRoot: string): Promise<SddConfig>;
}
