import assert from "node:assert/strict";
import test from "node:test";
import { lintRecordsFromMarkdown } from "../../src/features/lint/domain/SpecParser.js";

// @covers sdd-cli:lint-feature
//
// SpecParser tolerates two YAML conventions:
//   (a) ---separated documents (sdd-cli's canonical format).
//   (b) list-of-objects in a single document (used by some brownfield specs).

test("parses --- separated docs with id+type", () => {
	const md = [
		"```yaml",
		"---",
		"id: demo:beh-1",
		"type: Behavior",
		"lifecycle:",
		"  status: proposed",
		"test_obligations:",
		"  - to:demo:beh-1:happy",
		"---",
		"id: demo:inv-1",
		"type: Invariant",
		"lifecycle:",
		"  status: approved",
		"evidence: db_constraint",
		"stability: contractual",
		"test_obligations:",
		"  - to:demo:inv-1:check",
		"---",
		"```",
	].join("\n");
	const records = lintRecordsFromMarkdown("spec.md", md);
	assert.equal(records.length, 2);
	assert.equal(records[0]!.id, "demo:beh-1");
	assert.equal(records[0]!.template, "Behavior");
	assert.equal(records[0]!.lifecycleStatus, "proposed");
	assert.deepEqual(records[0]!.testObligations, ["to:demo:beh-1:happy"]);
	assert.equal(records[1]!.lifecycleStatus, "approved");
});

test("parses list-of-objects with template+flat lifecycle.status", () => {
	const md = [
		"```yaml",
		"- id: demo:beh-1",
		"  template: Behavior",
		"  lifecycle.status: proposed",
		"  test_obligations: [to:demo:beh-1:happy]",
		"- id: demo:inv-1",
		"  template: Invariant",
		"  lifecycle.status: proposed",
		"  evidence: public_api",
		"  stability: contractual",
		"  test_obligations: [to:demo:inv-1:check]",
		"```",
	].join("\n");
	const records = lintRecordsFromMarkdown("spec.md", md);
	assert.equal(records.length, 2);
	assert.equal(records[0]!.template, "Behavior");
	assert.equal(records[0]!.lifecycleStatus, "proposed");
	assert.deepEqual(records[1]!.testObligations, ["to:demo:inv-1:check"]);
});

test("parses single-object document", () => {
	const md = [
		"```yaml",
		"id: demo:single",
		"template: Policy",
		"lifecycle.status: proposed",
		"negative_test_obligations: [to:demo:single:neg-1]",
		"```",
	].join("\n");
	const records = lintRecordsFromMarkdown("spec.md", md);
	assert.equal(records.length, 1);
	assert.equal(records[0]!.id, "demo:single");
	assert.equal(records[0]!.hasAliasedObligations, true);
});

test("approval_record object form is captured", () => {
	const md = [
		"```yaml",
		"- id: demo:cnt-1",
		"  template: Contract",
		"  lifecycle.status: approved",
		"  test_obligations: [to:demo:cnt-1:happy]",
		"  approval_record:",
		"    owner_role: tech-lead",
		"    approver_identity: cyberash",
		"    timestamp: 2026-04-29T16:00:00Z",
		"    change_request: https://example.com/pr/42",
		"    scope: first-time-approval",
		"```",
	].join("\n");
	const records = lintRecordsFromMarkdown("spec.md", md);
	assert.equal(records.length, 1);
	assert.equal(records[0]!.approvalRecord, "obj:cyberash");
});

test("non-yaml markdown produces no records", () => {
	const md = "# Heading\n\nNot a YAML fence here.\n";
	assert.deepEqual(lintRecordsFromMarkdown("spec.md", md), []);
});

