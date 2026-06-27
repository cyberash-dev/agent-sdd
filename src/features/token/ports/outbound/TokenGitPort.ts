import type { Vcs } from "../../../../shared/domain/Vcs.js";

export type TokenGitPort = Pick<
	Vcs,
	| "mechanism"
	| "repoRoot"
	| "headSha"
	| "treeBytes"
	| "treePaths"
	| "dirtyPaths"
>;
