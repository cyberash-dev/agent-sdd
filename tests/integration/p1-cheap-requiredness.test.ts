// @covers sdd-cli:BEH-029
// @covers sdd-cli:BEH-030
// @covers sdd-cli:BEH-031
// @covers sdd-cli:BEH-032
// @covers sdd-cli:BEH-033
//
// P1 — five cheap requiredness rules (ENF-003/009/010/011/012). Each rule is
// covered by a positive fixture (rule fires) and a negative fixture (rule
// silent). Run via the CLI binary so the dispatcher + JSON envelope are
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
  const root = await mkdtemp(join(tmpdir(), "sdd-p1-"));
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify(CONFIG, null, 2));
  await writeFile(join(root, "spec", "spec.md"), `${PARTITION_SHELL}\n${specBody}\n`);
  return { root };
}

async function lintBody(root: string): Promise<{ code: number; body: LintBody }> {
  const r = await runSdd(root, ["lint", "--format=json"]);
  return { code: r.code, body: JSON.parse(r.stdout) as LintBody };
}

// ENF-003 — sdd:baseline-version-required ------------------------------------

test("BEH-029: Delta without baseline_version triggers sdd:baseline-version-required", async () => {
  const { root } = await fixtureProject([
    "```yaml",
    "- id: fixture:dlt-1",
    "  template: Delta",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  test_obligations: [to:fixture:dlt-1:happy]",
    "```",
  ].join("\n"));

  const { code, body } = await lintBody(root);
  assert.equal(code, 1);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:baseline-version-required");
  assert.equal(fired.length, 1, JSON.stringify(body.diagnostics));
  assert.match(fired[0]!.message, /fixture:dlt-1/);
});

test("BEH-029: Delta with baseline_version is silent", async () => {
  const { root } = await fixtureProject([
    "```yaml",
    "- id: fixture:dlt-2",
    "  template: Delta",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  baseline_version: \"sdd-cli:BL-001@2026-04-29\"",
    "  test_obligations: [to:fixture:dlt-2:happy]",
    "```",
  ].join("\n"));

  const { body } = await lintBody(root);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:baseline-version-required");
  assert.deepEqual(fired, []);
});

// ENF-009 — sdd:deprecated-fields-required -----------------------------------

test("BEH-030: deprecated record without sunset_version + replacement_id triggers", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:beh-dep-1",
    "type: Behavior",
    "lifecycle:",
    "  status: deprecated",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-30T00:00:00.000Z",
    "    change_request: https://example.com/pr/1",
    "    scope: sunset",
    "partition_id: fixture",
    "title: doomed behavior",
    "test_obligation:",
    "  predicate: |",
    "    Sunset path requires sunset_version + replacement_id.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { code, body } = await lintBody(root);
  assert.equal(code, 1);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:deprecated-fields-required");
  assert.equal(fired.length, 2, `expected 2 (sunset + replacement) — got ${JSON.stringify(fired)}`);
  for (const f of fired) assert.match(f.message, /fixture:beh-dep-1/);
});

test("BEH-030: deprecated record with sunset_version + replacement_id is silent", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:beh-dep-2",
    "type: Behavior",
    "lifecycle:",
    "  status: deprecated",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-30T00:00:00.000Z",
    "    change_request: https://example.com/pr/2",
    "    scope: sunset",
    "partition_id: fixture",
    "title: graceful sunset",
    "sunset_version: \"2.0.0\"",
    "replacement_id: \"fixture:beh-replacement\"",
    "test_obligation:",
    "  predicate: |",
    "    Documented sunset.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { body } = await lintBody(root);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:deprecated-fields-required");
  assert.deepEqual(fired, []);
});

// ENF-010 — sdd:assumption-downgrade-approval -------------------------------

test("BEH-031: ASSUMPTION with blocking=advisory and no approval triggers", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:asm-1",
    "type: ASSUMPTION",
    "lifecycle:",
    "  status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "partition_id: fixture",
    "title: legacy assumption",
    "blocking: advisory",
    "test_obligation:",
    "  predicate: |",
    "    Trigger fixture.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { code, body } = await lintBody(root);
  assert.equal(code, 1);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:assumption-downgrade-approval");
  assert.equal(fired.length, 1, JSON.stringify(body.diagnostics));
});

