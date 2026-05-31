import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

test("ready flags an approved ID with no @covers marker as uncovered", async () => {
	// @covers sdd-cli:BEH-018
	// @covers sdd-cli:CST-007
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
			"spec/spec.md": specWithApprovedBeh("fixture:BEH-001"),
			"tests/foo.test.ts": "describe('foo', () => { /* no @covers */ });\n",
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 1);
	const uncovered = env.violations.filter((v) => v.kind === "uncovered");
	assert.equal(uncovered.length, 1);
	assert.equal(uncovered[0]!.id, "fixture:BEH-001");
});

test("ready exempts an approved ID with `Test obligation: not_applicable + reason`", async () => {
	// @covers sdd-cli:BEH-017
	// @covers sdd-cli:OQ-013
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
			"spec/spec.md": specWithNotApplicable("fixture:BEH-001"),
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 0);
	assert.equal(env.violations.filter((v) => v.kind === "uncovered").length, 0);
});

test("ready credits an @covers marker only when the test file is in the partition's test_paths", async () => {
	// @covers sdd-cli:BEH-017
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
			"spec/spec.md": specWithApprovedBeh("fixture:BEH-001"),
			"tests/covers.test.ts": "// @cov" + "ers fixture:BEH-001\n",
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 0);
	assert.equal(env.violations.filter((v) => v.kind === "uncovered").length, 0);
});

function specWithApprovedBeh(id: string): string {
	return `# fixture

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
partition_id: fixture
title: an approved behavior
test_obligation:
  predicate: must be covered by a test
  test_template: unit
---
\`\`\`
`;
}

function specWithNotApplicable(id: string): string {
	return `# fixture

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
partition_id: fixture
title: a behavior with no testable surface
test_obligation:
  not_applicable: documentation_only
  reason: this behavior is purely descriptive
---
\`\`\`
`;
}
