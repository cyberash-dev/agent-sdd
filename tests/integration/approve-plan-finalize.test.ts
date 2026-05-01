// @covers sdd-cli:BEH-021
// @covers sdd-cli:BEH-022
// @covers sdd-cli:BEH-023
// @covers sdd-cli:BEH-024
// @covers sdd-cli:BEH-025
// @covers sdd-cli:CTR-017
// @covers sdd-cli:CTR-018
// @covers sdd-cli:CTR-019
// @covers sdd-cli:CTR-020
// @covers sdd-cli:INV-011
// @covers sdd-cli:INV-012
//
// End-to-end coverage for the P0.6 approval split:
//
//   sdd approve  → writes attestation to .sdd/plans/<id>.yaml (default)
//   sdd plan show → reads/prints the active plan
//   sdd finalize  → atomically materialises the plan into spec.md
//   sdd approve --inline → preserves legacy direct-rewrite behavior
//                          and emits a deprecation warning to stderr.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
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

const HAPPY_BLOCK = [
  "```yaml",
  "- id: fixture:beh-1",
  "  template: Behavior",
  "  lifecycle.status: proposed",
  "  approval_record: not_applicable_for_proposed",
  "  test_obligations: [to:fixture:beh-1:happy]",
  "```",
].join("\n");

async function fixtureProject(specBody: string = HAPPY_BLOCK): Promise<{ root: string }> {
  const root = await mkdtemp(join(tmpdir(), "sdd-plan-"));
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify(CONFIG, null, 2));
  await writeFile(join(root, "spec", "spec.md"), `${PARTITION_SHELL}\n${specBody}\n`);
  return { root };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test("approve default mode writes attestation to .sdd/plans/<id>.yaml without touching spec (BEH-021, INV-011)", async () => {
  const { root } = await fixtureProject();
  const before = await readFile(join(root, "spec", "spec.md"), "utf8");

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/1",
    "--format=json",
  ]);

  assert.equal(result.code, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    mode: string;
    plan_id: string;
    plan_path: string;
    is_new_plan: boolean;
    attestation: { id: string };
  };
  assert.equal(body.ok, true);
  assert.equal(body.mode, "plan");
  assert.equal(body.attestation.id, "fixture:beh-1");
  assert.match(body.plan_id, /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z-[a-z0-9]{5}$/);
  assert.equal(body.is_new_plan, true);
  assert.equal(body.plan_path, `.sdd/plans/${body.plan_id}.yaml`);

  // INV-011: spec.md is byte-identical.
  const after = await readFile(join(root, "spec", "spec.md"), "utf8");
  assert.equal(after, before, "spec.md must be byte-stable in plan mode");

  // The plan file must exist with the attestation.
  const planText = await readFile(join(root, body.plan_path), "utf8");
  assert.match(planText, /pending_attestations:/);
  assert.match(planText, /id: fixture:beh-1/);
  assert.match(planText, /approver_identity: alice/);

  // .active points at the new plan.
  const active = (await readFile(join(root, ".sdd", "plans", ".active"), "utf8")).trim();
  assert.equal(active, body.plan_id);
});

test("approve --inline preserves legacy direct rewrite and emits stderr deprecation warning (BEH-022)", async () => {
  const { root } = await fixtureProject();

  const result = await runSdd(root, [
    "approve",
    "--inline",
    "--id", "fixture:beh-1",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/2",
    "--format=json",
  ]);

  assert.equal(result.code, 0);
  const body = JSON.parse(result.stdout) as { mode: string; matched_ids: string[]; files_changed: string[] };
  assert.equal(body.mode, "inline");
  assert.deepEqual(body.matched_ids, ["fixture:beh-1"]);
  assert.deepEqual(body.files_changed, ["spec/spec.md"]);

  // Spec.md is rewritten in inline mode.
  const specText = await readFile(join(root, "spec", "spec.md"), "utf8");
  assert.match(specText, /lifecycle\.status: approved/);

  // Stderr carries the deprecation warning.
  assert.match(result.stderr, /DEPRECATED: --inline will be removed in v1\.1\.0/);
  assert.match(result.stderr, /sdd approve.*sdd finalize/);

  // No plan file is created in inline mode.
  assert.equal(await exists(join(root, ".sdd", "plans")), false);
});

test("plan show prints the active plan with the queued attestations (BEH-023, CTR-020)", async () => {
  const { root } = await fixtureProject();
  await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/3",
  ]);

  const result = await runSdd(root, ["plan", "show", "--format=json"]);
  assert.equal(result.code, 0);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    plan: {
      plan_id: string;
      pending_attestations: Array<{ id: string; approver_identity: string }>;
    };
  };
  assert.equal(body.ok, true);
  assert.match(body.plan.plan_id, /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z-[a-z0-9]{5}$/);
  assert.equal(body.plan.pending_attestations.length, 1);
  assert.equal(body.plan.pending_attestations[0]!.id, "fixture:beh-1");
  assert.equal(body.plan.pending_attestations[0]!.approver_identity, "alice");
});

