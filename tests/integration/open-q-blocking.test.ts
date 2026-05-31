// @covers sdd-cli:BEH-050
//
// ENF-059 — sdd:open-q-blocking. An unresolved Open-Q with blocking=yes fails
// spec-valid. Run via the CLI binary so the dispatcher + JSON envelope are
// part of the contract.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSdd } from "./_helpers.js";

const PARTITION_SHELL = [
	"# fixture",
	"",
	"## 1. Context",
	"",
	"## 2. Glossary",
	"",
	"## 3. Partition",
	"",
	"## 4. Brownfield baseline",
	"",
	"## 5. Surfaces",
	"",
	"## 6. Requirements",
	"",
	"## 7. Data contracts",
	"",
	"## 8. Invariants",
	"",
	"## 9. External dependencies",
	"",
	"## 10. Generated artifacts",
	"",
	"## 11. Localization",
	"",
	"## 12. Policies",
	"",
	"## 13. Constraints",
	"",
	"## 14. Migrations",
	"",
	"## 15. Deltas",
	"",
	"## 16. Implementation bindings",
	"",
	"## 17. Open questions",
	"",
	"## 18. Assumptions",
	"",
	"## 19. Out of scope",
	"",
].join("\n");

const CONFIG = {
	spec_file: "spec/spec.md",
	baseline_id: "fixture:BL-001",
	discovery_scope: ["src"],
	mechanism: "git_tree_hash_v1",
};

interface LintBody {
	ok: boolean;
	diagnostics: Array<{ rule: string; message: string; line?: number | null }>;
}

async function fixtureProject(specBody: string): Promise<{ root: string }> {
	const root = await mkdtemp(join(tmpdir(), "sdd-oqb-"));
	await mkdir(join(root, ".sdd"));
	await mkdir(join(root, "spec"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify(CONFIG, null, 2),
	);
	await writeFile(
		join(root, "spec", "spec.md"),
		`${PARTITION_SHELL}\n${specBody}\n`,
	);
	return { root };
}

async function openQBlockingFired(
	root: string,
): Promise<{ code: number; fired: LintBody["diagnostics"] }> {
	const r = await runSdd(root, ["lint", "--format=json"]);
	const body = JSON.parse(r.stdout) as LintBody;
	return {
		code: r.code,
		fired: body.diagnostics.filter((d) => d.rule === "sdd:open-q-blocking"),
	};
}

function openQBlock(
	id: string,
	opts: { blocking: string; status?: string },
): string {
	return [
		"```yaml",
		"---",
		`id: ${id}`,
		"type: Open-Q",
		"lifecycle:",
		`  status: ${opts.status ?? "proposed"}`,
		"partition_id: fixture",
		"question: |",
		"  A genuinely open question?",
		"options:",
		"  - id: a",
		"    label: first",
		"    consequence: one",
		"  - id: b",
		"    label: second",
		"    consequence: two",
		`blocking: ${opts.blocking}`,
		"owner: alice",
		"default_if_unresolved: a",
		"---",
		"```",
	].join("\n");
}

test("BEH-050: Open-Q with blocking=yes triggers sdd:open-q-blocking", async () => {
	const { root } = await fixtureProject(
		openQBlock("fixture:oq-1", { blocking: "yes" }),
	);

	const { code, fired } = await openQBlockingFired(root);
	assert.equal(code, 1);
	assert.equal(fired.length, 1, JSON.stringify(fired));
	assert.match(fired[0]!.message, /fixture:oq-1/);
});

test("BEH-050: Open-Q with blocking=no is silent", async () => {
	const { root } = await fixtureProject(
		openQBlock("fixture:oq-2", { blocking: "no" }),
	);

	const { fired } = await openQBlockingFired(root);
	assert.deepEqual(fired, []);
});

test("BEH-050: Open-Q with blocking=yes but status=removed is silent", async () => {
	const { root } = await fixtureProject(
		openQBlock("fixture:oq-3", { blocking: "yes", status: "removed" }),
	);

	const { fired } = await openQBlockingFired(root);
	assert.deepEqual(fired, []);
});

test("BEH-050: a non-Open-Q record with blocking=yes does not fire (scoped to Open-Q)", async () => {
	const block = [
		"```yaml",
		"---",
		"id: fixture:asm-1",
		"type: ASSUMPTION",
		"lifecycle:",
		"  status: proposed",
		"  approval_record: not_applicable_for_proposed",
		"partition_id: fixture",
		"title: blocking assumption",
		"blocking: yes",
		"review_by: 2026-12-31",
		"default_if_unresolved: a",
		"tests: [to:fixture:asm-1:happy]",
		"test_obligation:",
		"  predicate: |",
		"    Not an Open-Q — open-q-blocking should not fire.",
		"  test_template: integration",
		"---",
		"```",
	].join("\n");
	const { root } = await fixtureProject(block);

	const { fired } = await openQBlockingFired(root);
	assert.deepEqual(fired, []);
});
