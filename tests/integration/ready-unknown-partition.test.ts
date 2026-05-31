import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

test("ready flags @covers markers whose partition prefix is not configured", async () => {
	// @covers sdd-cli:BEH-018
	// @covers sdd-cli:CTR-014
	const root = await readyFixture({
		config: {
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
		},
		files: {
			"spec/spec.md": minimalSpec(),
			"tests/foo.test.ts": "// @cov" + "ers nonexistent:BEH-001\n",
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 1);
	const unknown = env.violations.filter(
		(v) => v.kind === "unknown_partition_covers",
	);
	assert.equal(unknown.length, 1);
	assert.equal(unknown[0]!.id, "nonexistent:BEH-001");
	assert.equal(unknown[0]!.partition, "nonexistent");
});

function minimalSpec(): string {
	return `# fixture

\`\`\`yaml
---
id: fixture:BEH-001
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: alice
    timestamp: 2026-01-01T00:00:00Z
    change_request: bootstrap
partition_id: fixture
title: an approved behavior
test_obligation:
  not_applicable: doc_only
  reason: not testable
---
\`\`\`
`;
}
