import assert from "node:assert/strict";
import test from "node:test";
import type { Partition } from "../../src/shared/domain/Config.js";
import type { LintRecord } from "../../src/shared/domain/SpecRecord.js";
import type { Marker } from "../../src/features/ready/domain/MarkerParser.js";
import {
	ruleOrphanCovers,
	ruleRemovedCompatActionMismatch,
	ruleRemovedNoCompatTest,
	ruleSurfaceUnapprovedRef,
	ruleUnapproved,
	ruleUncovered,
	ruleUnknownPartitionCovers,
	type PartitionView,
	type ScannedMarker,
} from "../../src/features/ready/domain/Rules.js";

const PARTITION: Partition = {
	name: "fixture",
	specPaths: ["spec/spec.md"],
	testPaths: ["tests/**"],
	sandboxPaths: ["spike/**"],
};

function record(
	overrides: Partial<LintRecord> & {
		id: string;
		template: string;
		lifecycleStatus: string | null;
	},
): LintRecord {
	return {
		id: overrides.id,
		template: overrides.template,
		lifecycleStatus: overrides.lifecycleStatus,
		approvalRecord: overrides.approvalRecord ?? null,
		testObligations: overrides.testObligations ?? [],
		hasAliasedObligations: overrides.hasAliasedObligations ?? true,
		parsed: overrides.parsed ?? {},
		file: overrides.file ?? "spec/spec.md",
		line: overrides.line ?? 1,
		rawBlock: "",
	};
}

function viewWith(
	records: LintRecord[],
	creditedById: Record<string, Marker[]> = {},
): PartitionView {
	const map = new Map<string, Marker[]>();
	for (const [k, v] of Object.entries(creditedById)) map.set(k, v);
	return {
		partition: PARTITION,
		records,
		recordsById: new Map(records.map((r) => [r.id, r])),
		creditedMarkersById: map,
	};
}

test("ruleUnapproved fires for a proposed normative ID outside sandbox_paths", () => {
	// @covers sdd-cli:BEH-018
	const view = viewWith([
		record({
			id: "fixture:BEH-001",
			template: "Behavior",
			lifecycleStatus: "proposed",
			file: "spec/spec.md",
		}),
	]);
	const violations = ruleUnapproved(view);

	assert.equal(violations.length, 1);
	assert.equal(violations[0]!.kind, "unapproved");
	assert.equal(violations[0]!.id, "fixture:BEH-001");
});

test("ruleUnapproved skips proposed IDs inside sandbox_paths", () => {
	// @covers sdd-cli:BEH-017
	const view = viewWith([
		record({
			id: "fixture:BEH-001",
			template: "Behavior",
			lifecycleStatus: "proposed",
			file: "spike/draft.md",
		}),
	]);

	assert.equal(ruleUnapproved(view).length, 0);
});

test("ruleUncovered fires for an approved ID with no credited marker", () => {
	// @covers sdd-cli:BEH-018
	const view = viewWith([
		record({
			id: "fixture:BEH-001",
			template: "Behavior",
			lifecycleStatus: "approved",
			parsed: { test_obligation: { predicate: "x", test_template: "unit" } },
		}),
	]);

	const violations = ruleUncovered(view);
	assert.equal(violations.length, 1);
	assert.equal(violations[0]!.kind, "uncovered");
});

test("ruleUncovered exempts approved IDs with not_applicable test_obligation", () => {
	// @covers sdd-cli:BEH-017
	// @covers sdd-cli:OQ-013
	const view = viewWith([
		record({
			id: "fixture:BEH-001",
			template: "Behavior",
			lifecycleStatus: "approved",
			parsed: {
				test_obligation: { not_applicable: "doc_only", reason: "descriptive" },
			},
		}),
	]);

	assert.equal(ruleUncovered(view).length, 0);
});

test("ruleUncovered exempts Surface records (Surface is normative but coverage-exempt)", () => {
	// @covers sdd-cli:BEH-017
	const view = viewWith([
		record({
			id: "fixture:SUR-001",
			template: "Surface",
			lifecycleStatus: "approved",
			parsed: { members: [] },
		}),
	]);

	assert.equal(ruleUncovered(view).length, 0);
});

