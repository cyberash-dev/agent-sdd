// @covers sdd-cli:BEH-042
// @covers sdd-cli:BEH-043
//
// P3 — debt budget mechanics. ENF-020 has two halves:
//   form  — sdd lint validates that every Partition declares unmodeled_budget
//           with the four required sub-fields and well-typed values.
//   runtime (ENF-020 / kind: debt_budget_increased) — sdd ready --against
//           compares Partition.unmodeled_budget.current vs the same partition's
//           value at the requested ref and fires when current grew in a way
//           that violates the declared trend.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { runSdd } from "./_helpers.js";

const exec = promisify(execFile);

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
	discovery_scope: ["src", "spec"],
	mechanism: "git_tree_hash_v1",
};

interface LintBody {
	ok: boolean;
	diagnostics: Array<{ rule: string; message: string }>;
}

async function fixtureProject(specBody: string): Promise<{ root: string }> {
	const root = await mkdtemp(join(tmpdir(), "sdd-p3-"));
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

const partitionWithBudget = (
	current: number,
	trend: string,
	baselineAt = "2026-04-01",
): string =>
	[
		"```yaml",
		"---",
		"id: fixture:PRT-1",
		"type: Partition",
		"partition_id: fixture",
		"owner_team: cyberash",
		"default_policy_set: []",
		"unmodeled_budget:",
		`  current: ${current}`,
		`  baseline_at: "${baselineAt}"`,
		`  baseline_value: ${current + 5}`,
		`  trend: ${trend}`,
		"---",
		"```",
	].join("\n");

// ENF-020 form (P3.1) ----------------------------------------------------

test("BEH-042: Partition without unmodeled_budget triggers sdd:debt-budget-form", async () => {
	const block = [
		"```yaml",
		"---",
		"id: fixture:PRT-1",
		"type: Partition",
		"partition_id: fixture",
		"owner_team: cyberash",
		"default_policy_set: []",
		"---",
		"```",
	].join("\n");
	const { root } = await fixtureProject(block);
	const { code, body } = await lintBody(root);
	assert.equal(code, 1);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:debt-budget-form",
	);
	assert.equal(fired.length, 1);
	assert.match(fired[0]!.message, /missing unmodeled_budget block/);
});

test("BEH-042: Partition with negative current triggers sdd:debt-budget-form", async () => {
	const { root } = await fixtureProject(
		partitionWithBudget(-1, "monotonic_non_increasing"),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:debt-budget-form",
	);
	assert.equal(fired.length, 1);
	assert.match(fired[0]!.message, /current must be an integer >= 0/);
});

test("BEH-042: Partition with invalid trend triggers sdd:debt-budget-form", async () => {
	const { root } = await fixtureProject(
		partitionWithBudget(0, "wishy_washy_trend"),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:debt-budget-form",
	);
	assert.equal(fired.length, 1);
	assert.match(fired[0]!.message, /trend must be in/);
});

test("BEH-042: Partition with all sub-fields valid is silent", async () => {
	const { root } = await fixtureProject(
		partitionWithBudget(5, "monotonic_non_increasing"),
	);
	const { body } = await lintBody(root);
	const fired = body.diagnostics.filter(
		(d) => d.rule === "sdd:debt-budget-form",
	);
	assert.deepEqual(fired, []);
});

// ENF-020 runtime (P3.2) -----------------------------------------------------

async function gitInit(root: string): Promise<void> {
	await exec("git", ["init", "-q", "-b", "main"], { cwd: root });
	await exec("git", ["config", "user.email", "test@example.com"], {
		cwd: root,
	});
	await exec("git", ["config", "user.name", "test"], { cwd: root });
}

async function gitCommitAll(root: string, message: string): Promise<string> {
	await exec("git", ["add", "-A"], { cwd: root });
	await exec("git", ["commit", "-q", "-m", message], { cwd: root });
	const { stdout } = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
	return stdout.trim();
}

async function fixtureGitProject(
	initialBudget: number,
	trend: string,
): Promise<{ root: string; baseSha: string }> {
	const { root } = await fixtureProject(
		partitionWithBudget(initialBudget, trend),
	);
	await gitInit(root);
	const baseSha = await gitCommitAll(root, "base");
	return { root, baseSha };
}

