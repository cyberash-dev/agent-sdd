// @covers sdd-cli:BEH-034
// @covers sdd-cli:BEH-035
// @covers sdd-cli:BEH-036
// @covers sdd-cli:BEH-037
//
// P2.1 — boundary requiredness lint rules. A "boundary element" is a
// Contract or Behavior reachable from a Surface whose boundary_type ∈
// {api, sdk, event_bus, cli, public_db, public_storage}. Each fixture
// declares one external Surface (cli) and one Contract reachable through
// surface_ref + members[]. Toggling each required field exercises the
// rule's positive/negative paths.

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
	diagnostics: Array<{ rule: string; message: string }>;
}

async function fixtureProject(specBody: string): Promise<{ root: string }> {
	const root = await mkdtemp(join(tmpdir(), "sdd-p2bnd-"));
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

async function lintBody(
	root: string,
): Promise<{ code: number; body: LintBody }> {
	const r = await runSdd(root, ["lint", "--format=json"]);
	return { code: r.code, body: JSON.parse(r.stdout) as LintBody };
}

/**
 * Build a fixture spec body with one external Surface (cli) and one Contract
 * referencing it. `ctrFields` tunes which boundary requiredness fields are
 * present on the contract.
 */
function fixture(ctrFields: {
	policyRefs?: boolean;
	policyOverrideRationale?: boolean;
	concurrencyModel?: "absent" | "partial" | "full" | "not_applicable";
	applicability?: boolean;
	dataScope?: "absent" | "all_data" | "not_applicable";
}): string {
	const lines: string[] = [];
	lines.push("```yaml");
	lines.push("---");
	lines.push("id: fixture:SUR-A");
	lines.push("type: Surface");
	lines.push("lifecycle:");
	lines.push("  status: proposed");
	lines.push("partition_id: fixture");
	lines.push("name: fixture/cli");
	lines.push('version: "0.1.0"');
	lines.push("boundary_type: cli");
	lines.push("members:");
	lines.push("  - fixture:CTR-A");
	lines.push("consumer_compat_policy: semver_per_surface");
	lines.push("---");
	lines.push("```");

	lines.push("");
	lines.push("```yaml");
	lines.push("---");
	lines.push("id: fixture:CTR-A");
	lines.push("type: Contract");
	lines.push("lifecycle:");
	lines.push("  status: proposed");
	lines.push("partition_id: fixture");
	lines.push("title: boundary contract under test");
	lines.push("surface_ref: fixture:SUR-A");
	lines.push("schema:");
	lines.push("  binary: example");
	if (ctrFields.applicability !== false) {
		lines.push("applicability:");
		lines.push("  invariant_to_all_axes: true");
	}

	if (ctrFields.concurrencyModel === "full") {
		lines.push("concurrency_model:");
		lines.push("  actor_concurrency: single_per_process");
		lines.push("  read_consistency: strong");
		lines.push("  idempotency: none");
		lines.push("  time_source: none");
	} else if (ctrFields.concurrencyModel === "partial") {
		lines.push("concurrency_model:");
		lines.push("  actor_concurrency: single_per_process");
		lines.push("  read_consistency: strong");
		// missing idempotency + time_source
	} else if (ctrFields.concurrencyModel === "not_applicable") {
		lines.push("concurrency_model:");
		lines.push("  not_applicable: contract_describes_static_argv");
		lines.push("  reason: argv has no runtime concurrency dimension");
	}

	if (ctrFields.dataScope === "all_data") {
		lines.push("data_scope: all_data");
	} else if (ctrFields.dataScope === "not_applicable") {
		lines.push("data_scope:");
		lines.push("  not_applicable: contract_is_argv_only");
		lines.push("  reason: argv parsing does not touch persistent state");
	}

	if (ctrFields.policyRefs === true) {
		lines.push("policy_refs:");
		lines.push("  - fixture:POL-001");
	} else if (ctrFields.policyOverrideRationale === true) {
		lines.push("policy_override:");
		lines.push("  rationale: deliberate carve-out — tracked in OQ-XYZ");
	}

	lines.push("test_obligation:");
	lines.push("  predicate: |");
	lines.push("    Trigger fixture for boundary requiredness rules.");
	lines.push("  test_template: integration");
	lines.push("---");
	lines.push("```");
	return lines.join("\n");
}

// ENF-013 — sdd:boundary-policy-ref ----------------------------------------

test("BEH-034: boundary CTR with empty policy_refs triggers", async () => {
	const { root } = await fixtureProject(
		fixture({
			applicability: true,
			concurrencyModel: "full",
			dataScope: "all_data",
		}),
	);
	const { code, body } = await lintBody(root);
	assert.equal(code, 1);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:boundary-policy-ref",
	);
	assert.equal(fired.length, 1);
});

