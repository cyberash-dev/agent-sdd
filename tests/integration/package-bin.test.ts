import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { projectRoot } from "./_helpers.js";

const exec = promisify(execFile);

test(
	"sdd binary works after npm pack + install into a fresh consumer",
	{ timeout: 120_000 },
	async () => {
		// @covers sdd-cli:CTR-007
		// @covers sdd-cli:GEN-001
		await exec("npm", ["run", "build"], { cwd: projectRoot });

		const packDir = await mkdtemp(join(tmpdir(), "sdd-pack-"));
		await exec("npm", ["pack", "--pack-destination", packDir], {
			cwd: projectRoot,
		});
		const tarball = (await readdir(packDir)).find((entry) =>
			entry.endsWith(".tgz"),
		);
		assert.ok(tarball, "npm pack did not produce a .tgz");

		const consumer = await mkdtemp(join(tmpdir(), "sdd-consumer-"));
		await writeFile(
			join(consumer, "package.json"),
			JSON.stringify({ name: "consumer", version: "0.0.0", private: true }),
		);
		await exec(
			"npm",
			[
				"install",
				"--no-audit",
				"--no-fund",
				"--prefer-offline",
				join(packDir, tarball!),
			],
			{ cwd: consumer },
		);

		const sddBin = join(consumer, "node_modules", ".bin", "sdd");
		const help = await exec(sddBin, ["--help"], { cwd: consumer });
		const version = await exec(sddBin, ["--version"], { cwd: consumer });

		assert.match(help.stdout, /sdd token/);
		assert.match(version.stdout, /^\d+\.\d+\.\d+\n$/);
	},
);
