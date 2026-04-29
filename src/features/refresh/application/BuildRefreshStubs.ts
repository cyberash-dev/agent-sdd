import { configFailure } from "../../../shared/domain/Errors.js";
import { stringValue, typedBlock, type SpecBlock } from "../../../shared/domain/SpecBlocks.js";
import { humanStubText, stubs, yamlStubStream, type Stub } from "../domain/DiffStubs.js";
import { footprint } from "../domain/Footprint.js";
import type { RefreshClockPort } from "../ports/outbound/RefreshClockPort.js";
import type { RefreshConfigPort } from "../ports/outbound/RefreshConfigPort.js";
import type { RefreshGitPort } from "../ports/outbound/RefreshGitPort.js";
import type { RefreshSpecPort } from "../ports/outbound/RefreshSpecPort.js";

export type RefreshOutcome =
  | { kind: "json"; body: { format_version: 1; stubs: Stub[] } }
  | { kind: "human"; text: string }
  | { kind: "yaml"; text: string };

export interface BuildRefreshStubsPorts {
  clock: RefreshClockPort;
  config: RefreshConfigPort;
  git: RefreshGitPort;
  spec: RefreshSpecPort;
}

export async function buildRefreshStubs(
  cwd: string,
  format: "human" | "json" | "yaml",
  ports: BuildRefreshStubsPorts,
): Promise<RefreshOutcome> {
  const repoRoot = await ports.git.repoRoot(cwd);
  await ports.git.headSha(repoRoot);
  const config = await ports.config.config(repoRoot);
  await assertGlobMatches(ports.git, repoRoot, config.discoveryScope);
  const loadedSpec = await ports.spec.spec(repoRoot, config);
  const recorded = baseline(loadedSpec.path, loadedSpec.blocks, config.baselineId);

  const committedPaths = await ports.git.changedPaths(repoRoot, recorded.baselineCommitSha, config.discoveryScope);
  const dirtyPaths = await ports.git.dirtyPaths(repoRoot, config.discoveryScope);
  const changedPaths = [...new Set([...committedPaths, ...dirtyPaths])].sort();
  const pathFootprint = footprint(loadedSpec.blocks, config.footprint.bindingIdPrefix, config.footprint.bindingField);
  const emittedStubs = stubs(changedPaths, pathFootprint, ports.clock.iso());

  if (format === "json") {
    return { kind: "json", body: { format_version: 1, stubs: emittedStubs } };
  }
  if (format === "human") {
    return { kind: "human", text: humanStubText(emittedStubs) };
  }
  return { kind: "yaml", text: yamlStubStream(emittedStubs) };
}

function baseline(specPath: string, blocks: readonly SpecBlock[], baselineId: string): { freshnessToken: string; baselineCommitSha: string } {
  const block = typedBlock(blocks, baselineId, "BrownfieldBaseline", specPath);
  return {
    freshnessToken: stringValue(block, "freshness_token", specPath),
    baselineCommitSha: stringValue(block, "baseline_commit_sha", specPath),
  };
}

async function assertGlobMatches(git: RefreshGitPort, repoRoot: string, scope: readonly string[]): Promise<void> {
  for (const entry of scope.filter((value) => /[*?\[]/.test(value))) {
    const paths = await git.treePaths(repoRoot, [entry]);
    if (paths.length === 0) {
      throw configFailure("config-invalid", `discovery_scope glob matched zero files: ${entry}`);
    }
  }
}
