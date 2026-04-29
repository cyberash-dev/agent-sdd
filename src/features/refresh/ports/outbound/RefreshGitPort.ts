export interface RefreshGitPort {
  repoRoot(cwd: string): Promise<string>;
  headSha(repoRoot: string): Promise<string>;
  treePaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
  dirtyPaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
  changedPaths(repoRoot: string, baselineCommitSha: string, scope: readonly string[]): Promise<string[]>;
}
