import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

test("ready surfaces lint error-severity diagnostics under aggregated_lint kind", async () => {
  // @covers sdd-cli:BEH-019
  // @covers sdd-cli:CTR-014
  // @covers sdd-cli:DLT-002
  const root = await readyFixture({
    config: {
      spec_file: "spec/spec.md",
      baseline_id: "fixture:BL-001",
      discovery_scope: ["src"],
      mechanism: "git_tree_hash_v1",
      partitions: {
        fixture: {
          spec_paths: ["spec/spec.md"],
          test_paths: [],
        },
      },
    },
    files: {
      "spec/spec.md": specWithApprovalGap("fixture:BEH-001"),
    },
  });

  const result = await runReady(root);
  const env = parseEnvelope(result.stdout);

  assert.equal(result.code, 1);
  const aggregated = env.violations.filter((v) => v.kind === "aggregated_lint");
  // The fixture's BEH-001 is `approved` but lacks an `approval_record`, which
  // fires sdd:approval-record-required at error severity.
  const sources = new Set(aggregated.map((v) => v.source));
  assert.ok(sources.has("sdd:approval-record-required"), `expected sdd:approval-record-required in ${[...sources].join(", ")}`);
});

function specWithApprovalGap(id: string): string {
  return `# fixture

\`\`\`yaml
---
id: ${id}
type: Behavior
lifecycle:
  status: approved
partition_id: fixture
title: approved without approval_record
test_obligation:
  not_applicable: doc_only
  reason: not testable
---
\`\`\`
`;
}