test("BEH-031: ASSUMPTION with blocking=advisory and human approval is silent", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:asm-2",
    "type: ASSUMPTION",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-05-01T00:00:00.000Z",
    "    change_request: https://example.com/pr/asm",
    "    scope: downgrade",
    "partition_id: fixture",
    "title: human-approved downgrade",
    "blocking: advisory",
    "test_obligation:",
    "  predicate: |",
    "    Human downgrade — should not fire.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { body } = await lintBody(root);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:assumption-downgrade-approval");
  assert.deepEqual(fired, []);
});

test("BEH-031: ASSUMPTION with blocking=advisory and agent approver triggers", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:asm-3",
    "type: ASSUMPTION",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: claude",
    "    timestamp: 2026-05-01T00:00:00.000Z",
    "    change_request: https://example.com/pr/asm",
    "    scope: downgrade",
    "partition_id: fixture",
    "title: self-approved downgrade",
    "blocking: advisory",
    "test_obligation:",
    "  predicate: |",
    "    Self-approval — should fire.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { body } = await lintBody(root);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:assumption-downgrade-approval");
  assert.equal(fired.length, 1);
  assert.match(fired[0]!.message, /agent blocklist/);
});

test("BEH-031: ASSUMPTION with blocking=yes does NOT fire (rule scoped to advisory)", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:asm-4",
    "type: ASSUMPTION",
    "lifecycle:",
    "  status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "partition_id: fixture",
    "title: blocking yes",
    "blocking: yes",
    "test_obligation:",
    "  predicate: |",
    "    Blocking=yes — rule should not fire (OQ-018: literal advisory trigger).",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { body } = await lintBody(root);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:assumption-downgrade-approval");
  assert.deepEqual(fired, []);
});

// ENF-011 — sdd:partition-default-policy-set --------------------------------

test("BEH-032: Partition without default_policy_set triggers", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:prt-1",
    "type: Partition",
    "lifecycle:",
    "  status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "partition_id: fixture",
    "title: missing default_policy_set",
    "test_obligation:",
    "  predicate: |",
    "    Trigger fixture.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { code, body } = await lintBody(root);
  assert.equal(code, 1);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:partition-default-policy-set");
  assert.equal(fired.length, 1, JSON.stringify(body.diagnostics));
});

test("BEH-032: Partition with empty default_policy_set is silent", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:prt-2",
    "type: Partition",
    "lifecycle:",
    "  status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "partition_id: fixture",
    "title: empty default_policy_set",
    "default_policy_set: []",
    "test_obligation:",
    "  predicate: |",
    "    Empty array satisfies the rule.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { body } = await lintBody(root);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:partition-default-policy-set");
  assert.deepEqual(fired, []);
});

// ENF-012 — sdd:generated-artifact-surface-ref ------------------------------

test("BEH-033: GeneratedArtifact published_surface=yes without surface_ref triggers", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:gen-1",
    "type: GeneratedArtifact",
    "lifecycle:",
    "  status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "partition_id: fixture",
    "title: published artifact without surface_ref",
    "published_surface: yes",
    "test_obligation:",
    "  predicate: |",
    "    Trigger fixture.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { code, body } = await lintBody(root);
  assert.equal(code, 1);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:generated-artifact-surface-ref");
  assert.equal(fired.length, 1, JSON.stringify(body.diagnostics));
});

test("BEH-033: GeneratedArtifact published_surface=yes with surface_ref is silent", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:gen-2",
    "type: GeneratedArtifact",
    "lifecycle:",
    "  status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "partition_id: fixture",
    "title: published with surface_ref",
    "published_surface: yes",
    "surface_ref: fixture:SUR-001",
    "test_obligation:",
    "  predicate: |",
    "    Has surface_ref — silent.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { body } = await lintBody(root);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:generated-artifact-surface-ref");
  assert.deepEqual(fired, []);
});

test("BEH-033: GeneratedArtifact published_surface=no does NOT fire (scoped to yes)", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:gen-3",
    "type: GeneratedArtifact",
    "lifecycle:",
    "  status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "partition_id: fixture",
    "title: not published",
    "published_surface: no",
    "test_obligation:",
    "  predicate: |",
    "    Not published — rule should not fire.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const { body } = await lintBody(root);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:generated-artifact-surface-ref");
  assert.deepEqual(fired, []);
});