test("approval_record nested under lifecycle is captured", () => {
	// Regression: SUR-001 in spec.md uses the nested form
	//   lifecycle:
	//     status: approved
	//     approval_record: { owner_role, approver_identity, ... }
	// The parser must recognise it just like the top-level form, otherwise
	// sdd:approval-record-required falsely fires on every record using this
	// shape.
	const md = [
		"```yaml",
		"---",
		"id: demo:sur-nested",
		"type: Surface",
		"lifecycle:",
		"  status: approved",
		"  approval_record:",
		"    owner_role: tech-lead",
		"    approver_identity: cyberash",
		"    timestamp: 2026-04-30T10:00:00Z",
		"    change_request: https://example.com/pr/1",
		"---",
		"```",
	].join("\n");

	const records = lintRecordsFromMarkdown("spec.md", md);

	assert.equal(records.length, 1);
	assert.equal(records[0]!.lifecycleStatus, "approved");
	assert.equal(records[0]!.approvalRecord, "obj:cyberash");
});

test("approval_record nested under lifecycle without approver_identity tags as obj:unknown", () => {
	const md = [
		"```yaml",
		"---",
		"id: demo:sur-nested-unknown",
		"type: Surface",
		"lifecycle:",
		"  status: approved",
		"  approval_record:",
		"    owner_role: tech-lead",
		"    timestamp: 2026-04-30T10:00:00Z",
		"---",
		"```",
	].join("\n");

	const records = lintRecordsFromMarkdown("spec.md", md);

	assert.equal(records[0]!.approvalRecord, "obj:unknown");
});

test("singular test_obligation: object form sets hasAliasedObligations", () => {
	// Regression: BEH-001..010 in spec.md use the SDD-canonical singular form
	//   test_obligation:
	//     predicate: ...
	//     test_template: integration
	//     boundary_classes: [...]
	//     failure_scenarios: [...]
	// The parser must treat this as discharging §4, otherwise
	// sdd:test-obligation-required falsely fires on every such record.
	const md = [
		"```yaml",
		"---",
		"id: demo:beh-1",
		"type: Behavior",
		"lifecycle:",
		"  status: proposed",
		"test_obligation:",
		"  predicate: an example predicate",
		"  test_template: integration",
		"  boundary_classes:",
		"    - happy",
		"  failure_scenarios:",
		"    - sad",
		"---",
		"```",
	].join("\n");

	const records = lintRecordsFromMarkdown("spec.md", md);

	assert.equal(records.length, 1);
	assert.equal(records[0]!.hasAliasedObligations, true);
});

test("singular test_obligation: not_applicable also satisfies §4", () => {
	const md = [
		"```yaml",
		"---",
		"id: demo:cnt-1",
		"type: Contract",
		"lifecycle:",
		"  status: proposed",
		"test_obligation: not_applicable_for_proposed",
		"---",
		"```",
	].join("\n");

	const records = lintRecordsFromMarkdown("spec.md", md);

	assert.equal(records[0]!.hasAliasedObligations, true);
});

test("singular test_obligation as a plain non-not_applicable string does NOT satisfy §4", () => {
	// Plain free text is not a valid obligation discharge.
	const md = [
		"```yaml",
		"---",
		"id: demo:beh-bad",
		"type: Behavior",
		"lifecycle:",
		"  status: proposed",
		"test_obligation: TODO write me",
		"---",
		"```",
	].join("\n");

	const records = lintRecordsFromMarkdown("spec.md", md);

	assert.equal(records[0]!.hasAliasedObligations, false);
	assert.deepEqual(records[0]!.testObligations, []);
});

test("top-level approval_record wins over nested when both are present", () => {
	const md = [
		"```yaml",
		"---",
		"id: demo:beh-both",
		"type: Behavior",
		"lifecycle:",
		"  status: approved",
		"  approval_record:",
		"    approver_identity: nested-person",
		"approval_record:",
		"  approver_identity: top-person",
		"---",
		"```",
	].join("\n");

	const records = lintRecordsFromMarkdown("spec.md", md);

	assert.equal(records[0]!.approvalRecord, "obj:top-person");
});
