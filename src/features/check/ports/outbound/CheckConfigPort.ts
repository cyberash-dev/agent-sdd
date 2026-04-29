import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface CheckConfigPort {
  config(repoRoot: string): Promise<SddConfig>;
}
