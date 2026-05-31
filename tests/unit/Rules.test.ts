import assert from "node:assert/strict";
import test from "node:test";
import {
	approvalRecordRules,
	fieldTypeRules,
	lifecycleStatusRules,
	sectionViolations,
	testObligationRules,
	weaselFindings,
} from "../../src/features/lint/domain/Rules.js";
import type { LintRecord } from "../../src/features/lint/domain/Record.js";

// @covers sdd-cli:lint-feature
//
// Phase-2 unit coverage for the lint domain rules. Each test exercises one
// rule against a hand-crafted LintRecord; no I/O, no glob, no daemon.

function record(partial: Partial<LintRecord>): LintRecord {
	return {
		id: "demo:bar",
		template: "Behavior",
		lifecycleStatus: "proposed",
		approvalRecord: "not_applicable_for_proposed",
		testObligations: ["to:demo:bar:happy"],
		hasAliasedObligations: false,
		parsed: {
			id: "demo:bar",
			template: "Behavior",
			"lifecycle.status": "proposed",
			version: 1,
		},
		file: "spec/demo.md",
		line: 10,
		rawBlock: "",
		...partial,
	};
}

test("lifecycleStatusRules: missing status on normative ID is an error", () => {
	const out = lifecycleStatusRules(record({ lifecycleStatus: null }));
	assert.equal(out.length, 1);
	assert.equal(out[0]!.severity, "error");
	assert.match(out[0]!.message, /missing lifecycle\.status/);
});

test("lifecycleStatusRules: invalid status value is an error", () => {
	const out = lifecycleStatusRules(record({ lifecycleStatus: "not-a-status" }));
	assert.equal(out.length, 1);
	assert.equal(out[0]!.rule, "sdd:lifecycle-status-valid");
});

test("lifecycleStatusRules: non-normative templates are skipped", () => {
	const out = lifecycleStatusRules(
		record({ template: "ImplementationBinding", lifecycleStatus: null }),
	);
	assert.deepEqual(out, []);
});

test("approvalRecordRules: approved without real approval_record is an error", () => {
	const out = approvalRecordRules(
		record({
			lifecycleStatus: "approved",
			approvalRecord: "not_applicable_for_proposed",
		}),
	);
	assert.equal(out.length, 1);
	assert.equal(out[0]!.rule, "sdd:approval-record-required");
});

test("approvalRecordRules: proposed with real approval_record is forbidden", () => {
	const out = approvalRecordRules(
		record({
			lifecycleStatus: "proposed",
			approvalRecord: "obj:cyberash",
		}),
	);
	assert.equal(out.length, 1);
	assert.equal(out[0]!.rule, "sdd:approval-record-forbidden");
});

test("testObligationRules: normative ID with neither test_obligations nor aliased is an error", () => {
	const out = testObligationRules(
		record({ testObligations: [], hasAliasedObligations: false }),
	);
	assert.equal(out.length, 1);
	assert.equal(out[0]!.rule, "sdd:test-obligation-required");
});

test("testObligationRules: aliased obligation field satisfies §4", () => {
	const out = testObligationRules(
		record({ testObligations: [], hasAliasedObligations: true }),
	);
	assert.deepEqual(out, []);
});

test("testObligationRules: Surface template is exempt", () => {
	const out = testObligationRules(
		record({
			template: "Surface",
			testObligations: [],
			hasAliasedObligations: false,
		}),
	);
	assert.deepEqual(out, []);
});

test("testObligationRules: missing on Constraint is a warning, not error", () => {
	const out = testObligationRules(
		record({
			template: "Constraint",
			testObligations: [],
			hasAliasedObligations: false,
		}),
	);
	assert.equal(out.length, 1);
	assert.equal(out[0]!.severity, "warn");
});

test("fieldTypeRules: Invariant evidence enum", () => {
	const out = fieldTypeRules(
		record({
			template: "Invariant",
			parsed: { id: "demo:foo", template: "Invariant", evidence: "rumor" },
		}),
	);
	assert.ok(out.find((d) => d.rule === "sdd:type-invariant-evidence"));
});

test("fieldTypeRules: NFR verification_stage enum", () => {
	const out = fieldTypeRules(
		record({
			template: "NFR",
			parsed: {
				id: "demo:n",
				template: "NFR",
				verification_obligation: { verification_stage: "production" },
			},
		}),
	);
	assert.ok(out.find((d) => d.rule === "sdd:type-nfr-stage"));
});

test("fieldTypeRules: integer version on a Behavior passes", () => {
	// Negative oracle for sdd:type-version-int — int is allowed.
	const out = fieldTypeRules(
		record({
			template: "Behavior",
			parsed: { id: "demo:beh", template: "Behavior", version: 1 },
		}),
	);
	assert.equal(
		out.find((d) => d.rule === "sdd:type-version-int"),
		undefined,
	);
});

