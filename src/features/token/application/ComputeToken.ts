import { configFailure } from "../../../shared/domain/Errors.js";
import { TOKEN_MECHANISM, token } from "../../../shared/domain/Token.js";
import type { TokenConfigPort } from "../ports/outbound/TokenConfigPort.js";
import type { TokenGitPort } from "../ports/outbound/TokenGitPort.js";

export type TokenOutcome =
  | {
      kind: "success";
      token: string;
      commitSha: string;
      mechanism: typeof TOKEN_MECHANISM;
      scope: string[];
    }
  | {
      kind: "dirty";
      dirtyPaths: string[];
    };

export interface ComputeTokenPorts {
  config: TokenConfigPort;
  git: TokenGitPort;
}

export async function computeToken(cwd: string, ports: ComputeTokenPorts): Promise<TokenOutcome> {
  const repoRoot = await ports.git.repoRoot(cwd);
  const commitSha = await ports.git.headSha(repoRoot);
  const config = await ports.config.config(repoRoot);
  await assertGlobMatches(ports.git, repoRoot, config.discoveryScope);

  const dirtyPaths = await ports.git.dirtyPaths(repoRoot, config.discoveryScope);
  if (dirtyPaths.length > 0) {
    return { kind: "dirty", dirtyPaths };
  }

  return {
    kind: "success",
    token: token(await ports.git.treeBytes(repoRoot, config.discoveryScope)),
    commitSha,
    mechanism: TOKEN_MECHANISM,
    scope: config.discoveryScope,
  };
}

async function assertGlobMatches(git: TokenGitPort, repoRoot: string, scope: readonly string[]): Promise<void> {
  for (const entry of scope.filter((value) => /[*?\[]/.test(value))) {
    const paths = await git.treePaths(repoRoot, [entry]);
    if (paths.length === 0) {
      throw configFailure("config-invalid", `discovery_scope glob matched zero files: ${entry}`);
    }
  }
}
