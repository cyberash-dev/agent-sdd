import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

test("ready flags a `proposed` ID outside sandbox_paths as unapproved", async () => {
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
					sandbox_paths: ["spike/**"],
				},
			},
		},
		files: {
			"spec/spec.md": specWithProposedBeh("fixture:BEH-001"),
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 1);
	assert.equal(env.ok, false);
	assert.equal(env.error, null);
	const unapproved = env.violations.filter((v) => v.kind === "unapproved");
	assert.equal(unapproved.length, 1);
	assert.equal(unapproved[0]!.id, "fixture:BEH-001");
	assert.equal(unapproved[0]!.partition, "fixture");
	assert.equal(unapproved[0]!.status, "proposed");
});

test("ready ignores `proposed` IDs whose spec file matches sandbox_paths", async () => {
	// @covers sdd-cli:BEH-017
	const root = await readyFixture({
		config: {
			spec_file: "spec/spec.md",
			baseline_id: "fixture:BL-001",
			discovery_scope: ["src"],
			mechanism: "git_tree_hash_v1",
			partitions: {
				fixture: {
					spec_paths: ["spike/**/*.md"],
					test_paths: [],
					sandbox_paths: ["spike/**"],
				},
			},
		},
		files: {
			"spike/draft.md": specWithProposedBeh("fixture:BEH-001"),
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 0);
	assert.equal(env.violations.filter((v) => v.kind === "unapproved").length, 0);
});

function specWithProposedBeh(id: string): string {
	return `# fixture

\`\`\`yaml
---
id: ${id}
type: Behavior
lifecycle:
  status: proposed
partition_id: fixture
title: a proposed behavior
test_obligation:
  predicate: trivial
  test_template: unit
---
\`\`\`
`;
}
