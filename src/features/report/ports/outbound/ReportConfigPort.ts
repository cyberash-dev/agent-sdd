import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface ReportConfigPort {
	config(repoRoot: string): Promise<SddConfig>;
}
