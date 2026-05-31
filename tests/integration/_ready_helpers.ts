import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runSdd, type RunResult } from "./_helpers.js";

// Lightweight fixture for `sdd ready` tests. Not a git repo by default; the
// aggregated_check leg of ready is skipped silently when isGitRepo returns
// false, which is exactly what these per-rule tests want.

export interface ReadyFixtureOptions {
	config: object;
	files?: Record<string, string>; // path => content
}

export async function readyFixture(
	options: ReadyFixtureOptions,
): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "sdd-ready-"));
	await mkdir(join(root, ".sdd"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify(options.config, null, 2),
	);
	for (const [rel, content] of Object.entries(options.files ?? {})) {
		const abs = join(root, rel);
		await mkdir(dirname(abs), { recursive: true });
		await writeFile(abs, content);
	}
	return root;
}

export async function runReady(
	cwd: string,
	extraArgs: readonly string[] = [],
): Promise<RunResult> {
	return runSdd(cwd, ["ready", "--format=json", ...extraArgs]);
}

export interface ReadyEnvelope {
	ok: boolean;
	error: { kind: string; message: string; file?: string } | null;
	violations: Array<{
		kind: string;
		id?: string;
		partition?: string;
		status?: string;
		file?: string;
		line?: number;
		expected?: string;
		actual?: string;
		remediation?: string;
		source?: string;
	}>;
}

export function parseEnvelope(stdout: string): ReadyEnvelope {
	return JSON.parse(stdout) as ReadyEnvelope;
}
