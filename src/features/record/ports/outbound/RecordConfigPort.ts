import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface RecordConfigPort {
	config(repoRoot: string): Promise<SddConfig>;
}
