import type { SddConfig } from "../../../../shared/domain/Config.js";
import type { SpecBlock } from "../../../../shared/domain/SpecBlocks.js";

export interface RefreshSpec {
  path: string;
  blocks: SpecBlock[];
}

export interface RefreshSpecPort {
  spec(repoRoot: string, config: SddConfig): Promise<RefreshSpec>;
}
