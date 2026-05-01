import { configFailure } from "../../../shared/domain/Errors.js";
import { stringValue, typedBlock, type SpecBlock } from "../../../shared/domain/SpecBlocks.js";
import { TOKEN_MECHANISM, token } from "../../../shared/domain/Token.js";
import { baselineComparison } from "../domain/BaselineComparison.js";
import type { CheckConfigPort } from "../ports/outbound/CheckConfigPort.js";
import type { CheckGitPort } from "../ports/outbound/CheckGitPort.js";
import type { CheckSpecPort } from "../ports/outbound/CheckSpecPort.js";

export type CheckOutcome =
  | {
      kind: "match";
      recordedToken: string;
      recomputedToken: string;
      baselineCommitSha: string;
      currentCommitSha: string;
      mechanism: typeof TOKEN_MECHANISM;
    }
  | {
      kind: "dirty";
      currentCommitSha: string;
      dirtyPaths: string[];
    }
  | {
      kind: "stale";
      recordedToken: string;
      recomputedToken: string;
      baselineCommitSha: string;
      currentCommitSha: string;
    };

export interface CheckBaselinePorts {
  config: CheckConfigPort;
  git: CheckGitPort;
  spec: CheckSpecPort;
}

export async function checkBaseline(cwd: string, ports: CheckBaselinePorts): Promise<CheckOutcome> {
  const repoRoot = await ports.git.repoRoot(cwd);
  const currentCommitSha = await ports.git.headSha(repoRoot);
  const config = await ports.config.config(repoRoot);
  await assertGlobMatches(ports.git, repoRoot, config.discoveryScope);

  const dirtyPaths = await ports.git.dirtyPaths(repoRoot, config.discoveryScope);
  if (dirtyPaths.length > 0) {
    return {
      kind: "dirty",
      currentCommitSha,
      dirtyPaths,
    };
  }

  const loadedSpec = await ports.spec.spec(repoRoot, config);
  const recorded = baseline(loadedSpec.path, loadedSpec.blocks, config.baselineId);

  const recomputedToken = token(await ports.git.treeBytes(repoRoot, config.discoveryScope));
  const comparison = baselineComparison(recorded.freshnessToken, recomputedToken);
  if (comparison.kind === "stale") {
    return {
      kind: "stale",
      recordedToken: comparison.recordedToken,
      recomputedToken: comparison.recomputedToken,
      baselineCommitSha: recorded.baselineCommitSha,
      currentCommitSha,
    };
  }
  return {
    kind: "match",
    recordedToken: comparison.recordedToken,
    recomputedToken: comparison.recomputedToken,
    baselineCommitSha: recorded.baselineCommitSha,
    currentCommitSha,
    mechanism: TOKEN_MECHANISM,
  };
}

function baseline(specPath: string, blocks: readonly SpecBlock[], baselineId: string): { freshnessToken: string; baselineCommitSha: string } {
  const block = typedBlock(blocks, baselineId, "BrownfieldBaseline", specPath);
  return {
    freshnessToken: stringValue(block, "freshness_token", specPath),
    baselineCommitSha: stringValue(block, "baseline_commit_sha", specPath),
  };
}

async function assertGlobMatches(git: CheckGitPort, repoRoot: string, scope: readonly string[]): Promise<void> {
  for (const entry of scope.filter((value) => /[*?\[]/.test(value))) {
    const paths = await git.treePaths(repoRoot, [entry]);
    if (paths.length === 0) {
      throw configFailure("config-invalid", `discovery_scope glob matched zero files: ${entry}`);
    }
  }
}
