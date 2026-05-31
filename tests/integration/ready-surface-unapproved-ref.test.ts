import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

test("ready flags an approved Surface that references a proposed member", async () => {
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
			"spec/spec.md": surfaceWithProposedMember(),
			"tests/foo.test.ts": "// @cov" + "ers fixture:CTR-001\n",
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 1);
	const surfaceViolations = env.violations.filter(
		(v) => v.kind === "surface_unapproved_ref",
	);
	assert.equal(surfaceViolations.length, 1);
	assert.equal(surfaceViolations[0]!.id, "fixture:SUR-001");
});

function surfaceWithProposedMember(): string {
	return `# fixture

\`\`\`yaml
---
id: fixture:SUR-001
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: alice
    timestamp: 2026-01-01T00:00:00Z
    change_request: bootstrap
partition_id: fixture
name: fixture/cli
version: "0.1.0"
boundary_type: cli
members:
  - fixture:CTR-001
consumer_compat_policy: semver_per_surface
---
\`\`\`

\`\`\`yaml
---
id: fixture:CTR-001
type: Contract
lifecycle:
  status: proposed
partition_id: fixture
title: a proposed contract
test_obligation:
  predicate: trivial
  test_template: unit
---
\`\`\`
`;
}
