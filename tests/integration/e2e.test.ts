import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	commit,
	fixtureRepo,
	git,
	projectRoot,
	runSdd,
	specText,
} from "./_helpers.js";

test("help and version are available without repo access", async () => {
	// @covers sdd-cli:BEH-008
	// @covers sdd-cli:ASM-009
	const dir = await mkdtemp(join(tmpdir(), "sdd-help-"));
	const packageJson = JSON.parse(
		await readFile(join(projectRoot, "package.json"), "utf8"),
	) as { version: string };

	const help = await runSdd(dir, ["--help"]);
	const version = await runSdd(dir, ["--version"]);

	assert.equal(help.code, 0);
	assert.match(help.stdout, /sdd token/);
	assert.equal(version.code, 0);
	assert.equal(version.stdout, `${packageJson.version}\n`);
});

test("token emits current scope token as JSON", async () => {
	// @covers sdd-cli:BEH-001
	// @covers sdd-cli:CTR-004
	const repo = await fixtureRepo();

	const result = await runSdd(repo.root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as {
		ok: boolean;
		token: string;
		mechanism: string;
		scope: string[];
	};

	assert.equal(result.code, 0);
	assert.equal(body.ok, true);
	assert.equal(body.token, repo.baselineToken);
	assert.equal(body.mechanism, "git_tree_hash_v1");
	assert.deepEqual(body.scope, ["src"]);
});

test("token treats untracked scope file as dirty", async () => {
	// @covers sdd-cli:BEH-002
	// @covers sdd-cli:ASM-008
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "src", "new.ts"),
		"export const value = 1;\n",
	);

	const result = await runSdd(repo.root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as {
		ok: boolean;
		reason: string;
		dirty_paths: string[];
	};

	assert.equal(result.code, 1);
	assert.equal(body.ok, false);
	assert.equal(body.reason, "baseline-dirty");
	assert.deepEqual(body.dirty_paths, ["src/new.ts"]);
});

test("token treats tracked scope file modification as dirty", async () => {
	// @covers sdd-cli:BEH-002
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "src", "foo.ts"),
		"export const value = 99;\n",
	);

	const result = await runSdd(repo.root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as { ok: boolean; reason: string };

	assert.equal(result.code, 1);
	assert.equal(body.reason, "baseline-dirty");
});

test("token ignores dirt outside discovery_scope", async () => {
	// @covers sdd-cli:BEH-001
	// @covers sdd-cli:BEH-002
	const repo = await fixtureRepo();
	await writeFile(join(repo.root, "outside.txt"), "anything\n");

	const result = await runSdd(repo.root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as { ok: boolean; token: string };

	assert.equal(result.code, 0);
	assert.equal(body.ok, true);
	assert.equal(body.token, repo.baselineToken);
});

test("check exits zero when recorded token matches", async () => {
	// @covers sdd-cli:BEH-003
	// @covers sdd-cli:CTR-005
	const repo = await fixtureRepo();

	const result = await runSdd(repo.root, ["check", "--format=json"]);
	const body = JSON.parse(result.stdout) as {
		ok: boolean;
		recorded_token: string;
		baseline_commit_sha: string;
	};

	assert.equal(result.code, 0);
	assert.equal(body.ok, true);
	assert.equal(body.recorded_token, repo.baselineToken);
	assert.equal(body.baseline_commit_sha, repo.baselineCommitSha);
});

test("check reports baseline-stale after a scope file is modified and committed", async () => {
	// @covers sdd-cli:BEH-004
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "src", "foo.ts"),
		"export const value = 2;\n",
	);
	await git(repo.root, ["add", "src/foo.ts"]);
	await commit(repo.root, "modify src");

	const result = await runSdd(repo.root, ["check", "--format=json"]);
	const body = JSON.parse(result.stdout) as { ok: boolean; reason: string };

	assert.equal(result.code, 1);
	assert.equal(body.reason, "baseline-stale");
});

