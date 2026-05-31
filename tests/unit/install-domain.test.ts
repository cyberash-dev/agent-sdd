import assert from "node:assert/strict";
import test from "node:test";
import {
	parseManifest,
	ManifestError,
} from "../../src/features/install/domain/RuleManifest.js";
import {
	upsertManagedBlock,
	BLOCK_BEGIN,
	BLOCK_END,
} from "../../src/features/install/domain/ManagedBlock.js";
import { mergeHooks } from "../../src/features/install/domain/SettingsMerge.js";
import {
	buildPlan,
	type ExistingTargetFiles,
} from "../../src/features/install/domain/InstallPlan.js";
import type { RuleManifest } from "../../src/features/install/domain/RuleManifest.js";

const SAMPLE = JSON.stringify({
	format_version: 1,
	artifacts: [
		{ source: "a.md", kind: "context", targets: ["claude", "codex"] },
		{
			source: "skills/x/SKILL.md",
			kind: "skill",
			skill_name: "x",
			targets: ["claude", "codex"],
		},
		{ source: "hooks/h.sh", kind: "hook", event: "Read", targets: ["claude"] },
	],
});

const EMPTY_EXISTING: ExistingTargetFiles = {
	claudeMd: null,
	settingsJson: null,
	agentsMd: null,
};

function sampleManifest(): RuleManifest {
	return parseManifest(SAMPLE);
}

function sampleSources(): Map<string, string> {
	return new Map([
		["a.md", "A"],
		["skills/x/SKILL.md", "S"],
		["hooks/h.sh", "#!/bin/bash\n"],
	]);
}

test("parseManifest accepts a well-formed manifest", () => {
	// @covers sdd-cli:CST-008
	const manifest = parseManifest(SAMPLE);

	assert.equal(manifest.formatVersion, 1);
	assert.equal(manifest.artifacts.length, 3);
	assert.equal(manifest.artifacts[2]!.event, "Read");
});

test("parseManifest rejects a wrong format_version", () => {
	// @covers sdd-cli:CST-008
	assert.throws(
		() => parseManifest(JSON.stringify({ format_version: 2, artifacts: [] })),
		ManifestError,
	);
});

test("parseManifest rejects an unknown artifact kind", () => {
	// @covers sdd-cli:CST-008
	const bad = JSON.stringify({
		format_version: 1,
		artifacts: [{ source: "x", kind: "bogus", targets: ["claude"] }],
	});

	assert.throws(() => parseManifest(bad), /unknown kind/);
});

test("parseManifest rejects a hook artifact without an event matcher", () => {
	// @covers sdd-cli:CST-008
	const bad = JSON.stringify({
		format_version: 1,
		artifacts: [{ source: "h.sh", kind: "hook", targets: ["claude"] }],
	});

	assert.throws(() => parseManifest(bad), /event matcher/);
});

test("upsertManagedBlock wraps a fresh file in sentinel markers", () => {
	// @covers sdd-cli:BEH-065
	const result = upsertManagedBlock(null, "BODY");

	assert.ok(result.includes(BLOCK_BEGIN));
	assert.ok(result.includes("BODY"));
	assert.ok(result.includes(BLOCK_END));
	assert.ok(result.endsWith("\n"));
});

test("upsertManagedBlock replaces an existing block without duplicating it", () => {
	// @covers sdd-cli:BEH-068
	const first = upsertManagedBlock("# user notes\n", "ONE");
	const second = upsertManagedBlock(first, "TWO");

	assert.equal(occurrences(second, BLOCK_BEGIN), 1);
	assert.equal(occurrences(second, BLOCK_END), 1);
	assert.ok(second.includes("TWO"));
	assert.ok(!second.includes("ONE"));
	assert.ok(second.startsWith("# user notes"));
});

test("mergeHooks adds a PreToolUse entry to empty settings", () => {
	// @covers sdd-cli:BEH-065
	const text = mergeHooks(null, [{ matcher: "Read", command: "/x.sh" }]);
	const settings = JSON.parse(text) as { hooks: { PreToolUse: unknown[] } };

	assert.equal(settings.hooks.PreToolUse.length, 1);
});

test("mergeHooks is idempotent and preserves a pre-existing user hook", () => {
	// @covers sdd-cli:BEH-068
	const existing = JSON.stringify({
		hooks: {
			PreToolUse: [
				{ matcher: "Bash", hooks: [{ type: "command", command: "/user.sh" }] },
			],
		},
	});

	const once = mergeHooks(existing, [{ matcher: "Read", command: "/x.sh" }]);
	const twice = mergeHooks(once, [{ matcher: "Read", command: "/x.sh" }]);
	const settings = JSON.parse(twice) as {
		hooks: { PreToolUse: { matcher: string }[] };
	};

	assert.equal(settings.hooks.PreToolUse.length, 2);
	assert.ok(settings.hooks.PreToolUse.some((e) => e.matcher === "Bash"));
});

test("buildPlan for claude copies artifacts, writes the import block, and merges hooks", () => {
	// @covers sdd-cli:BEH-065
	const plan = buildPlan(
		sampleManifest(),
		"claude",
		sampleSources(),
		EMPTY_EXISTING,
		"/home/test",
	);
	const paths = plan.writes.map((w) => w.absPath);

	assert.ok(paths.includes("/home/test/.claude/sdd/a.md"));
	assert.ok(paths.includes("/home/test/.claude/skills/x/SKILL.md"));
	assert.ok(paths.includes("/home/test/.claude/sdd/hooks/h.sh"));
	assert.ok(paths.includes("/home/test/.claude/CLAUDE.md"));
	assert.ok(paths.includes("/home/test/.claude/settings.json"));
	assert.ok(
		plan.writes.find((w) => w.absPath.endsWith("hooks/h.sh"))!.executable,
	);
	assert.ok(
		plan.actions.some((a) => a.op === "merge_hook" && a.note === "Read"),
	);
});

test("buildPlan for codex copies under .codex/sdd, writes AGENTS.md, and skips hooks", () => {
	// @covers sdd-cli:BEH-066
	const plan = buildPlan(
		sampleManifest(),
		"codex",
		sampleSources(),
		EMPTY_EXISTING,
		"/home/test",
	);
	const paths = plan.writes.map((w) => w.absPath);

	assert.ok(paths.includes("/home/test/.codex/sdd/a.md"));
	assert.ok(paths.includes("/home/test/.codex/sdd/skills/x/SKILL.md"));
	assert.ok(paths.includes("/home/test/.codex/AGENTS.md"));
	assert.ok(!paths.some((p) => p.includes("settings.json")));
	assert.ok(plan.actions.some((a) => a.kind === "hook" && a.op === "skip"));
});

function occurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}
