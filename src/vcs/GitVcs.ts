/*
 * Built-in VCS adapter: the single home for git invocation, replacing the four
 * per-feature ChildProcess*Git adapters. Read-only (POL-002); subcommands are
 * enumerated in EXT-001.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { configFailure, environmentFailure } from "../shared/domain/Errors.js";
import { TOKEN_MECHANISM } from "../shared/domain/Token.js";
import type { Vcs } from "../shared/domain/Vcs.js";

interface GitResult {
	code: number;
	stdout: Buffer;
	stderr: Buffer;
}

export class GitVcs implements Vcs {
	readonly mechanism = TOKEN_MECHANISM;

	async isGitRepo(cwd: string): Promise<boolean> {
		try {
			const result = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
			return (
				result.code === 0 && result.stdout.toString("utf8").trim() === "true"
			);
		} catch {
			return false;
		}
	}

	async repoRoot(cwd: string): Promise<string> {
		const result = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
		if (result.code !== 0 || result.stdout.toString("utf8").trim() !== "true") {
			throw environmentFailure(
				"not-a-git-repo",
				"cwd is not inside a git working tree",
				cwd,
			);
		}
		return findRepoRoot(cwd);
	}

	async headSha(repoRoot: string): Promise<string> {
		const result = await runGit(repoRoot, ["rev-parse", "HEAD"]);
		if (result.code === 0) {
			return result.stdout.toString("utf8").trim();
		}
		throw environmentFailure(
			"head-unborn",
			"HEAD does not resolve to a commit",
			result.stderr.toString("utf8").trim(),
		);
	}

	async treeBytes(
		repoRoot: string,
		scope: readonly string[],
	): Promise<Uint8Array> {
		const result = await runGit(repoRoot, ["ls-tree", "HEAD", "--", ...scope]);
		if (result.code !== 0) {
			throw environmentFailure(
				"head-unborn",
				"git ls-tree failed",
				result.stderr.toString("utf8").trim(),
			);
		}
		return result.stdout;
	}

	async treePaths(
		repoRoot: string,
		scope: readonly string[],
	): Promise<string[]> {
		const result = await runGit(repoRoot, [
			"ls-tree",
			"-r",
			"--name-only",
			"HEAD",
			"--",
			...scope,
		]);
		if (result.code !== 0) {
			throw environmentFailure(
				"head-unborn",
				"git ls-tree failed",
				result.stderr.toString("utf8").trim(),
			);
		}
		return nonEmptyLines(result.stdout.toString("utf8"));
	}

	async dirtyPaths(
		repoRoot: string,
		scope: readonly string[],
	): Promise<string[]> {
		const diffResult = await runGit(repoRoot, [
			"diff",
			"--quiet",
			"HEAD",
			"--",
			...scope,
		]);
		if (diffResult.code !== 0 && diffResult.code !== 1) {
			throw environmentFailure(
				"head-unborn",
				"git diff --quiet failed",
				diffResult.stderr.toString("utf8").trim(),
			);
		}
		const result = await runGit(repoRoot, [
			"status",
			"--porcelain",
			"--",
			...scope,
		]);
		if (result.code !== 0) {
			throw environmentFailure(
				"not-a-git-repo",
				"git status failed",
				result.stderr.toString("utf8").trim(),
			);
		}
		return nonEmptyLines(result.stdout.toString("utf8"))
			.map((line) => porcelainPath(line))
			.sort();
	}

	async changedPaths(
		repoRoot: string,
		baselineCommitSha: string,
		scope: readonly string[],
	): Promise<string[]> {
		const result = await runGit(repoRoot, [
			"diff",
			"--name-only",
			`${baselineCommitSha}..HEAD`,
			"--",
			...scope,
		]);
		if (result.code !== 0) {
			throw configFailure(
				"config-invalid",
				`baseline_commit_sha does not resolve: ${baselineCommitSha}`,
				result.stderr.toString("utf8").trim(),
			);
		}
		return nonEmptyLines(result.stdout.toString("utf8")).sort();
	}

	async readAtRef(
		repoRoot: string,
		ref: string,
		relativePath: string,
	): Promise<string | null> {
		const result = await runGit(repoRoot, ["show", `${ref}:${relativePath}`]);
		if (result.code !== 0) {
			return null;
		}
		return result.stdout.toString("utf8");
	}
}

function runGit(cwd: string, args: readonly string[]): Promise<GitResult> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn("git", [...args], {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
		child.on("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") {
				reject(
					environmentFailure("git-not-on-path", "git binary is not on PATH"),
				);
				return;
			}
			reject(error);
		});
		child.on("close", (code) => {
			resolvePromise({
				code: code ?? 1,
				stdout: Buffer.concat(stdout),
				stderr: Buffer.concat(stderr),
			});
		});
	});
}

function nonEmptyLines(value: string): string[] {
	return value.split(/\r?\n/).filter((line) => line.length > 0);
}

function porcelainPath(line: string): string {
	const raw = line.slice(3);
	const parts = raw.split(" -> ");
	return parts[parts.length - 1];
}

function findRepoRoot(cwd: string): string {
	let current = resolve(cwd);
	while (true) {
		if (existsSync(join(current, ".git"))) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			throw environmentFailure(
				"not-a-git-repo",
				"cwd is not inside a git working tree",
				cwd,
			);
		}
		current = parent;
	}
}
