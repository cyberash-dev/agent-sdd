import type { SddConfig } from "../../../../shared/domain/Config.js";
import type { SpecBlock } from "../../../../shared/domain/SpecBlocks.js";

export interface CheckSpec {
  path: string;
  blocks: SpecBlock[];
}

export interface CheckSpecPort {
  spec(repoRoot: string, config: SddConfig): Promise<CheckSpec>;
}
