export interface CheckGitPort {
	repoRoot(cwd: string): Promise<string>;
	headSha(repoRoot: string): Promise<string>;
	treeBytes(repoRoot: string, scope: readonly string[]): Promise<Uint8Array>;
	treePaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
	dirtyPaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
}
