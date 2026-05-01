import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface FinalizeConfigPort {
  config(repoRoot: string): Promise<SddConfig>;
}
