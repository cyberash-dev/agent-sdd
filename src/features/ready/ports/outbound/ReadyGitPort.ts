/*
 * Optional git port for the aggregated_check leg. When git is unavailable or
 * the cwd is not a git repo, the caller may skip baseline checking.
 */

export interface ReadyGitPort {
	isGitRepo(cwd: string): Promise<boolean>;
	repoRoot(cwd: string): Promise<string>;
	treeBytes(repoRoot: string, scope: readonly string[]): Promise<Uint8Array>;
	treePaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
	dirtyPaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
	/** Read a single file at a given ref (e.g. HEAD~5). Returns null if the
	 *  ref or file is missing. Used by P2.3 semver-cascade diff. */
	readAtRef(
		repoRoot: string,
		ref: string,
		relativePath: string,
	): Promise<string | null>;
}
