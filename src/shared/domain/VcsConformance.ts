/*
 * Runtime conformance check for a loaded VCS adapter. TypeScript types are
 * erased, and an external adapter is provider-owned code, so the loader
 * validates the object's shape at the boundary before any feature uses it.
 * Shape only — semantic correctness is the adapter package's own obligation.
 */
import type { Vcs } from "./Vcs.js";

export const MECHANISM_ID_RE = /^[a-z][a-z0-9_]*$/;

const REQUIRED_METHODS = [
	"isGitRepo",
	"repoRoot",
	"headSha",
	"treeBytes",
	"treePaths",
	"dirtyPaths",
	"changedPaths",
	"readAtRef",
] as const;

export type VcsConformance =
	| { ok: true; vcs: Vcs }
	| { ok: false; problems: string[] };

export function conformsToVcs(candidate: unknown): VcsConformance {
	const problems = vcsShapeProblems(candidate);
	if (problems.length === 0 && isVcsShaped(candidate)) {
		return { ok: true, vcs: candidate };
	}
	return { ok: false, problems };
}

function vcsShapeProblems(candidate: unknown): string[] {
	if (!isObject(candidate)) {
		return ["adapter is not an object"];
	}
	const problems: string[] = [];

	const mechanism = candidate.mechanism;
	if (typeof mechanism !== "string") {
		problems.push("mechanism is not a string");
	} else if (!MECHANISM_ID_RE.test(mechanism)) {
		problems.push(
			`mechanism "${mechanism}" does not match ${MECHANISM_ID_RE.source}`,
		);
	}

	for (const name of REQUIRED_METHODS) {
		if (typeof candidate[name] !== "function") {
			problems.push(`missing method: ${name}`);
		}
	}
	return problems;
}

function isVcsShaped(candidate: unknown): candidate is Vcs {
	return vcsShapeProblems(candidate).length === 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