async function rewriteSpec(root: string, body: string): Promise<void> {
	await writeFile(
		join(root, "spec", "spec.md"),
		`${PARTITION_SHELL}\n${body}\n`,
	);
}

test("BEH-043: monotonic_non_increasing — current grew → fires debt_budget_increased", async () => {
	const { root, baseSha } = await fixtureGitProject(
		5,
		"monotonic_non_increasing",
	);
	await rewriteSpec(root, partitionWithBudget(10, "monotonic_non_increasing"));
	await gitCommitAll(root, "grow debt");

	const r = await runSdd(root, [
		"ready",
		"--against",
		baseSha,
		"--format=json",
	]);
	const body = JSON.parse(r.stdout) as {
		violations: Array<{
			kind: string;
			id?: string;
			expected?: string;
			actual?: string;
		}>;
	};
	const fired = body.violations.filter(
		(v) => v.kind === "debt_budget_increased",
	);
	assert.equal(fired.length, 1, JSON.stringify(body.violations));
	assert.equal(fired[0]!.id, "fixture:PRT-1");
	assert.equal(fired[0]!.expected, "<= 5");
	assert.equal(fired[0]!.actual, "10");
});

test("BEH-043: monotonic_non_increasing — current unchanged → silent", async () => {
	const { root, baseSha } = await fixtureGitProject(
		5,
		"monotonic_non_increasing",
	);
	// Touch some other file so the working tree has a delta but the budget
	// stays equal. (Spec.md is not in discovery_scope at the same shape, so
	// we just commit a no-op change to README to advance HEAD.)
	await writeFile(join(root, "src.txt"), "hello");
	await gitCommitAll(root, "no debt change");

	const r = await runSdd(root, [
		"ready",
		"--against",
		baseSha,
		"--format=json",
	]);
	const body = JSON.parse(r.stdout) as { violations: Array<{ kind: string }> };
	const fired = body.violations.filter(
		(v) => v.kind === "debt_budget_increased",
	);
	assert.deepEqual(fired, []);
});

test("BEH-043: monotonic_decreasing — current unchanged → fires (strict trend)", async () => {
	const { root, baseSha } = await fixtureGitProject(5, "monotonic_decreasing");
	// Same Partition values across the two commits — bump some other file so
	// there is something for the second commit to record.
	await writeFile(join(root, "src.txt"), "hello");
	await gitCommitAll(root, "no decrease");

	const r = await runSdd(root, [
		"ready",
		"--against",
		baseSha,
		"--format=json",
	]);
	const body = JSON.parse(r.stdout) as {
		violations: Array<{ kind: string; expected?: string; actual?: string }>;
	};
	const fired = body.violations.filter(
		(v) => v.kind === "debt_budget_increased",
	);
	assert.equal(fired.length, 1);
	assert.equal(fired[0]!.expected, "< 5");
});

test("BEH-043: monotonic_decreasing — current decreased → silent", async () => {
	const { root, baseSha } = await fixtureGitProject(5, "monotonic_decreasing");
	await rewriteSpec(root, partitionWithBudget(3, "monotonic_decreasing"));
	await gitCommitAll(root, "reduce debt");

	const r = await runSdd(root, [
		"ready",
		"--against",
		baseSha,
		"--format=json",
	]);
	const body = JSON.parse(r.stdout) as { violations: Array<{ kind: string }> };
	const fired = body.violations.filter(
		(v) => v.kind === "debt_budget_increased",
	);
	assert.deepEqual(fired, []);
});

test("BEH-043: ready without --against does not run the debt monotonicity pass", async () => {
	const { root } = await fixtureGitProject(5, "monotonic_non_increasing");
	await rewriteSpec(root, partitionWithBudget(10, "monotonic_non_increasing"));
	await gitCommitAll(root, "grow debt");

	// No --against → debt monotonicity pass is skipped entirely.
	const r = await runSdd(root, ["ready", "--format=json"]);
	const body = JSON.parse(r.stdout) as { violations: Array<{ kind: string }> };
	const fired = body.violations.filter(
		(v) => v.kind === "debt_budget_increased",
	);
	assert.deepEqual(fired, []);
});
