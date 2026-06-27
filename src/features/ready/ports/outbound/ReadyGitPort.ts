/*
 * Optional git port for the aggregated_check leg. When git is unavailable or
 * the cwd is not a git repo, the caller may skip baseline checking.
 */
import type { Vcs } from "../../../../shared/domain/Vcs.js";

export type ReadyGitPort = Pick<
	Vcs,
	| "isGitRepo"
	| "repoRoot"
	| "treeBytes"
	| "treePaths"
	| "dirtyPaths"
	| "readAtRef"
>;
