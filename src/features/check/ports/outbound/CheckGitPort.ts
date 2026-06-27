import type { Vcs } from "../../../../shared/domain/Vcs.js";

export type CheckGitPort = Pick<
	Vcs,
	| "mechanism"
	| "repoRoot"
	| "headSha"
	| "treeBytes"
	| "treePaths"
	| "dirtyPaths"
>;
