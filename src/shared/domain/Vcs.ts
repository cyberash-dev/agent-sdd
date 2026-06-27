/*
 * The single outbound VCS port every feature uses. The built-in adapter shells
 * to git; external adapters ship as separate packages, loaded by config.
 * `mechanism` is the fingerprint algorithm id echoed in token/check output.
 */
export interface Vcs {
	readonly mechanism: string;
	isGitRepo(cwd: string): Promise<boolean>;
	repoRoot(cwd: string): Promise<string>;
	headSha(repoRoot: string): Promise<string>;
	treeBytes(repoRoot: string, scope: readonly string[]): Promise<Uint8Array>;
	treePaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
	dirtyPaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
	changedPaths(
		repoRoot: string,
		baselineCommitSha: string,
		scope: readonly string[],
	): Promise<string[]>;
	readAtRef(
		repoRoot: string,
		ref: string,
		relativePath: string,
	): Promise<string | null>;
}

export interface VcsAdapterOptions {
	repoRoot: string;
}

/*
 * Shape an external adapter package exposes. The loader accepts a named
 * `createVcs` export or a default factory; both are validated at runtime by
 * VcsConformance before the returned object is trusted.
 */
export interface VcsAdapterModule {
	createVcs(options: VcsAdapterOptions): Vcs | Promise<Vcs>;
}
