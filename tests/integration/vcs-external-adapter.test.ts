import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fixtureRepo, runSdd } from "./_helpers.js";
import { specText } from "./_helpers.js";

interface AdapterPackage {
	name: string;
	files: Record<string, string>;
}

interface RepoOptions {
	vcs?: string;
	mechanism?: string;
	adapter?: AdapterPackage;
}

async function makeRepo(options: RepoOptions): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "sdd-vcs-"));
	await writeFile(
		join(root, "package.json"),
		JSON.stringify({ name: "consumer", version: "1.0.0" }),
	);
	await mkdir(join(root, ".sdd"));
	await mkdir(join(root, "spec"));
	await mkdir(join(root, "src"));

	const config: Record<string, unknown> = {
		spec_file: "spec/spec.md",
		baseline_id: "fixture:BL-001",
		discovery_scope: ["src"],
		mechanism: options.mechanism ?? "git_tree_hash_v1",
	};
	if (options.vcs !== undefined) {
		config.vcs = options.vcs;
	}
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify(config, null, 2),
	);
	await writeFile(join(root, "src", "foo.ts"), "export const value = 1;\n");
	await writeFile(
		join(root, "spec", "spec.md"),
		specText("0".repeat(64), "0".repeat(40)),
	);

	if (options.adapter !== undefined) {
		const pkgDir = join(
			root,
			"node_modules",
			...options.adapter.name.split("/"),
		);
		await mkdir(pkgDir, { recursive: true });
		for (const [name, content] of Object.entries(options.adapter.files)) {
			await writeFile(join(pkgDir, name), content);
		}
	}
	return root;
}

function adapterBody(mechanism: string, omitMethod?: string): string {
	return `function createVcs(options) {
  const vcs = {
    mechanism: ${JSON.stringify(mechanism)},
    isGitRepo: async () => true,
    repoRoot: async (cwd) => cwd,
    headSha: async () => "0".repeat(40),
    treeBytes: async () => Buffer.from("fake-tree-bytes"),
    treePaths: async () => ["src/foo.ts"],
    dirtyPaths: async () => [],
    changedPaths: async () => [],
    readAtRef: async () => null,
  };
  ${omitMethod ? `delete vcs[${JSON.stringify(omitMethod)}];` : ""}
  return vcs;
}`;
}

function cjsAdapter(
	name: string,
	mechanism: string,
	omitMethod?: string,
): AdapterPackage {
	return {
		name,
		files: {
			"package.json": JSON.stringify({
				name,
				version: "1.0.0",
				main: "index.js",
			}),
			"index.js": `${adapterBody(mechanism, omitMethod)}\nmodule.exports = { createVcs };\n`,
		},
	};
}

function cjsDefaultAdapter(name: string, mechanism: string): AdapterPackage {
	return {
		name,
		files: {
			"package.json": JSON.stringify({
				name,
				version: "1.0.0",
				main: "index.js",
			}),
			"index.js": `${adapterBody(mechanism)}\nmodule.exports = createVcs;\n`,
		},
	};
}

function throwingAdapter(name: string): AdapterPackage {
	return {
		name,
		files: {
			"package.json": JSON.stringify({
				name,
				version: "1.0.0",
				main: "index.js",
			}),
			"index.js": `function createVcs() { throw new Error("factory boom"); }\nmodule.exports = { createVcs };\n`,
		},
	};
}

function esmAdapter(name: string, mechanism: string): AdapterPackage {
	return {
		name,
		files: {
			"package.json": JSON.stringify({
				name,
				version: "1.0.0",
				type: "module",
				main: "index.js",
			}),
			"index.js": `export ${adapterBody(mechanism, undefined)}\n`,
		},
	};
}

function tokenMechanism(stdout: string): string {
	const body = JSON.parse(stdout) as { mechanism?: string };
	assert.equal(typeof body.mechanism, "string");
	return body.mechanism ?? "";
}

test("token uses the built-in git mechanism when vcs is absent", async () => {
	// @covers sdd-cli:BEH-076
	const repo = await fixtureRepo();

	const result = await runSdd(repo.root, ["token", "--format=json"]);

	assert.equal(result.code, 0);
	assert.equal(tokenMechanism(result.stdout), "git_tree_hash_v1");
});

