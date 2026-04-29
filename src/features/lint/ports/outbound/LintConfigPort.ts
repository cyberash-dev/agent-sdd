import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface LintConfigPort {
  config(repoRoot: string): Promise<SddConfig>;
}
