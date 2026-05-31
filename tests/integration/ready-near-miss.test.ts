// @covers sdd-cli:BEH-053
//
// OQ-017 (option b) — sdd ready surfaces near-miss @covers markers (tokens that
// look like a marker but fail the partition grammar) as non-blocking advisories
// in the envelope; the gate is not affected.

import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

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

test("ready emits a non-blocking covers_near_miss advisory for an uppercase partition segment", async () => {
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
			"tests/foo.test.ts": "// @cov" + "ers fixture:Bad:BEH-001\n",
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout) as unknown as {
		violations: unknown[];
		advisories: Array<{ kind: string; text: string }>;
	};

	const nearMiss = env.advisories.filter((a) => a.kind === "covers_near_miss");
	assert.equal(nearMiss.length, 1, JSON.stringify(env.advisories));
	assert.equal(nearMiss[0]!.text, "fixture:Bad:BEH-001");
	// Non-blocking: the near-miss alone must not flip the gate to a failure.
	assert.equal(env.violations.length, 0, JSON.stringify(env.violations));
	assert.equal(result.code, 0);
});
