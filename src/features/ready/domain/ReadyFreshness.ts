import type { SddConfig } from "../../../shared/domain/Config.js";
import type { LintRecord } from "../../../shared/domain/SpecRecord.js";
import { token as computeToken } from "../../../shared/domain/Token.js";
import type { AggregatedCheckOutcome } from "./AggregatedRules.js";
import { findBaseline } from "./ReadyBaseline.js";
import type { ReadyError } from "./ReadyViolation.js";

/* Minimal git surface this freshness check needs; the application injects the
 * ReadyGitPort adapter, which is structurally compatible. */
interface GitProbe {
	isGitRepo(cwd: string): Promise<boolean>;
	repoRoot(cwd: string): Promise<string>;
	dirtyPaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
	treeBytes(repoRoot: string, scope: readonly string[]): Promise<Uint8Array>;
}

export type CheckResult =
	| { kind: "outcome"; outcome: AggregatedCheckOutcome }
	| { kind: "error"; error: ReadyError };

export async function aggregatedCheckOutcome(
	cwd: string,
	config: SddConfig,
	recordsByPartition: ReadonlyMap<string, readonly LintRecord[]>,
	git: GitProbe,
): Promise<CheckResult> {
	const isInRepo = await git.isGitRepo(cwd).catch(() => false);
	if (!isInRepo) {
		return { kind: "outcome", outcome: { kind: "skipped" } };
	}

	const baseline = findBaseline(config.baselineId, recordsByPartition);
	if (
		baseline === null ||
		baseline.freshnessToken === "TODO" ||
		baseline.freshnessToken.length === 0
	) {
		return { kind: "outcome", outcome: { kind: "skipped" } };
	}

	let repoRoot: string;
	try {
		repoRoot = await git.repoRoot(cwd);
	} catch {
		return { kind: "outcome", outcome: { kind: "skipped" } };
	}

	let dirty: string[];
	try {
		dirty = await git.dirtyPaths(repoRoot, config.discoveryScope);
	} catch (error) {
		return { kind: "error", error: internalError(error) };
	}
	if (dirty.length > 0) {
		return { kind: "outcome", outcome: { kind: "dirty", dirtyPaths: dirty } };
	}

	let bytes: Uint8Array;
	try {
		bytes = await git.treeBytes(repoRoot, config.discoveryScope);
	} catch (error) {
		return { kind: "error", error: internalError(error) };
	}
	const recomputed = computeToken(bytes);
	if (recomputed === baseline.freshnessToken) {
		return { kind: "outcome", outcome: { kind: "match" } };
	}
	return {
		kind: "outcome",
		outcome: {
			kind: "stale",
			recordedToken: baseline.freshnessToken,
			recomputedToken: recomputed,
		},
	};
}

function internalError(error: unknown): ReadyError {
	return {
		kind: "internal",
		message: error instanceof Error ? error.message : String(error),
	};
}
