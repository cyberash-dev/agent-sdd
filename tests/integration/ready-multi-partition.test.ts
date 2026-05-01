import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

test("partition A's tests do not implicitly cross-credit partition B's coverage", async () => {
  // @covers sdd-cli:BEH-017
  // @covers sdd-cli:BEH-018
  // @covers sdd-cli:CTR-015
  const root = await readyFixture({
    config: {
      spec_file: "spec/A.md",
      baseline_id: "a:BL-001",
      discovery_scope: ["src"],
      mechanism: "git_tree_hash_v1",
      partitions: {
        a: {
          spec_paths: ["spec/A.md"],
          test_paths: ["tests/a/**/*.ts"],
        },
        b: {
          spec_paths: ["spec/B.md"],
          test_paths: ["tests/b/**/*.ts"],
        },
      },
    },
    files: {
      "spec/A.md": approvedSpec("a:BEH-001"),
      "spec/B.md": approvedSpec("b:BEH-001"),
      // A's test covers a:BEH-001 (good for A) and ALSO a marker for b:BEH-001
      // — but since this file is NOT in b's test_paths, b:BEH-001 stays
      // uncovered.
      "tests/a/foo.test.ts": "// @cov" + "ers a:BEH-001\n// @cov" + "ers b:BEH-001\n",
    },
  });

  const result = await runReady(root);
  const env = parseEnvelope(result.stdout);

  assert.equal(result.code, 1);
  const uncovered = env.violations.filter((v) => v.kind === "uncovered");
  assert.equal(uncovered.length, 1);
  assert.equal(uncovered[0]!.id, "b:BEH-001");
  assert.equal(uncovered[0]!.partition, "b");
});

test("--partition filter scopes evaluation to that partition only", async () => {
  // @covers sdd-cli:CTR-013
  const root = await readyFixture({
    config: {
      spec_file: "spec/A.md",
      baseline_id: "a:BL-001",
      discovery_scope: ["src"],
      mechanism: "git_tree_hash_v1",
      partitions: {
        a: {
          spec_paths: ["spec/A.md"],
          test_paths: ["tests/a/**/*.ts"],
        },
        b: {
          spec_paths: ["spec/B.md"],
          test_paths: ["tests/b/**/*.ts"],
        },
      },
    },
    files: {
      "spec/A.md": approvedSpec("a:BEH-001"),
      "spec/B.md": approvedSpec("b:BEH-001"),
      "tests/a/foo.test.ts": "// @cov" + "ers a:BEH-001\n",
      // b has no test_paths coverage; without filter ready would flag it.
    },
  });

  const result = await runReady(root, ["--partition", "a"]);
  const env = parseEnvelope(result.stdout);

  assert.equal(result.code, 0);
  assert.equal(env.violations.length, 0);
});

function approvedSpec(id: string): string {
  return `# ${id} fixture

\`\`\`yaml
---
id: ${id}
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: alice
    timestamp: 2026-01-01T00:00:00Z
    change_request: bootstrap
partition_id: ${id.split(":")[0]}
title: ${id}
test_obligation:
  predicate: must be covered
  test_template: unit
---
\`\`\`
`;
}
