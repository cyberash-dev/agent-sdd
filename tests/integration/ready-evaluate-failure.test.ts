import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { parseEnvelope, runReady } from "./_ready_helpers.js";

test("ready exits 2 with config_invalid when .sdd/config.json is missing", async () => {
	// @covers sdd-cli:BEH-020
	// @covers sdd-cli:CTR-014
	const root = await mkdtemp(join(tmpdir(), "sdd-ready-no-config-"));

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 2);
	assert.equal(env.ok, false);
	assert.equal(env.violations.length, 0);
	assert.notEqual(env.error, null);
	assert.equal(env.error!.kind, "config_invalid");
});

test("ready exits 2 with config_invalid when .sdd/config.json has unknown fields", async () => {
	// @covers sdd-cli:BEH-020
	const root = await mkdtemp(join(tmpdir(), "sdd-ready-bad-config-"));
	await mkdir(join(root, ".sdd"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify({
			spec_file: "spec/spec.md",
			baseline_id: "fixture:BL-001",
			discovery_scope: ["src"],
			mechanism: "git_tree_hash_v1",
			bogus_field: 42,
		}),
	);

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 2);
	assert.equal(env.error!.kind, "config_invalid");
});

test("ready exits 2 with config_invalid when --partition names a partition not in config", async () => {
	// @covers sdd-cli:BEH-020
	// @covers sdd-cli:CTR-013
	const root = await mkdtemp(join(tmpdir(), "sdd-ready-bad-part-"));
	await mkdir(join(root, ".sdd"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify({
			spec_file: "spec/spec.md",
			baseline_id: "fixture:BL-001",
			discovery_scope: ["src"],
			mechanism: "git_tree_hash_v1",
		}),
	);

	const result = await runReady(root, ["--partition", "ghost"]);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 2);
	assert.equal(env.error!.kind, "config_invalid");
});

if (process.platform !== "win32") {
	test("ready exits 2 with unreadable_test_paths when a matched test file is mode 0 [POSIX]", async () => {
		// @covers sdd-cli:BEH-020
		const root = await mkdtemp(join(tmpdir(), "sdd-ready-eacces-"));
		await mkdir(join(root, ".sdd"));
		await mkdir(join(root, "tests"));
		await writeFile(
			join(root, ".sdd", "config.json"),
			JSON.stringify({
				spec_file: "spec/spec.md",
				baseline_id: "fixture:BL-001",
				discovery_scope: ["src"],
				mechanism: "git_tree_hash_v1",
				partitions: {
					fixture: {
						spec_paths: ["spec/spec.md"],
						test_paths: ["tests/**/*.ts"],
					},
				},
			}),
		);
		await mkdir(join(root, "spec"));
		await writeFile(join(root, "spec", "spec.md"), "# empty\n");
		const lockedPath = join(root, "tests", "locked.test.ts");
		await writeFile(lockedPath, "// @cov" + "ers fixture:BEH-001\n");
		await chmod(lockedPath, 0o000);

		try {
			const result = await runReady(root);
			const env = parseEnvelope(result.stdout);
			assert.equal(result.code, 2);
			assert.equal(env.error!.kind, "unreadable_test_paths");
			assert.equal(env.violations.length, 0);
		} finally {
			await chmod(lockedPath, 0o644);
		}
	});
}
