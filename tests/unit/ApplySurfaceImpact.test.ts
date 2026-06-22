import assert from "node:assert/strict";
import test from "node:test";

import { lintRecordsFromMarkdown } from "../../src/shared/domain/SpecRecord.js";
import {
	applySurfaceMutations,
	computeSurfaceMutations,
} from "../../src/features/finalize/domain/ApplySurfaceImpact.js";

// @covers sdd-cli:BEH-073
//
// Pure materialisation of an approved Delta's surface_impact: bump the target
// Surface.version to intended_version and union members with the >=approved
// records that declare surface_ref to it.

function records(md: string) {
	return lintRecordsFromMarkdown("spec/spec.md", md);
}

function blockListSpec(version: string, members: readonly string[]): string {
	return [
		"```yaml",
		"- id: t:sur-1",
		"  template: Surface",
		"  lifecycle.status: approved",
		`  version: "${version}"`,
		"  members:",
		...members.map((m) => `    - ${m}`),
		"- id: t:ctr-2",
		"  template: Contract",
		"  lifecycle.status: approved",
		"  surface_ref: t:sur-1",
		"- id: t:del-1",
		"  template: Delta",
		"  lifecycle.status: approved",
		"  surface_impact:",
		"    - id: t:sur-1",
		'      intended_version: "1.1.0"',
		"```",
	].join("\n");
}

test("block-list members: bumps version and appends the approved surface_ref child", () => {
	const md = blockListSpec("1.0.0", ["t:ctr-1"]);
	const approved = new Set(["t:sur-1", "t:ctr-1", "t:ctr-2", "t:del-1"]);

	const mutations = computeSurfaceMutations(records(md), approved);
	const out = applySurfaceMutations(md, mutations);

	assert.match(out, /version: "1\.1\.0"/);
	assert.doesNotMatch(out, /version: "1\.0\.0"/);
	assert.match(out, /- t:ctr-1/);
	assert.match(out, /- t:ctr-2/);
});

test("flow-list members: appends the child inside the inline array", () => {
	const md = [
		"```yaml",
		"- id: t:sur-1",
		"  template: Surface",
		"  lifecycle.status: approved",
		'  version: "1.0.0"',
		"  members: [t:ctr-1]",
		"- id: t:ctr-2",
		"  template: Contract",
		"  lifecycle.status: approved",
		"  surface_ref: t:sur-1",
		"- id: t:del-1",
		"  template: Delta",
		"  lifecycle.status: approved",
		"  surface_impact:",
		"    - id: t:sur-1",
		'      intended_version: "1.1.0"',
		"```",
	].join("\n");
	const approved = new Set(["t:sur-1", "t:ctr-1", "t:ctr-2", "t:del-1"]);

	const out = applySurfaceMutations(
		md,
		computeSurfaceMutations(records(md), approved),
	);

	assert.match(out, /members: \[t:ctr-1, t:ctr-2\]/);
	assert.match(out, /version: "1\.1\.0"/);
});

test("idempotent: a surface already at the intended version with the child is unchanged", () => {
	const md = blockListSpec("1.1.0", ["t:ctr-1", "t:ctr-2"]);
	const approved = new Set(["t:sur-1", "t:ctr-1", "t:ctr-2", "t:del-1"]);

	const out = applySurfaceMutations(
		md,
		computeSurfaceMutations(records(md), approved),
	);

	assert.equal(out, md);
});

test("an unapproved Delta's surface_impact yields no mutation", () => {
	const md = blockListSpec("1.0.0", ["t:ctr-1"]);
	const approved = new Set(["t:sur-1", "t:ctr-1"]); // del-1 / ctr-2 not approved

	const mutations = computeSurfaceMutations(records(md), approved);

	assert.deepEqual(mutations, []);
});

test("version bumps even when the surface_ref child is not yet approved", () => {
	const md = blockListSpec("1.0.0", ["t:ctr-1"]);
	const approved = new Set(["t:sur-1", "t:ctr-1", "t:del-1"]); // ctr-2 not approved

	const out = applySurfaceMutations(
		md,
		computeSurfaceMutations(records(md), approved),
	);

	assert.match(out, /version: "1\.1\.0"/);
	assert.doesNotMatch(out, /- t:ctr-2/);
});
