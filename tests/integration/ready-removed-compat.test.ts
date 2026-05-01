import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

test("ready accepts a `removed` ID with a matching compatibility_action marker", async () => {
  // @covers sdd-cli:BEH-017
  // @covers sdd-cli:CST-007
  const root = await readyFixture({
    config: baseConfig(),
    files: {
      "spec/spec.md": specWithRemoved("fixture:BEH-001", "reject"),
      "tests/foo.test.ts": "// @cov" + "ers fixture:BEH-001 compatibility_action=reject\n",
    },
  });

  const result = await runReady(root);
  const env = parseEnvelope(result.stdout);

  assert.equal(result.code, 0);
  assert.equal(env.violations.length, 0);
});

test("ready flags a `removed` ID when the marker's compatibility_action mismatches the spec", async () => {
  // @covers sdd-cli:BEH-018
  // @covers sdd-cli:CTR-014
  const root = await readyFixture({
    config: baseConfig(),
    files: {
      "spec/spec.md": specWithRemoved("fixture:BEH-001", "migrate"),
      "tests/foo.test.ts": "// @cov" + "ers fixture:BEH-001 compatibility_action=reject\n",
    },
  });

  const result = await runReady(root);
  const env = parseEnvelope(result.stdout);

  assert.equal(result.code, 1);
  const mismatches = env.violations.filter((v) => v.kind === "removed_compat_action_mismatch");
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0]!.id, "fixture:BEH-001");
  assert.equal(mismatches[0]!.expected, "migrate");
  assert.equal(mismatches[0]!.actual, "reject");
});

test("ready flags a `removed` ID with no compatibility_action marker at all", async () => {
  // @covers sdd-cli:BEH-018
  const root = await readyFixture({
    config: baseConfig(),
    files: {
      "spec/spec.md": specWithRemoved("fixture:BEH-001", "reject"),
      "tests/foo.test.ts": "// @cov" + "ers fixture:BEH-001\n",
    },
  });

  const result = await runReady(root);
  const env = parseEnvelope(result.stdout);

  assert.equal(result.code, 1);
  assert.equal(env.violations.filter((v) => v.kind === "removed_no_compat_test").length, 1);
});

function baseConfig(): object {
  return {
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    partitions: {
      fixture: {
        spec_paths: ["spec/spec.md"],
        test_paths: ["tests/**/*.ts"],
      },
    },
  };
}

function specWithRemoved(id: string, compatibilityAction: string): string {
  return `# fixture

\`\`\`yaml
---
id: ${id}
type: Behavior
lifecycle:
  status: removed
  approval_record:
    owner_role: tech-lead
    approver_identity: alice
    timestamp: 2026-01-01T00:00:00Z
    change_request: removal
partition_id: fixture
title: a removed behavior
compatibility_action: ${compatibilityAction}
test_obligation:
  predicate: caller behaviour matches the documented compatibility_action
  test_template: integration
---
\`\`\`
`;
}
