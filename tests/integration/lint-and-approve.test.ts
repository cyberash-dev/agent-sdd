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

interface FixtureRoot {
  root: string;
}

async function fixtureProject(specBody: string): Promise<FixtureRoot> {
  const root = await mkdtemp(join(tmpdir(), "sdd-lint-"));
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify(CONFIG, null, 2));
  await writeFile(join(root, "spec", "spec.md"), `${PARTITION_SHELL}\n${specBody}\n`);
  return { root };
}

const HAPPY_BLOCK = [
  "```yaml",
  "- id: fixture:beh-1",
  "  template: Behavior",
  "  lifecycle.status: proposed",
  "  approval_record: not_applicable_for_proposed",
  "  test_obligations: [to:fixture:beh-1:happy]",
  "```",
].join("\n");

test("sdd lint exits 0 on a happy spec", async () => {
  // @covers sdd-cli:BEH-011
  // @covers sdd-cli:CTR-008
  // @covers sdd-cli:CTR-009
  const { root } = await fixtureProject(HAPPY_BLOCK);

  const result = await runSdd(root, ["lint", "--format=json"]);
  const body = JSON.parse(result.stdout) as { ok: boolean; error_count: number; diagnostics: unknown[] };

  assert.equal(result.code, 0);
  assert.equal(body.ok, true);
  assert.equal(body.error_count, 0);
  assert.deepEqual(body.diagnostics, []);
});

test("sdd lint accepts singular test_obligation: object form", async () => {
  // @covers sdd-cli:BEH-011
  // Regression: BEH-001..010 in our own spec.md use the SDD-canonical
  // singular `test_obligation:` block. Before the fix,
  // sdd:test-obligation-required falsely fired on every such record.
  const block = [
    "```yaml",
    "---",
    "id: fixture:beh-singular",
    "type: Behavior",
    "lifecycle:",
    "  status: proposed",
    "test_obligation:",
    "  predicate: an example predicate",
    "  test_template: integration",
    "  boundary_classes:",
    "    - happy",
    "  failure_scenarios:",
    "    - sad",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const result = await runSdd(root, ["lint", "--format=json"]);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    diagnostics: Array<{ rule: string }>;
  };

  assert.equal(result.code, 0, `lint emitted: ${result.stdout}`);
  assert.equal(body.ok, true);
  assert.ok(
    !body.diagnostics.some((d) => d.rule === "sdd:test-obligation-required"),
    "sdd:test-obligation-required must not fire on singular test_obligation",
  );
});

test("sdd lint accepts approval_record nested under lifecycle", async () => {
  // @covers sdd-cli:BEH-011
  // Regression: SUR-001 in our own spec.md uses the nested form. Before the
  // fix, sdd:approval-record-required was a false-positive against every
  // such record.
  const nested = [
    "```yaml",
    "---",
    "id: fixture:sur-nested",
    "type: Surface",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-30T10:00:00Z",
    "    change_request: https://example.com/pr/1",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(nested);

  const result = await runSdd(root, ["lint", "--format=json"]);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    diagnostics: Array<{ rule: string }>;
  };

  assert.equal(result.code, 0, `lint emitted: ${result.stdout}`);
  assert.equal(body.ok, true);
  assert.ok(
    !body.diagnostics.some((d) => d.rule === "sdd:approval-record-required"),
    "sdd:approval-record-required must not fire on nested approval_record",
  );
});

test("sdd lint exits 1 when an error rule fires", async () => {
  // @covers sdd-cli:BEH-012
  const violator = [
    "```yaml",
    "- id: fixture:beh-broken",
    "  template: Behavior",
    "  lifecycle.status: approved", // approved without real approval_record
    "  approval_record: not_applicable_for_proposed",
    "  test_obligations: [to:fixture:beh-broken:happy]",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(violator);

  const result = await runSdd(root, ["lint", "--format=json"]);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    error_count: number;
    diagnostics: Array<{ rule: string; severity: string }>;
  };

  assert.equal(result.code, 1);
  assert.equal(body.ok, false);
  assert.ok(body.error_count >= 1);
  assert.ok(body.diagnostics.some((d) => d.rule === "sdd:approval-record-required" && d.severity === "error"));
});