test("fieldTypeRules: semver version on a Behavior is rejected", () => {
	// Non-Surface templates still require integer version per SDD §1.5.
	const out = fieldTypeRules(
		record({
			template: "Behavior",
			parsed: { id: "demo:beh", template: "Behavior", version: "0.1.0" },
		}),
	);
	assert.ok(out.find((d) => d.rule === "sdd:type-version-int"));
});

test("fieldTypeRules: Surface with semver version passes (consumer_compat_policy: semver_per_surface)", () => {
	// Regression: Surface is the unit of semver per SDD discipline, so
	// version: "0.1.0" must NOT trigger sdd:type-version-int.
	const out = fieldTypeRules(
		record({
			template: "Surface",
			parsed: { id: "demo:sur", template: "Surface", version: "0.1.0" },
		}),
	);
	assert.equal(
		out.find((d) => d.rule === "sdd:type-version-int"),
		undefined,
	);
});

test("fieldTypeRules: Surface with non-string non-int version still passes (rule stays Surface-exempt)", () => {
	// Surface version semantics is governed elsewhere; this rule has no
	// opinion on the format for Surface records.
	const out = fieldTypeRules(
		record({
			template: "Surface",
			parsed: { id: "demo:sur", template: "Surface", version: 0.1 },
		}),
	);
	assert.equal(
		out.find((d) => d.rule === "sdd:type-version-int"),
		undefined,
	);
});

test("fieldTypeRules: Migration runtime_state enum", () => {
	const out = fieldTypeRules(
		record({
			template: "Migration",
			parsed: { id: "m:1", template: "Migration", runtime_state: "in-fly" },
		}),
	);
	assert.ok(out.find((d) => d.rule === "sdd:type-migration-runtime-state"));
});

test("sectionViolations: well-formed partition file passes", () => {
	const md = [
		"# Partition",
		"## 1. Context",
		"## 2. Glossary",
		"## 3. Partition",
		"## 4. Brownfield baseline",
		"## 5. Surfaces",
		"## 6. Requirements",
		"## 7. Data contracts",
		"## 8. Invariants",
		"## 9. External dependencies",
		"## 10. Generated artifacts",
		"## 11. Localization",
		"## 12. Policies",
		"## 13. Constraints",
		"## 14. Migrations",
		"## 15. Deltas",
		"## 16. Implementation bindings",
		"## 17. Open questions",
		"## 18. Assumptions",
		"## 19. Out of scope",
	].join("\n");
	assert.deepEqual(sectionViolations(md), []);
});

test("sectionViolations: missing section reports error", () => {
	const md = "# Partition\n## 1. Context\n## 2. Glossary";
	const out = sectionViolations(md);
	assert.ok(out.find((v) => v.message.includes("3. Partition")));
});

test('sectionViolations: missing "8. Invariants" reports it as a presence gap', () => {
	// Regression: spec/spec.md Appendix B canonicalises Invariants as §8;
	// the lint list went out of sync and dropped it for a while, masking
	// every Invariants-specific section check.
	const md = [
		"# Partition",
		"## 1. Context",
		"## 2. Glossary",
		"## 3. Partition",
		"## 4. Brownfield baseline",
		"## 5. Surfaces",
		"## 6. Requirements",
		"## 7. Data contracts",
		// "## 8. Invariants" deliberately missing
		"## 9. External dependencies",
		"## 10. Generated artifacts",
		"## 11. Localization",
		"## 12. Policies",
		"## 13. Constraints",
		"## 14. Migrations",
		"## 15. Deltas",
		"## 16. Implementation bindings",
		"## 17. Open questions",
		"## 18. Assumptions",
		"## 19. Out of scope",
	].join("\n");

	const out = sectionViolations(md);

	// Exactly one presence-rule violation — the missing Invariants header.
	// Subsequent sections cascade as `sdd:section-order` because they exist
	// in the file but at the wrong index; that is the algorithm's contract.
	const presenceGaps = out.filter((v) => v.rule === "sdd:section-presence");
	assert.equal(presenceGaps.length, 1);
	assert.match(presenceGaps[0]!.message, /8\. Invariants/);
});

test("weaselFindings: catches banned phrase in normative section", () => {
	const md =
		"## 6. Requirements\n\nThis happens approximately once per hour.\n";
	const out = weaselFindings(md);
	assert.equal(out.length, 1);
	assert.equal(out[0]!.word, "approximately");
});

test("weaselFindings: ignores ID identifiers and to: refs", () => {
	const md = [
		"## 6. Requirements",
		"- id: demo:beh-fs-prune-best-effort",
		"  test_obligations: [to:demo:beh-fs-prune-best-effort:happy]",
	].join("\n");
	assert.deepEqual(weaselFindings(md), []);
});

test("weaselFindings: ignores non-normative sections", () => {
	const md = "## 1. Context\nApproximately one hour ago.\n";
	assert.deepEqual(weaselFindings(md), []);
});