test("BEH-034: boundary CTR with policy_refs is silent", async () => {
	const { root } = await fixtureProject(
		fixture({
			policyRefs: true,
			concurrencyModel: "full",
			dataScope: "all_data",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:boundary-policy-ref",
	);
	assert.deepEqual(fired, []);
});

test("BEH-034: boundary CTR with policy_override.rationale is silent", async () => {
	const { root } = await fixtureProject(
		fixture({
			policyOverrideRationale: true,
			concurrencyModel: "full",
			dataScope: "all_data",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:boundary-policy-ref",
	);
	assert.deepEqual(fired, []);
});

// ENF-014 — sdd:boundary-concurrency-model -------------------------------

test("BEH-035: boundary CTR without concurrency_model triggers", async () => {
	const { root } = await fixtureProject(
		fixture({
			policyRefs: true,
			dataScope: "all_data",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:boundary-concurrency-model",
	);
	assert.equal(fired.length, 1);
});

test("BEH-035: boundary CTR with partial concurrency_model triggers and lists missing fields", async () => {
	const { root } = await fixtureProject(
		fixture({
			policyRefs: true,
			concurrencyModel: "partial",
			dataScope: "all_data",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:boundary-concurrency-model",
	);
	assert.equal(fired.length, 1);
	assert.match(fired[0]!.message, /idempotency/);
	assert.match(fired[0]!.message, /time_source/);
});

test("BEH-035: boundary CTR with concurrency_model.not_applicable + reason is silent", async () => {
	const { root } = await fixtureProject(
		fixture({
			policyRefs: true,
			concurrencyModel: "not_applicable",
			dataScope: "all_data",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:boundary-concurrency-model",
	);
	assert.deepEqual(fired, []);
});

// ENF-015 — sdd:applicability-required -----------------------------------

test("BEH-036: boundary CTR without applicability triggers", async () => {
	const { root } = await fixtureProject(
		fixture({
			applicability: false,
			policyRefs: true,
			concurrencyModel: "full",
			dataScope: "all_data",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:applicability-required",
	);
	assert.equal(fired.length, 1);
});

test("BEH-036: boundary CTR with applicability set is silent", async () => {
	const { root } = await fixtureProject(
		fixture({
			applicability: true,
			policyRefs: true,
			concurrencyModel: "full",
			dataScope: "all_data",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:applicability-required",
	);
	assert.deepEqual(fired, []);
});

// ENF-016 — sdd:data-scope-required --------------------------------------

test("BEH-037: boundary CTR without data_scope triggers", async () => {
	const { root } = await fixtureProject(
		fixture({
			applicability: true,
			policyRefs: true,
			concurrencyModel: "full",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:data-scope-required",
	);
	assert.equal(fired.length, 1);
});

test("BEH-037: boundary CTR with data_scope is silent", async () => {
	const { root } = await fixtureProject(
		fixture({
			applicability: true,
			policyRefs: true,
			concurrencyModel: "full",
			dataScope: "all_data",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:data-scope-required",
	);
	assert.deepEqual(fired, []);
});

test("BEH-037: boundary CTR with data_scope.not_applicable + reason is silent", async () => {
	const { root } = await fixtureProject(
		fixture({
			applicability: true,
			policyRefs: true,
			concurrencyModel: "full",
			dataScope: "not_applicable",
		}),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:data-scope-required",
	);
	assert.deepEqual(fired, []);
});

// Negative scope guard — non-boundary records do NOT trip the rules ------

test("non-boundary CTR (no surface_ref to external Surface) does NOT fire any boundary rule", async () => {
	// A Contract that is not reachable from any Surface — internal only.
	const block = [
		"```yaml",
		"---",
		"id: fixture:CTR-internal",
		"type: Contract",
		"lifecycle:",
		"  status: proposed",
		"partition_id: fixture",
		"title: internal contract — not on a boundary",
		"schema:",
		"  internal_field: value",
		"test_obligation:",
		"  predicate: |",
		"    Internal contract — boundary rules do not apply.",
		"  test_template: unit",
		"---",
		"```",
	].join("\n");
	const { root } = await fixtureProject(block);
	const { body } = await lintBody(root);
	const ruleIds = [
		"sdd:boundary-policy-ref",
		"sdd:boundary-concurrency-model",
		"sdd:applicability-required",
		"sdd:data-scope-required",
	];
	const fired = body.diagnostics.filter((d) => ruleIds.includes(d.rule));
	assert.deepEqual(
		fired,
		[],
		`non-boundary record incorrectly triggered: ${JSON.stringify(fired)}`,
	);
});