test("sdd lint human format prints summary line", async () => {
  // @covers sdd-cli:BEH-011
  // @covers sdd-cli:CTR-008
  const { root } = await fixtureProject(HAPPY_BLOCK);

  const result = await runSdd(root, ["lint", "--format=human"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /spec-lint: 0 error\(s\), 0 warning\(s\)/);
});

test("sdd lint does not modify the spec file (INV-006)", async () => {
  // @covers sdd-cli:INV-006
  const violator = [
    "```yaml",
    "- id: fixture:beh-broken",
    "  template: Behavior",
    "  lifecycle.status: approved",
    "  approval_record: not_applicable_for_proposed",
    "  test_obligations: [to:fixture:beh-broken:happy]",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(violator);
  const specPath = join(root, "spec", "spec.md");
  const before = await stat(specPath);
  const beforeText = await readFile(specPath, "utf8");

  await runSdd(root, ["lint", "--format=json"]);

  const after = await stat(specPath);
  const afterText = await readFile(specPath, "utf8");
  assert.equal(afterText, beforeText);
  assert.equal(after.size, before.size);
});

test("sdd approve rewrites lifecycle.status and approval_record", async () => {
  // @covers sdd-cli:BEH-013
  // @covers sdd-cli:INV-007
  // @covers sdd-cli:CTR-010
  // @covers sdd-cli:CTR-011
  const { root } = await fixtureProject(HAPPY_BLOCK);

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/1",
    "--format=json",
  ]);
  const body = JSON.parse(result.stdout) as { ok: boolean; matched_ids: string[]; files_changed: string[] };
  const specText = await readFile(join(root, "spec", "spec.md"), "utf8");

  assert.equal(result.code, 0);
  assert.equal(body.ok, true);
  assert.deepEqual(body.matched_ids, ["fixture:beh-1"]);
  assert.deepEqual(body.files_changed, ["spec/spec.md"]);
  assert.match(specText, /lifecycle\.status: approved/);
  assert.match(specText, /approver_identity: alice/);
  assert.match(specText, /owner_role: tech-lead/);
  assert.match(specText, /change_request: https:\/\/example\.com\/pr\/1/);
  assert.match(specText, /scope: first-time-approval/);
  assert.match(specText, /timestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
});

test("sdd approve refuses agent approver (case-insensitive)", async () => {
  // @covers sdd-cli:BEH-014
  // @covers sdd-cli:INV-005
  const { root } = await fixtureProject(HAPPY_BLOCK);
  const specBefore = await readFile(join(root, "spec", "spec.md"), "utf8");

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "Claude",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/2",
    "--format=json",
  ]);
  const body = JSON.parse(result.stdout) as { ok: boolean; reason: string };
  const specAfter = await readFile(join(root, "spec", "spec.md"), "utf8");

  assert.equal(result.code, 1);
  assert.equal(body.ok, false);
  assert.equal(body.reason, "agent-approver");
  assert.equal(specAfter, specBefore);
});

test("sdd approve refuses bot: prefix", async () => {
  // @covers sdd-cli:BEH-014
  // @covers sdd-cli:INV-005
  const { root } = await fixtureProject(HAPPY_BLOCK);

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "bot:tg-1",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/3",
    "--format=json",
  ]);
  const body = JSON.parse(result.stdout) as { reason: string };

  assert.equal(result.code, 1);
  assert.equal(body.reason, "agent-approver");
});

test("sdd approve refuses unknown owner-role", async () => {
  // @covers sdd-cli:BEH-015
  const { root } = await fixtureProject(HAPPY_BLOCK);

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "alice",
    "--owner-role", "junior-dev",
    "--change-request", "https://example.com/pr/4",
    "--format=json",
  ]);
  const body = JSON.parse(result.stdout) as { reason: string };

  assert.equal(result.code, 1);
  assert.equal(body.reason, "invalid-owner-role");
});

test("sdd approve refuses when --id matches no record", async () => {
  // @covers sdd-cli:BEH-016
  const { root } = await fixtureProject(HAPPY_BLOCK);

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:nope-9999",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/5",
    "--format=json",
  ]);
  const body = JSON.parse(result.stdout) as { reason: string };

  assert.equal(result.code, 1);
  assert.equal(body.reason, "no-id-match");
});

test("sdd approve respects custom blocklist from .sdd/config.json#lint.approver_blocklist", async () => {
  // @covers sdd-cli:INV-005
  // @covers sdd-cli:CTR-012
  const root = await mkdtemp(join(tmpdir(), "sdd-lint-"));
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify({
    ...CONFIG,
    lint: {
      spec_files: ["spec/spec.md"],
      approver_blocklist: ["intern-bot-a"],
    },
  }, null, 2));
  await writeFile(join(root, "spec", "spec.md"), `${PARTITION_SHELL}\n${HAPPY_BLOCK}\n`);

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "intern-bot-a",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/6",
    "--format=json",
  ]);
  const body = JSON.parse(result.stdout) as { reason: string };

  assert.equal(result.code, 1);
  assert.equal(body.reason, "agent-approver");
});

test("sdd approve includes reviewed_test_oracle when provided", async () => {
  // @covers sdd-cli:BEH-013
  // @covers sdd-cli:CTR-010
  const { root } = await fixtureProject(HAPPY_BLOCK);

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:beh-1",
    "--approver", "alice",
    "--owner-role", "architect",
    "--change-request", "https://example.com/pr/7",
    "--reviewed-test-oracle", "tests/oracle.spec.ts",
  ]);
  const specText = await readFile(join(root, "spec", "spec.md"), "utf8");

  assert.equal(result.code, 0);
  assert.match(specText, /reviewed_test_oracle: tests\/oracle\.spec\.ts/);
});

test("sdd approve rewrites multiple records when --id is a glob", async () => {
  // @covers sdd-cli:BEH-013
  const block = [
    "```yaml",
    "- id: fixture:pol-a",
    "  template: Policy",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  negative_test_obligations: [to:fixture:pol-a:neg-1]",
    "- id: fixture:pol-b",
    "  template: Policy",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  negative_test_obligations: [to:fixture:pol-b:neg-1]",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const result = await runSdd(root, [
    "approve",
    "--id", "fixture:pol-*",
    "--approver", "alice",
    "--owner-role", "tech-lead",
    "--change-request", "https://example.com/pr/8",
    "--format=json",
  ]);
  const body = JSON.parse(result.stdout) as { matched_ids: string[] };
  const specText = await readFile(join(root, "spec", "spec.md"), "utf8");

  assert.equal(result.code, 0);
  assert.deepEqual(body.matched_ids.sort(), ["fixture:pol-a", "fixture:pol-b"]);
  assert.equal((specText.match(/lifecycle\.status: approved/g) ?? []).length, 2);
});
