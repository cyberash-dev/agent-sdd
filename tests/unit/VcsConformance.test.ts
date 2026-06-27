import assert from "node:assert/strict";
import test from "node:test";
import { conformsToVcs } from "../../src/shared/domain/VcsConformance.js";

function aConformantAdapter(): Record<string, unknown> {
	return {
		mechanism: "fake_fingerprint_v1",
		isGitRepo: async () => true,
		repoRoot: async () => "/repo",
		headSha: async () => "0".repeat(40),
		treeBytes: async () => new Uint8Array(),
		treePaths: async () => [],
		dirtyPaths: async () => [],
		changedPaths: async () => [],
		readAtRef: async () => null,
	};
}

const REQUIRED_METHODS = [
	"isGitRepo",
	"repoRoot",
	"headSha",
	"treeBytes",
	"treePaths",
	"dirtyPaths",
	"changedPaths",
	"readAtRef",
];

test("conformsToVcs accepts a fully shaped adapter", () => {
	const candidate = aConformantAdapter();

	const result = conformsToVcs(candidate);

	assert.equal(result.ok, true);
	assert.equal(result.ok && result.vcs, candidate);
});

for (const method of REQUIRED_METHODS) {
	test(`conformsToVcs rejects an adapter missing ${method}`, () => {
		const candidate = aConformantAdapter();
		delete candidate[method];

		const result = conformsToVcs(candidate);

		assert.equal(result.ok, false);
		assert.ok(
			!result.ok && result.problems.includes(`missing method: ${method}`),
		);
	});
}

test("conformsToVcs rejects a non-string mechanism", () => {
	const candidate = aConformantAdapter();
	candidate.mechanism = 7;

	const result = conformsToVcs(candidate);

	assert.equal(result.ok, false);
	assert.ok(
		!result.ok && result.problems.includes("mechanism is not a string"),
	);
});

test("conformsToVcs rejects a mechanism that breaks the id grammar", () => {
	// @covers sdd-cli:CTR-032
	const candidate = aConformantAdapter();
	candidate.mechanism = "Git Tree!";

	const result = conformsToVcs(candidate);

	assert.equal(result.ok, false);
	assert.ok(
		!result.ok &&
			result.problems.some((p) => p.startsWith('mechanism "Git Tree!"')),
	);
});

test("conformsToVcs rejects a non-object candidate", () => {
	const result = conformsToVcs(null);

	assert.equal(result.ok, false);
	assert.ok(!result.ok && result.problems.includes("adapter is not an object"));
});