test("check reports baseline-stale when a new scope file is added and committed", async () => {
	// @covers sdd-cli:BEH-004
	const repo = await fixtureRepo();
	await writeFile(join(repo.root, "src", "added.ts"), "export const x = 1;\n");
	await git(repo.root, ["add", "src/added.ts"]);
	await commit(repo.root, "add file");

	const result = await runSdd(repo.root, ["check", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 1);
	assert.equal(body.reason, "baseline-stale");
});

test("check reports baseline-stale when a scope file is deleted and committed", async () => {
	// @covers sdd-cli:BEH-004
	const repo = await fixtureRepo();
	await rm(join(repo.root, "src", "foo.ts"));
	await git(repo.root, ["add", "src/foo.ts"]);
	await commit(repo.root, "delete file");

	const result = await runSdd(repo.root, ["check", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 1);
	assert.equal(body.reason, "baseline-stale");
});

test("check reports baseline-dirty when scope is dirty regardless of token", async () => {
	// @covers sdd-cli:BEH-005
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "src", "foo.ts"),
		"export const value = 7;\n",
	);

	const result = await runSdd(repo.root, ["check", "--format=json"]);
	const body = JSON.parse(result.stdout) as {
		reason: string;
		recomputed_token: string | null;
	};

	assert.equal(result.code, 1);
	assert.equal(body.reason, "baseline-dirty");
	assert.equal(body.recomputed_token, null);
});

test("check reports baseline-dirty before validating recorded token", async () => {
	// @covers sdd-cli:BEH-005
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "spec", "spec.md"),
		specText(
			"\n  not_applicable: bootstrap\n  reason: bootstrap",
			repo.baselineCommitSha,
		),
	);
	await writeFile(
		join(repo.root, "src", "foo.ts"),
		"export const value = 7;\n",
	);

	const result = await runSdd(repo.root, ["check", "--format=json"]);
	const body = JSON.parse(result.stdout) as {
		reason: string;
		recomputed_token: string | null;
	};

	assert.equal(result.code, 1);
	assert.equal(body.reason, "baseline-dirty");
	assert.equal(body.recomputed_token, null);
});

test("check reports duplicate baseline block as config error", async () => {
	// @covers sdd-cli:BEH-009
	// @covers sdd-cli:ASM-002
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "spec", "spec.md"),
		`${await readFile(join(repo.root, "spec", "spec.md"), "utf8")}\n${specText(repo.baselineToken, repo.baselineCommitSha)}`,
	);

	const result = await runSdd(repo.root, ["check", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 2);
	assert.equal(body.reason, "baseline-block-duplicate");
});

test("missing .sdd/config.json is a config error", async () => {
	// @covers sdd-cli:BEH-009
	const repo = await fixtureRepo();
	await rm(join(repo.root, ".sdd", "config.json"));

	const result = await runSdd(repo.root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 2);
	assert.equal(body.reason, "config-missing");
});

test("malformed JSON in .sdd/config.json is a config error", async () => {
	// @covers sdd-cli:BEH-009
	const repo = await fixtureRepo();
	await writeFile(join(repo.root, ".sdd", "config.json"), "{ not json");

	const result = await runSdd(repo.root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 2);
	assert.equal(body.reason, "config-invalid");
});

test("config schema violation (missing discovery_scope) is a config error", async () => {
	// @covers sdd-cli:BEH-009
	// @covers sdd-cli:CTR-003
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, ".sdd", "config.json"),
		JSON.stringify({
			spec_file: "spec/spec.md",
			baseline_id: "fixture:BL-001",
			mechanism: "git_tree_hash_v1",
		}),
	);

	const result = await runSdd(repo.root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 2);
	assert.equal(body.reason, "config-invalid");
});

test("missing baseline block in spec is a config error", async () => {
	// @covers sdd-cli:BEH-009
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "spec", "spec.md"),
		"# fixture\n\nno blocks here\n",
	);

	const result = await runSdd(repo.root, ["check", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 2);
	assert.equal(body.reason, "baseline-block-missing");
});

test("PATH lacks git is an environment error", async () => {
	// @covers sdd-cli:BEH-010
	const repo = await fixtureRepo();

	const result = await runSdd(repo.root, ["token", "--format=json"], {
		env: { PATH: "" },
	});
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 3);
	assert.equal(body.reason, "git-not-on-path");
});

