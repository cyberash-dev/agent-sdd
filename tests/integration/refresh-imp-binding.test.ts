// @covers sdd-cli:BEH-051
//
// OQ-004 (option c) — sdd refresh rejects an IMP-* block that omits its
// binding field as a config error (exit 2), naming the offending IMP.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { commit, git, runSdd } from "./_helpers.js";

const CONFIG = JSON.stringify(
	{
		spec_file: "spec/spec.md",
		baseline_id: "fixture:BL-001",
		discovery_scope: ["src"],
		mechanism: "git_tree_hash_v1",
	},
	null,
	2,
);

function specText(impBlock: string): string {
	return [
		"# fixture",
		"",
		"```yaml",
		"---",
		"id: fixture:BL-001",
		"type: BrownfieldBaseline",
		`freshness_token: ${"0".repeat(64)}`,
		`baseline_commit_sha: ${"0".repeat(40)}`,
		"---",
		"```",
		"",
		impBlock,
		"",
	].join("\n");
}

async function repoWith(impBlock: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "sdd-imp-bind-"));
	await git(root, ["init", "-b", "main"]);
	await mkdir(join(root, ".sdd"));
	await mkdir(join(root, "spec"));
	await mkdir(join(root, "src"));
	await writeFile(join(root, ".sdd", "config.json"), CONFIG);
	await writeFile(join(root, "src", "foo.ts"), "export const value = 1;\n");
	await writeFile(join(root, "spec", "spec.md"), specText(impBlock));
	await git(root, ["add", "."]);
	await commit(root, "baseline");
	return root;
}

const IMP_WITHOUT_BINDING = [
	"```yaml",
	"---",
	"id: fixture:IMP-001",
	"type: ImplementationBinding",
	"target_ids:",
	"  - fixture:BEH-001",
	"---",
	"```",
].join("\n");

const IMP_WITH_BINDING = [
	"```yaml",
	"---",
	"id: fixture:IMP-001",
	"type: ImplementationBinding",
	"target_ids:",
	"  - fixture:BEH-001",
	"binding:",
	"  command: src/foo.ts",
	"---",
	"```",
].join("\n");

test("BEH-051: refresh exits 2 when an IMP-* block omits binding, naming the IMP", async () => {
	const root = await repoWith(IMP_WITHOUT_BINDING);

	const result = await runSdd(root, ["refresh", "--format=json"]);
	assert.equal(
		result.code,
		2,
		`stdout=${result.stdout}\nstderr=${result.stderr}`,
	);
	assert.match(`${result.stdout}${result.stderr}`, /fixture:IMP-001/);
});

test("BEH-051: refresh does not raise the binding error when every IMP carries binding", async () => {
	const root = await repoWith(IMP_WITH_BINDING);

	const result = await runSdd(root, ["refresh", "--format=json"]);
	assert.doesNotMatch(`${result.stdout}${result.stderr}`, /missing binding/);
});
