import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import process from "node:process";
import test from "node:test";
import { promisify } from "node:util";
import { fixtureRepo, runSdd } from "./_helpers.js";

const exec = promisify(execFile);
const ALLOWED_SUBCOMMANDS = new Set([
	"diff",
	"ls-tree",
	"rev-parse",
	"status",
	"show",
]);

interface Shim {
	dir: string;
	logPath: string;
}

async function buildShim(): Promise<Shim> {
	const dir = await mkdtemp(join(tmpdir(), "sdd-git-shim-"));
	const logPath = join(dir, "argv.log");
	const realGitPath = (await exec("which", ["git"])).stdout.trim();
	const script = `#!/bin/sh
printf '<<<\\n' >> "${logPath}"
for arg in "$@"; do printf '%s\\n' "$arg" >> "${logPath}"; done
printf '>>>\\n' >> "${logPath}"
exec "${realGitPath}" "$@"
`;
	const shimPath = join(dir, "git");
	await writeFile(shimPath, script);
	await chmod(shimPath, 0o755);
	return { dir, logPath };
}

async function recordedSubcommands(logPath: string): Promise<string[]> {
	let text: string;
	try {
		text = await readFile(logPath, "utf8");
	} catch {
		return [];
	}
	const subcommands: string[] = [];
	let buffer: string[] | undefined;
	for (const line of text.split("\n")) {
		if (line === "<<<") {
			buffer = [];
			continue;
		}
		if (line === ">>>") {
			if (buffer !== undefined) {
				subcommands.push(firstSubcommand(buffer));
			}
			buffer = undefined;
			continue;
		}
		buffer?.push(line);
	}
	return subcommands;
}

function firstSubcommand(args: readonly string[]): string {
	let i = 0;
	while (i < args.length) {
		const arg = args[i]!;
		if (arg === "-c" || arg === "-C") {
			i += 2;
			continue;
		}
		if (arg.startsWith("-")) {
			i += 1;
			continue;
		}
		return arg;
	}
	return "";
}

test("sdd invokes only EXT-001-allowed git subcommands", async () => {
	// @covers sdd-cli:POL-002
	// @covers sdd-cli:EXT-001
	const repo = await fixtureRepo();
	const shim = await buildShim();
	const env = { PATH: `${shim.dir}${delimiter}${process.env.PATH ?? ""}` };

	await runSdd(repo.root, ["token", "--format=json"], { env });
	await runSdd(repo.root, ["check", "--format=json"], { env });
	await runSdd(repo.root, ["refresh", "--format=json"], { env });
	await runSdd(repo.root, ["ready", "--against", "HEAD~1", "--format=json"], {
		env,
	});
	await runSdd(
		repo.root,
		["report", "--pr-summary", "--against", "HEAD~1", "--format=json"],
		{ env },
	);

	const subcommands = await recordedSubcommands(shim.logPath);
	assert.ok(subcommands.length > 0, "shim recorded no git invocations");
	for (const subcommand of subcommands) {
		assert.ok(
			ALLOWED_SUBCOMMANDS.has(subcommand),
			`git subcommand '${subcommand}' is outside the EXT-001 allowlist`,
		);
	}
});
