import assert from "node:assert/strict";
import test from "node:test";
import {
	fileInGlobs,
	matchesGlob,
} from "../../src/features/ready/domain/PartitionResolver.js";

test("matchesGlob handles literal segments", () => {
	// @covers sdd-cli:CST-006
	assert.ok(matchesGlob("tests/foo.ts", "tests/foo.ts"));
	assert.ok(!matchesGlob("tests/foo.ts", "tests/bar.ts"));
});

test("matchesGlob handles `*` within a single segment", () => {
	// @covers sdd-cli:CST-006
	assert.ok(matchesGlob("tests/*.ts", "tests/foo.ts"));
	assert.ok(!matchesGlob("tests/*.ts", "tests/sub/foo.ts"));
});

test("matchesGlob handles `**` across multiple directory levels", () => {
	// @covers sdd-cli:CST-006
	assert.ok(matchesGlob("tests/**/*.ts", "tests/foo.ts"));
	assert.ok(matchesGlob("tests/**/*.ts", "tests/sub/foo.ts"));
	assert.ok(matchesGlob("tests/**/*.ts", "tests/a/b/c/foo.ts"));
	assert.ok(!matchesGlob("tests/**/*.ts", "src/foo.ts"));
});

test("fileInGlobs returns true when any pattern matches", () => {
	// @covers sdd-cli:CST-006
	assert.ok(fileInGlobs("spike/draft.md", ["spike/**", "scratch/**"]));
	assert.ok(!fileInGlobs("src/foo.ts", ["spike/**", "scratch/**"]));
});

test("fileInGlobs returns false for an empty pattern list", () => {
	// @covers sdd-cli:CST-006
	assert.ok(!fileInGlobs("anything", []));
});
