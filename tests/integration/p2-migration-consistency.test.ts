// @covers sdd-cli:BEH-038
// @covers sdd-cli:BEH-039
//
// P2.2 — migration consistency rules. ENF-017 verifies that any record with
// data_scope=post_migration:<MIG-ID> references an existing Migration that
// declares enforcement_stage. ENF-018 verifies that cross-partition Migrations
// declare partition_slice[] entries with coordinator_id.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSdd } from "./_helpers.js";

const PARTITION_SHELL = [
  "# fixture", "", "## 1. Context", "", "## 2. Glossary", "", "## 3. Partition", "",
  "## 4. Brownfield baseline", "", "## 5. Surfaces", "", "## 6. Requirements", "",
  "## 7. Data contracts", "", "## 8. Invariants", "", "## 9. External dependencies", "",
  "## 10. Generated artifacts", "", "## 11. Localization", "", "## 12. Policies", "",
  "## 13. Constraints", "", "## 14. Migrations", "", "## 15. Deltas", "",
  "## 16. Implementation bindings", "", "## 17. Open questions", "",
  "## 18. Assumptions", "", "## 19. Out of scope", "",
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
  const root = await mkdtemp(join(tmpdir(), "sdd-p2mig-"));
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

const INVARIANT_DEPENDS_ON_MIGRATION = (migId: string): string => [
  "```yaml",
  "---",
  "id: fixture:INV-1",
  "type: Invariant",
  "lifecycle:",
  "  status: proposed",
  "partition_id: fixture",
  "title: depends on migration",
  "always: |",
  "  Some invariant.",
  `data_scope: post_migration:${migId}`,
  "evidence: test_probe",
  "stability: contractual",
  "test_obligation:",
  "  predicate: |",
  "    Trigger fixture.",
  "  test_template: integration",
  "---",
  "```",
].join("\n");

const MIGRATION = (id: string, opts: { enforcementStage?: string; targetIds?: string[]; partitionSlice?: Array<{ coordinator: boolean }> }): string => {
  const lines: string[] = [];
  lines.push("```yaml");
  lines.push("---");
  lines.push(`id: ${id}`);
  lines.push("type: Migration");
  lines.push("lifecycle:");
  lines.push("  status: proposed");
  lines.push("partition_id: fixture");
  lines.push("title: a migration");
  lines.push("direction: forward_only");
  lines.push("mode: backfill");
  lines.push("runtime_state: pre_cutover");
  lines.push('baseline_version: "fixture:BL-001@2026-01-01"');
  if (opts.enforcementStage !== undefined) {
    lines.push(`enforcement_stage: ${opts.enforcementStage}`);
  }
  if (opts.targetIds !== undefined) {
    lines.push("target_ids:");
    for (const t of opts.targetIds) lines.push(`  - ${t}`);
  }
  if (opts.partitionSlice !== undefined) {
    lines.push("partition_slice:");
    for (let i = 0; i < opts.partitionSlice.length; i++) {
      const slice = opts.partitionSlice[i]!;
      lines.push(`  - partition: fixture-${i}`);
      if (slice.coordinator) lines.push(`    coordinator_id: fixture:COORD-${i}`);
    }
  }
  lines.push("test_obligation:");
  lines.push("  predicate: |");
  lines.push("    Migration fixture.");
  lines.push("  test_template: integration");
  lines.push("---");
  lines.push("```");
  return lines.join("\n");
};

// ENF-017 — sdd:migration-enforcement-stage --------------------------------

test("BEH-038: Invariant referencing a missing Migration triggers", async () => {
  const { root } = await fixtureProject(INVARIANT_DEPENDS_ON_MIGRATION("fixture:MIG-MISSING"));
  const { code, body } = await lintBody(root);
  assert.equal(code, 1);
  const fired = body.diagnostics.filter((d) => d.rule === "sdd:migration-enforcement-stage");
  assert.equal(fired.length, 1, JSON.stringify(body.diagnostics));
  assert.match(fired[0]!.message, /MIG-MISSING/);
});

test("BEH-038: Migration without enforcement_stage triggers", async () => {
  const body = INVARIANT_DEPENDS_ON_MIGRATION("fixture:MIG-1") + "\n\n" + MIGRATION("fixture:MIG-1", {});
  const { root } = await fixtureProject(body);
  const { code, body: res } = await lintBody(root);
  assert.equal(code, 1);
  const fired = res.diagnostics.filter((d) => d.rule === "sdd:migration-enforcement-stage");
  assert.equal(fired.length, 1);
  assert.match(fired[0]!.message, /enforcement_stage/);
});

test("BEH-038: Migration with enforcement_stage as string is silent", async () => {
  const body = INVARIANT_DEPENDS_ON_MIGRATION("fixture:MIG-1") + "\n\n" + MIGRATION("fixture:MIG-1", { enforcementStage: "feature_flag:ff_cutover" });
  const { root } = await fixtureProject(body);
  const { body: res } = await lintBody(root);
  const fired = res.diagnostics.filter((d) => d.rule === "sdd:migration-enforcement-stage");
  assert.deepEqual(fired, []);
});

// ENF-018 — sdd:migration-cross-partition --------------------------------

test("BEH-039: cross-partition Migration without partition_slice triggers", async () => {
  const body = MIGRATION("fixture:MIG-x", { targetIds: ["a:CTR-1", "b:CTR-2"] });
  const { root } = await fixtureProject(body);
  const { body: res } = await lintBody(root);
  const fired = res.diagnostics.filter((d) => d.rule === "sdd:migration-cross-partition");
  assert.equal(fired.length, 1);
  assert.match(fired[0]!.message, /a, b/);
});

test("BEH-039: cross-partition Migration with partition_slice missing coordinator_id triggers", async () => {
  const body = MIGRATION("fixture:MIG-x", {
    targetIds: ["a:CTR-1", "b:CTR-2"],
    partitionSlice: [{ coordinator: false }, { coordinator: false }],
  });
  const { root } = await fixtureProject(body);
  const { body: res } = await lintBody(root);
  const fired = res.diagnostics.filter((d) => d.rule === "sdd:migration-cross-partition");
  assert.equal(fired.length, 1);
  assert.match(fired[0]!.message, /coordinator_id/);
});

test("BEH-039: cross-partition Migration with partition_slice + coordinator_id is silent", async () => {
  const body = MIGRATION("fixture:MIG-x", {
    targetIds: ["a:CTR-1", "b:CTR-2"],
    partitionSlice: [{ coordinator: true }, { coordinator: true }],
  });
  const { root } = await fixtureProject(body);
  const { body: res } = await lintBody(root);
  const fired = res.diagnostics.filter((d) => d.rule === "sdd:migration-cross-partition");
  assert.deepEqual(fired, []);
});

test("BEH-039: single-partition Migration is silent regardless of partition_slice", async () => {
  const body = MIGRATION("fixture:MIG-x", { targetIds: ["a:CTR-1", "a:CTR-2"] });
  const { root } = await fixtureProject(body);
  const { body: res } = await lintBody(root);
  const fired = res.diagnostics.filter((d) => d.rule === "sdd:migration-cross-partition");
  assert.deepEqual(fired, []);
});
