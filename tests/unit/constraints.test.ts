import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";

// Mechanical assertions for the project's structural Constraints.
// CST-003 is verified transitively by tests/unit/layer-imports.test.ts
// (cross-referenced via test_obligations: [to:sdd-cli:INV-004]).

const projectRoot = process.cwd();

function readJson<T>(relativePath: string): T {
	const text = readFileSync(join(projectRoot, relativePath), "utf8");
	return JSON.parse(text) as T;
}

interface PackageJson {
	type?: string;
	files?: string[];
	engines?: { node?: string };
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

interface ManifestJson {
	format_version?: number;
	artifacts?: { source?: string }[];
}

interface TsConfig {
	compilerOptions?: {
		module?: string;
		target?: string;
		declaration?: boolean;
		outDir?: string;
	};
}

interface ConfigSchema {
	properties?: {
		mechanism?: {
			enum?: string[];
		};
	};
}

test('CST-001: package.json#engines.node is ">=20"', () => {
	// @covers sdd-cli:CST-001
	const pkg = readJson<PackageJson>("package.json");

	assert.equal(pkg.engines?.node, ">=20");
});

test("CST-002: tsconfig + package.json reflect TypeScript NodeNext / ES2022 / declaration / outDir, ESM module", () => {
	// @covers sdd-cli:CST-002
	const ts = readJson<TsConfig>("tsconfig.json");
	const pkg = readJson<PackageJson>("package.json");

	assert.equal(ts.compilerOptions?.module, "NodeNext");
	assert.equal(ts.compilerOptions?.target, "ES2022");
	assert.equal(ts.compilerOptions?.declaration, true);
	assert.equal(ts.compilerOptions?.outDir, "dist");
	assert.equal(pkg.type, "module");
});

test("CST-004: yaml@^2 is the only YAML parser, no js-yaml", () => {
	// @covers sdd-cli:CST-004
	// @covers sdd-cli:EXT-002
	const pkg = readJson<PackageJson>("package.json");

	const yamlRange = pkg.dependencies?.yaml;
	assert.ok(yamlRange !== undefined, "yaml is missing from dependencies");
	assert.match(
		yamlRange,
		/^\^2/,
		`yaml dependency must be ^2.x, got ${yamlRange}`,
	);
	assert.equal(
		pkg.dependencies?.["js-yaml"],
		undefined,
		"js-yaml must not be a runtime dependency",
	);
	assert.equal(
		pkg.devDependencies?.["js-yaml"],
		undefined,
		"js-yaml must not be a dev dependency either",
	);
});

test('CST-005: schema/sdd.config.schema.json mechanism enum is exactly ["git_tree_hash_v1"]', () => {
	// @covers sdd-cli:CST-005
	const schema = readJson<ConfigSchema>("schema/sdd.config.schema.json");

	assert.deepEqual(schema.properties?.mechanism?.enum, ["git_tree_hash_v1"]);
});

test("CST-006: no third-party glob library in runtime dependencies", () => {
	// @covers sdd-cli:CST-006
	// CST-006 mandates a hand-rolled glob expander (`*`, `?`, `**`, literal
	// segments only). The runtime dep tree must stay {yaml}. This test pins
	// the dep set so a future PR cannot silently add a glob library and
	// widen the supply-chain footprint.
	const pkg = readJson<PackageJson>("package.json");
	const runtimeDeps = Object.keys(pkg.dependencies ?? {}).sort();

	assert.deepEqual(
		runtimeDeps,
		["yaml"],
		`unexpected runtime dependency set: ${runtimeDeps.join(", ")}`,
	);
	for (const name of [
		"minimatch",
		"micromatch",
		"fast-glob",
		"glob",
		"globby",
		"picomatch",
	]) {
		assert.equal(
			pkg.dependencies?.[name],
			undefined,
			`${name} must not be a runtime dependency (CST-006)`,
		);
		assert.equal(
			pkg.devDependencies?.[name],
			undefined,
			`${name} must not be a dev dependency (CST-006 — hand-rolled glob only)`,
		);
	}
});

test("CST-008: package ships rules/, manifest resolves, runtime deps stay {yaml}", () => {
	// @covers sdd-cli:CST-008
	const pkg = readJson<PackageJson>("package.json");
	assert.ok(
		pkg.files?.includes("rules"),
		'package.json#files must include "rules" so the rule tree ships',
	);

	const manifest = readJson<ManifestJson>("rules/manifest.json");
	assert.equal(manifest.format_version, 1);
	assert.ok(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0);
	for (const artifact of manifest.artifacts ?? []) {
		const source = artifact.source!;
		assert.ok(
			readFileSync(join(projectRoot, "rules", source), "utf8").length > 0,
			`manifest source ${source} must resolve to a non-empty file`,
		);
	}

	assert.deepEqual(
		Object.keys(pkg.dependencies ?? {}).sort(),
		["yaml"],
		"install must not add a runtime dependency",
	);
});