test("ruleRemovedNoCompatTest fires when no marker carries a compatibility_action token", () => {
	// @covers sdd-cli:BEH-018
	const view = viewWith(
		[
			record({
				id: "fixture:BEH-001",
				template: "Behavior",
				lifecycleStatus: "removed",
				parsed: { compatibility_action: "reject" },
			}),
		],
		{
			"fixture:BEH-001": [
				{
					partition: "fixture",
					id: "BEH-001",
					tail: {},
					file: "tests/foo.test.ts",
					line: 1,
				},
			],
		},
	);

	const violations = ruleRemovedNoCompatTest(view);
	assert.equal(violations.length, 1);
	assert.equal(violations[0]!.kind, "removed_no_compat_test");
});

test("ruleRemovedCompatActionMismatch reports expected/actual when tokens differ", () => {
	// @covers sdd-cli:BEH-018
	// @covers sdd-cli:CTR-014
	const view = viewWith(
		[
			record({
				id: "fixture:BEH-001",
				template: "Behavior",
				lifecycleStatus: "removed",
				parsed: { compatibility_action: "migrate" },
			}),
		],
		{
			"fixture:BEH-001": [
				{
					partition: "fixture",
					id: "BEH-001",
					tail: { compatibility_action: "reject" },
					file: "tests/foo.test.ts",
					line: 7,
				},
			],
		},
	);

	const violations = ruleRemovedCompatActionMismatch(view);
	assert.equal(violations.length, 1);
	assert.equal(violations[0]!.expected, "migrate");
	assert.equal(violations[0]!.actual, "reject");
	assert.equal(violations[0]!.line, 7);
});

test("ruleSurfaceUnapprovedRef fires when an approved Surface references a proposed member", () => {
	// @covers sdd-cli:BEH-018
	const surface = record({
		id: "fixture:SUR-001",
		template: "Surface",
		lifecycleStatus: "approved",
		parsed: { members: ["fixture:CTR-001"] },
	});
	const member = record({
		id: "fixture:CTR-001",
		template: "Contract",
		lifecycleStatus: "proposed",
	});
	const view = viewWith([surface, member]);

	const violations = ruleSurfaceUnapprovedRef(view);
	assert.equal(violations.length, 1);
	assert.equal(violations[0]!.kind, "surface_unapproved_ref");
});

test("ruleSurfaceUnapprovedRef does not fire when all members are approved", () => {
	// @covers sdd-cli:BEH-017
	const surface = record({
		id: "fixture:SUR-001",
		template: "Surface",
		lifecycleStatus: "approved",
		parsed: { members: ["fixture:CTR-001"] },
	});
	const member = record({
		id: "fixture:CTR-001",
		template: "Contract",
		lifecycleStatus: "approved",
	});
	const view = viewWith([surface, member]);

	assert.equal(ruleSurfaceUnapprovedRef(view).length, 0);
});

test("ruleOrphanCovers fires when marker partition is configured but ID is missing", () => {
	// @covers sdd-cli:BEH-018
	const scanned: ScannedMarker[] = [
		{
			marker: {
				partition: "fixture",
				id: "BEH-999",
				tail: {},
				file: "tests/foo.ts",
				line: 1,
			},
			isPartitionConfigured: true,
			hasMatchingRecord: false,
		},
	];
	const violations = ruleOrphanCovers(scanned);

	assert.equal(violations.length, 1);
	assert.equal(violations[0]!.kind, "orphan_covers");
	assert.equal(violations[0]!.id, "fixture:BEH-999");
});

test("ruleOrphanCovers does NOT double-fire when partition is unconfigured (deferred to unknown_partition)", () => {
	// @covers sdd-cli:BEH-018
	const scanned: ScannedMarker[] = [
		{
			marker: {
				partition: "ghost",
				id: "BEH-001",
				tail: {},
				file: "tests/foo.ts",
				line: 1,
			},
			isPartitionConfigured: false,
			hasMatchingRecord: false,
		},
	];

	assert.equal(ruleOrphanCovers(scanned).length, 0);
});

test("ruleUnknownPartitionCovers fires for markers with an unconfigured partition prefix", () => {
	// @covers sdd-cli:BEH-018
	const scanned: ScannedMarker[] = [
		{
			marker: {
				partition: "ghost",
				id: "BEH-001",
				tail: {},
				file: "tests/foo.ts",
				line: 1,
			},
			isPartitionConfigured: false,
			hasMatchingRecord: false,
		},
	];

	const violations = ruleUnknownPartitionCovers(scanned);
	assert.equal(violations.length, 1);
	assert.equal(violations[0]!.partition, "ghost");
});