test("token loads a CJS external adapter resolved from the consumer repo", async () => {
	// @covers sdd-cli:BEH-077
	// @covers sdd-cli:CTR-031
	// @covers sdd-cli:EXT-003
	// @covers sdd-cli:DLT-006
	const root = await makeRepo({
		vcs: "@fake/sdd-vcs",
		mechanism: "fake_fingerprint_v1",
		adapter: cjsAdapter("@fake/sdd-vcs", "fake_fingerprint_v1"),
	});

	const result = await runSdd(root, ["token", "--format=json"]);

	assert.equal(result.code, 0, result.stderr);
	assert.equal(tokenMechanism(result.stdout), "fake_fingerprint_v1");
});

test("token loads an ESM external adapter resolved from the consumer repo", async () => {
	// @covers sdd-cli:BEH-077
	const root = await makeRepo({
		vcs: "@fake/sdd-vcs-esm",
		mechanism: "fake_fingerprint_v1",
		adapter: esmAdapter("@fake/sdd-vcs-esm", "fake_fingerprint_v1"),
	});

	const result = await runSdd(root, ["token", "--format=json"]);

	assert.equal(result.code, 0, result.stderr);
	assert.equal(tokenMechanism(result.stdout), "fake_fingerprint_v1");
});

test("token exits 2 when the vcs adapter package is not installed", async () => {
	// @covers sdd-cli:BEH-078
	// @covers sdd-cli:POL-004
	const root = await makeRepo({
		vcs: "@missing/sdd-vcs",
		mechanism: "fake_fingerprint_v1",
	});

	const result = await runSdd(root, ["token", "--format=json"]);

	assert.equal(result.code, 2);
	assert.match(`${result.stdout}${result.stderr}`, /@missing\/sdd-vcs/);
});

test("token exits 2 when the adapter is missing a required method", async () => {
	// @covers sdd-cli:BEH-079
	const root = await makeRepo({
		vcs: "@fake/sdd-vcs-broken",
		mechanism: "fake_fingerprint_v1",
		adapter: cjsAdapter(
			"@fake/sdd-vcs-broken",
			"fake_fingerprint_v1",
			"treeBytes",
		),
	});

	const result = await runSdd(root, ["token", "--format=json"]);

	assert.equal(result.code, 2);
	assert.match(`${result.stdout}${result.stderr}`, /treeBytes/);
});

test("token exits 2 when config mechanism disagrees with the adapter mechanism", async () => {
	// @covers sdd-cli:BEH-079
	const root = await makeRepo({
		vcs: "@fake/sdd-vcs-mismatch",
		mechanism: "declared_v1",
		adapter: cjsAdapter("@fake/sdd-vcs-mismatch", "actual_v1"),
	});

	const result = await runSdd(root, ["token", "--format=json"]);

	assert.equal(result.code, 2);
	assert.match(`${result.stdout}${result.stderr}`, /declared_v1|actual_v1/);
});

test("token loads an adapter exposed as a default factory export", async () => {
	// @covers sdd-cli:CTR-031
	const root = await makeRepo({
		vcs: "@fake/sdd-vcs-default",
		mechanism: "fake_fingerprint_v1",
		adapter: cjsDefaultAdapter("@fake/sdd-vcs-default", "fake_fingerprint_v1"),
	});

	const result = await runSdd(root, ["token", "--format=json"]);

	assert.equal(result.code, 0, result.stderr);
	assert.equal(tokenMechanism(result.stdout), "fake_fingerprint_v1");
});

test("token exits 2 when the adapter factory throws", async () => {
	// @covers sdd-cli:POL-004
	const root = await makeRepo({
		vcs: "@fake/sdd-vcs-throws",
		mechanism: "fake_fingerprint_v1",
		adapter: throwingAdapter("@fake/sdd-vcs-throws"),
	});

	const result = await runSdd(root, ["token", "--format=json"]);

	assert.equal(result.code, 2);
	assert.match(`${result.stdout}${result.stderr}`, /factory boom/);
});

test("token exits 2 when the vcs adapter path escapes the repo root", async () => {
	// @covers sdd-cli:POL-004
	const root = await makeRepo({
		vcs: "../evil-adapter.js",
		mechanism: "fake_fingerprint_v1",
	});

	const result = await runSdd(root, ["token", "--format=json"]);

	assert.equal(result.code, 2);
	assert.match(`${result.stdout}${result.stderr}`, /escapes the repo root/);
});