test("plan show without an active plan exits 2 with no-active-plan", async () => {
  const { root } = await fixtureProject();

  const result = await runSdd(root, ["plan", "show", "--format=json"]);
  assert.equal(result.code, 2);
  const body = JSON.parse(result.stdout) as { ok: boolean; kind: string };
  assert.equal(body.ok, false);
  assert.equal(body.kind, "no-active-plan");
});

test("finalize materialises every attestation atomically and archives the plan (BEH-024, INV-012)", async () => {
  const { root } = await fixtureProject();

  // Queue one attestation.
  const approveJson = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/4",
    "--format=json",
  ]);
  const planId = (JSON.parse(approveJson.stdout) as { plan_id: string }).plan_id;

  const result = await runSdd(root, ["finalize", "--format=json"]);
  assert.equal(result.code, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    plan_id: string;
    finalized_ids: string[];
    files_changed: string[];
    archived_path: string;
  };
  assert.equal(body.ok, true);
  assert.equal(body.plan_id, planId);
  assert.deepEqual(body.finalized_ids, ["fixture:beh-1"]);
  assert.deepEqual(body.files_changed, ["spec/spec.md"]);
  assert.equal(body.archived_path, `.sdd/plans/finalized/${planId}.yaml`);

  // Spec.md flipped.
  const specText = await readFile(join(root, "spec", "spec.md"), "utf8");
  assert.match(specText, /lifecycle\.status: approved/);
  assert.match(specText, /approver_identity: alice/);

  // Plan moved to finalized/.
  assert.equal(await exists(join(root, ".sdd", "plans", `${planId}.yaml`)), false);
  assert.equal(await exists(join(root, ".sdd", "plans", "finalized", `${planId}.yaml`)), true);

  // .active cleared.
  assert.equal(await exists(join(root, ".sdd", "plans", ".active")), false);
});

test("finalize without an active plan exits 2 with no-active-plan", async () => {
  const { root } = await fixtureProject();

  const result = await runSdd(root, ["finalize", "--format=json"]);
  assert.equal(result.code, 2);
  const body = JSON.parse(result.stdout) as { ok: boolean; kind: string };
  assert.equal(body.ok, false);
  assert.equal(body.kind, "no-active-plan");
});

test("finalize refuses on graph violation, leaves spec byte-stable (BEH-025, INV-012)", async () => {
  // A Surface (sur-1, proposed) referencing CTR-1 (proposed). If we flip
  // sur-1 to approved without flipping CTR-1, it's a graph violation.
  const block = [
    "```yaml",
    "- id: fixture:sur-1",
    "  template: Surface",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  members:",
    "    - fixture:ctr-1",
    "  test_obligations: [to:fixture:sur-1:happy]",
    "- id: fixture:ctr-1",
    "  template: Contract",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  test_obligations: [to:fixture:ctr-1:happy]",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);
  const beforeSpec = await readFile(join(root, "spec", "spec.md"), "utf8");

  await runSdd(root, [
    "approve",
    "--id", "fixture:sur-1",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/5",
  ]);

  const result = await runSdd(root, ["finalize", "--format=json"]);
  assert.equal(result.code, 1);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    reason: string;
    offending: Array<{ id: string; references_id: string; references_status: string; via: string }>;
  };
  assert.equal(body.ok, false);
  assert.equal(body.reason, "proposed-references");
  assert.equal(body.offending.length, 1);
  assert.equal(body.offending[0]!.id, "fixture:sur-1");
  assert.equal(body.offending[0]!.references_id, "fixture:ctr-1");
  assert.equal(body.offending[0]!.references_status, "proposed");
  assert.equal(body.offending[0]!.via, "members");

  // INV-012: spec.md is byte-stable on refusal.
  const afterSpec = await readFile(join(root, "spec", "spec.md"), "utf8");
  assert.equal(afterSpec, beforeSpec);

  // Plan stays in place (not moved to finalized/).
  const active = (await readFile(join(root, ".sdd", "plans", ".active"), "utf8")).trim();
  assert.equal(await exists(join(root, ".sdd", "plans", `${active}.yaml`)), true);
  assert.equal(await exists(join(root, ".sdd", "plans", "finalized", `${active}.yaml`)), false);
});

test("approve queues multiple attestations into the same active plan", async () => {
  const block = [
    "```yaml",
    "- id: fixture:beh-1",
    "  template: Behavior",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  test_obligations: [to:fixture:beh-1:happy]",
    "- id: fixture:beh-2",
    "  template: Behavior",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  test_obligations: [to:fixture:beh-2:happy]",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const r1 = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/6",
    "--format=json",
  ]);
  const r2 = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-2",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/6",
    "--format=json",
  ]);
  const planId1 = (JSON.parse(r1.stdout) as { plan_id: string }).plan_id;
  const planId2 = (JSON.parse(r2.stdout) as { plan_id: string }).plan_id;
  assert.equal(planId1, planId2, "both attestations must land in the same plan");

  const planShow = await runSdd(root, ["plan", "show", "--format=json"]);
  const showBody = JSON.parse(planShow.stdout) as {
    plan: { pending_attestations: Array<{ id: string }> };
  };
  assert.deepEqual(
    showBody.plan.pending_attestations.map((a) => a.id).sort(),
    ["fixture:beh-1", "fixture:beh-2"],
  );
});
