import type { SddConfig } from "../../../../shared/domain/Config.js";

export interface TokenConfigPort {
  config(repoRoot: string): Promise<SddConfig>;
}
