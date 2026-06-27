import type { Vcs } from "../../../../shared/domain/Vcs.js";

export type RefreshGitPort = Pick<
	Vcs,
	"repoRoot" | "headSha" | "treePaths" | "dirtyPaths" | "changedPaths"
>;
