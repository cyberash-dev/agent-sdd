import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvelope, readyFixture, runReady } from "./_ready_helpers.js";

test("multi-segment partition: marker matching the full prefix credits the spec record", async () => {
	// @covers sdd-cli:CST-007
	// @covers sdd-cli:CTR-015
	// @covers sdd-cli:BEH-018
	const root = await readyFixture({
		config: {
			spec_file: "spec/lock.md",
			baseline_id: "umbrella:BL-001",
			discovery_scope: ["src"],
			mechanism: "git_tree_hash_v1",
			partitions: {
				"bridge:lock": {
					spec_paths: ["spec/lock.md"],
					test_paths: ["tests/lock/**/*.ts"],
				},
			},
		},
		files: {
			"spec/lock.md": approvedSpec("bridge:lock:BEH-001", "bridge:lock"),
			"tests/lock/foo.test.ts": "// @cov" + "ers bridge:lock:BEH-001\n",
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(
		result.code,
		0,
		`expected exit 0; stdout=${result.stdout}\nstderr=${result.stderr}`,
	);
	const uncovered = env.violations.filter((v) => v.kind === "uncovered");
	assert.equal(uncovered.length, 0);
});

test("multi-segment partition: missing marker still triggers [uncovered] on the full ID", async () => {
	// @covers sdd-cli:CST-007
	// @covers sdd-cli:BEH-018
	const root = await readyFixture({
		config: {
			spec_file: "spec/lock.md",
			baseline_id: "umbrella:BL-001",
			discovery_scope: ["src"],
			mechanism: "git_tree_hash_v1",
			partitions: {
				"bridge:lock": {
					spec_paths: ["spec/lock.md"],
					test_paths: ["tests/lock/**/*.ts"],
				},
			},
		},
		files: {
			"spec/lock.md": approvedSpec("bridge:lock:BEH-001", "bridge:lock"),
			"tests/lock/foo.test.ts": "// no @covers here\n",
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 1);
	const uncovered = env.violations.filter((v) => v.kind === "uncovered");
	assert.equal(uncovered.length, 1);
	assert.equal(uncovered[0]!.id, "bridge:lock:BEH-001");
	assert.equal(uncovered[0]!.partition, "bridge:lock");
});

test("multi-segment marker against an unconfigured partition triggers [unknown_partition_covers]", async () => {
	// @covers sdd-cli:CST-007
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
			},
		},
		files: {
			"spec/A.md": approvedSpec("a:BEH-001", "a"),
			// marker references multi-segment partition "bridge:lock" that is NOT
			// configured; rule must surface unknown-partition-covers on the full
			// multi-segment string (not on a truncated prefix).
			"tests/a/foo.test.ts":
				"// @cov" + "ers a:BEH-001\n// @cov" + "ers bridge:lock:INV-001\n",
		},
	});

	const result = await runReady(root);
	const env = parseEnvelope(result.stdout);

	assert.equal(result.code, 1);
	const unknown = env.violations.filter(
		(v) => v.kind === "unknown_partition_covers",
	);
	assert.equal(unknown.length, 1);
	assert.equal(unknown[0]!.partition, "bridge:lock");
	assert.equal(unknown[0]!.id, "bridge:lock:INV-001");
});

function approvedSpec(id: string, partition: string): string {
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
partition_id: ${partition}
title: ${id}
test_obligation:
  predicate: must be covered
  test_template: unit
---
\`\`\`
`;
}