test("repo with unborn HEAD is an environment error", async () => {
	// @covers sdd-cli:BEH-010
	const root = await mkdtemp(join(tmpdir(), "sdd-unborn-"));
	await git(root, ["init", "-b", "main"]);
	const { mkdir } = await import("node:fs/promises");
	await mkdir(join(root, ".sdd"));
	await mkdir(join(root, "spec"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify({
			spec_file: "spec/spec.md",
			baseline_id: "fixture:BL-001",
			discovery_scope: ["src"],
			mechanism: "git_tree_hash_v1",
		}),
	);
	await writeFile(
		join(root, "spec", "spec.md"),
		specText("0".repeat(64), "0".repeat(40)),
	);

	const result = await runSdd(root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 3);
	assert.equal(body.reason, "head-unborn");
});

test("refresh emits Delta and Open-Q stubs for drift", async () => {
	// @covers sdd-cli:BEH-006
	// @covers sdd-cli:CTR-006
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "src", "foo.ts"),
		"export const value = 3;\n",
	);
	await writeFile(
		join(repo.root, "src", "notes.ts"),
		"export const note = 1;\n",
	);
	await git(repo.root, ["add", "src"]);
	await commit(repo.root, "scope drift");

	const result = await runSdd(repo.root, ["refresh", "--format=yaml"]);

	assert.equal(result.code, 0);
	assert.match(result.stdout, /kind: Delta/);
	assert.match(result.stdout, /path: "src\/foo\.ts"/);
	assert.match(result.stdout, /kind: Open-Q/);
	assert.match(result.stdout, /path: "src\/notes\.ts"/);
});

test("refresh includes uncommitted scope drift", async () => {
	// @covers sdd-cli:BEH-006
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "src", "foo.ts"),
		"export const value = 4;\n",
	);

	const result = await runSdd(repo.root, ["refresh", "--format=json"]);
	const body = JSON.parse(result.stdout) as {
		stubs: Array<{ kind: string; path: string }>;
	};

	assert.equal(result.code, 0);
	assert.deepEqual(
		body.stubs.map((stub) => stub.path),
		["src/foo.ts"],
	);
	assert.equal(body.stubs[0]?.kind, "Delta");
});

test("refresh emits empty JSON list with no drift", async () => {
	// @covers sdd-cli:BEH-007
	const repo = await fixtureRepo();

	const result = await runSdd(repo.root, ["refresh", "--format=json"]);
	const body = JSON.parse(result.stdout) as {
		format_version: number;
		stubs: unknown[];
	};

	assert.equal(result.code, 0);
	assert.equal(body.format_version, 1);
	assert.deepEqual(body.stubs, []);
});

test("refresh human format omits emitted_at", async () => {
	// @covers sdd-cli:ASM-005
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, "src", "foo.ts"),
		"export const value = 5;\n",
	);
	await git(repo.root, ["add", "src/foo.ts"]);
	await commit(repo.root, "drift");

	const result = await runSdd(repo.root, ["refresh", "--format=human"]);

	assert.equal(result.code, 0);
	assert.doesNotMatch(result.stdout, /emitted_at/);
});

test("zero-match scope glob is a config error", async () => {
	// @covers sdd-cli:ASM-001
	const repo = await fixtureRepo();
	await writeFile(
		join(repo.root, ".sdd", "config.json"),
		JSON.stringify({
			spec_file: "spec/spec.md",
			baseline_id: "fixture:BL-001",
			discovery_scope: ["src/*.does-not-exist"],
			mechanism: "git_tree_hash_v1",
		}),
	);

	const result = await runSdd(repo.root, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 2);
	assert.equal(body.reason, "config-invalid");
});

test("outside git repo is an environment error", async () => {
	// @covers sdd-cli:BEH-010
	const dir = await mkdtemp(join(tmpdir(), "sdd-env-"));

	const result = await runSdd(dir, ["token", "--format=json"]);
	const body = JSON.parse(result.stdout) as { reason: string };

	assert.equal(result.code, 3);
	assert.equal(body.reason, "not-a-git-repo");
});
