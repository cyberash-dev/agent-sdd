import assert from "node:assert/strict";
import test from "node:test";
import { matchId, rewriteApproval } from "../../src/features/approve/domain/Rewrite.js";
import type { ApproveRequest } from "../../src/features/approve/domain/ApproveRequest.js";

// @covers sdd-cli:approve-feature
//
// Rewrite is a pure function: input markdown + ApproveRequest → output
// markdown. We verify the two YAML conventions both get rewritten in place.

const REQ: ApproveRequest = {
  id: "demo:beh-1",
  approver: "cyberash",
  ownerRole: "tech-lead",
  changeRequest: "https://example.com/pr/42",
  scope: "first-time-approval",
  targetStatus: "approved",
  reviewedTestOracle: null,
};

const FROZEN_TIME = new Date("2026-04-29T16:00:00.000Z");

test("matchId: exact match", () => {
  assert.equal(matchId("demo:beh-1", "demo:beh-1"), true);
  assert.equal(matchId("demo:beh-1", "demo:beh-2"), false);
});

test("matchId: glob with *", () => {
  assert.equal(matchId("pol:*", "pol:fence-no-leak"), true);
  assert.equal(matchId("pol:*", "demo:cnt-1"), false);
});

test("rewrites a list-of-objects record", () => {
  const md = [
    "```yaml",
    "- id: demo:beh-1",
    "  template: Behavior",
    "  lifecycle.status: proposed",
    "  test_obligations: [to:demo:beh-1:happy]",
    "  approval_record: not_applicable_for_proposed",
    "```",
  ].join("\n");
  const result = rewriteApproval(md, REQ, FROZEN_TIME);
  assert.equal(result.matched.length, 1);
  assert.match(result.newContent, /lifecycle\.status: approved/);
  assert.match(result.newContent, /approver_identity: cyberash/);
  assert.match(result.newContent, /timestamp: 2026-04-29T16:00:00\.000Z/);
  assert.match(result.newContent, /change_request: https:\/\/example\.com\/pr\/42/);
});

test("rewrites a --- separated document", () => {
  // Variable under test: --- separator handling, not nested lifecycle.
  // Rewrite expects flat `lifecycle.status:` per INV-007's atomic-write
  // contract; nested `lifecycle:` + indented `status:` is a separate
  // surface not covered by this rewriter.
  const md = [
    "```yaml",
    "---",
    "id: demo:beh-1",
    "type: Behavior",
    "lifecycle.status: proposed",
    "test_obligations:",
    "  - to:demo:beh-1:happy",
    "approval_record: not_applicable_for_proposed",
    "---",
    "```",
  ].join("\n");
  const result = rewriteApproval(md, REQ, FROZEN_TIME);
  assert.equal(result.matched.length, 1);
  assert.match(result.newContent, /lifecycle\.status: approved/);
  assert.match(result.newContent, /approver_identity: cyberash/);
});

test("glob matches multiple records and rewrites each", () => {
  const md = [
    "```yaml",
    "- id: pol:auth",
    "  template: Policy",
    "  lifecycle.status: proposed",
    "  negative_test_obligations: [to:pol:auth:neg-1]",
    "  approval_record: not_applicable_for_proposed",
    "- id: pol:audit",
    "  template: Policy",
    "  lifecycle.status: proposed",
    "  negative_test_obligations: [to:pol:audit:neg-1]",
    "  approval_record: not_applicable_for_proposed",
    "```",
  ].join("\n");
  const r = rewriteApproval(md, { ...REQ, id: "pol:*" }, FROZEN_TIME);
  assert.equal(r.matched.length, 2);
  assert.equal((r.newContent.match(/lifecycle\.status: approved/g) ?? []).length, 2);
});

test("non-matching id leaves content untouched", () => {
  const md = [
    "```yaml",
    "- id: demo:beh-1",
    "  template: Behavior",
    "  lifecycle.status: proposed",
    "  test_obligations: [to:demo:beh-1:happy]",
    "  approval_record: not_applicable_for_proposed",
    "```",
  ].join("\n");
  const r = rewriteApproval(md, { ...REQ, id: "demo:cnt-99" }, FROZEN_TIME);
  assert.equal(r.matched.length, 0);
  assert.equal(r.newContent, md);
});

test("includes reviewed_test_oracle when provided", () => {
  const md = [
    "```yaml",
    "- id: demo:srf-1",
    "  template: Surface",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "```",
  ].join("\n");
  const r = rewriteApproval(md, { ...REQ, id: "demo:srf-1", reviewedTestOracle: "tests/oracle.spec.ts" }, FROZEN_TIME);
  assert.match(r.newContent, /reviewed_test_oracle: tests\/oracle\.spec\.ts/);
});

test("inserts approval_record when input record has no placeholder (SDD §7.6, INV-007)", () => {
  // Regression: when a proposed record lacks `approval_record` (per
  // SDD §7.6 the field is forbidden while proposed), `sdd approve`
  // MUST still emit the full approval_record block atomically with the
  // status flip, not just rewrite the status line.
  const md = [
    "```yaml",
    "template: ExternalDependency",
    "id: demo:beh-1",
    "lifecycle.status: proposed",
    "version: 1",
    "```",
  ].join("\n");
  const result = rewriteApproval(md, REQ, FROZEN_TIME);
  assert.equal(result.matched.length, 1);
  assert.match(result.newContent, /lifecycle\.status: approved/);
  assert.match(result.newContent, /approval_record:\n {2}owner_role: tech-lead/);
  assert.match(result.newContent, /approver_identity: cyberash/);
  assert.match(result.newContent, /change_request: https:\/\/example\.com\/pr\/42/);
  // The block must appear *between* lifecycle.status and version, i.e.
  // immediately after the flipped status line, so the two writes are
  // contiguous and atomic.
  const lifecyclePos = result.newContent.indexOf("lifecycle.status: approved");
  const approvalPos = result.newContent.indexOf("approval_record:");
  const versionPos = result.newContent.indexOf("version: 1");
  assert.ok(lifecyclePos < approvalPos && approvalPos < versionPos);
});

test("rewrites nested lifecycle form (lifecycle:\\n  status:)", () => {
  // @covers sdd-cli:INV-007
  // sdd-cli's own spec.md uses the nested YAML form (lifecycle:\n  status: …),
  // not the flat dotted form. The parser already accepts both per the project
  // README; the rewriter must too, otherwise `sdd approve` on the canonical
  // brownfield form silently no-ops (returns ok:true, files_changed:[]).
  const md = [
    "```yaml",
    "---",
    "id: demo:beh-nested",
    "type: Behavior",
    "lifecycle:",
    "  status: proposed",
    "partition_id: demo",
    "test_obligation:",
    "  predicate: x",
    "  test_template: unit",
    "---",
    "```",
  ].join("\n");
  const result = rewriteApproval(md, { ...REQ, id: "demo:beh-nested" }, FROZEN_TIME);
  assert.equal(result.matched.length, 1);
  // Status line is rewritten in-place under `lifecycle:`.
  assert.match(result.newContent, /^lifecycle:\n {2}status: approved$/m);
  // approval_record is inserted contiguously with the status flip — same
  // indent, same nested key family. Atomic per INV-007.
  assert.match(result.newContent, /^ {2}approval_record:\n {4}owner_role: tech-lead$/m);
  assert.match(result.newContent, /approver_identity: cyberash/);
});

test("rewrites nested lifecycle form already carrying approval_record placeholder", () => {
  // @covers sdd-cli:INV-007
  // Mirrors the dotted-form list-of-objects case but in nested shape.
  const md = [
    "```yaml",
    "---",
    "id: demo:beh-nested-2",
    "type: Behavior",
    "lifecycle:",
    "  status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "partition_id: demo",
    "---",
    "```",
  ].join("\n");
  const result = rewriteApproval(md, { ...REQ, id: "demo:beh-nested-2" }, FROZEN_TIME);
  assert.equal(result.matched.length, 1);
  assert.match(result.newContent, /^lifecycle:\n {2}status: approved$/m);
  // The placeholder approval_record line is replaced (not appended) so we end
  // up with exactly one approval_record block under lifecycle.
  assert.equal((result.newContent.match(/^ {2}approval_record:/gm) ?? []).length, 1);
  assert.match(result.newContent, /approver_identity: cyberash/);
});

test("inserts approval_record when no placeholder in list-of-objects record", () => {
  const md = [
    "```yaml",
    "- id: demo:beh-1",
    "  template: Behavior",
    "  lifecycle.status: proposed",
    "  test_obligations: [to:demo:beh-1:happy]",
    "```",
  ].join("\n");
  const result = rewriteApproval(md, REQ, FROZEN_TIME);
  assert.equal(result.matched.length, 1);
  assert.match(result.newContent, /lifecycle\.status: approved/);
  // List-of-objects fields live at indent "  " (two spaces past the dash).
  assert.match(result.newContent, /\n {2}approval_record:\n {4}owner_role: tech-lead/);
});

test("flips a record whose lifecycle follows a nested `- id:` list (INV-007)", () => {
  // @covers sdd-cli:INV-007
  // @covers sdd-cli:DLT-003
  // A record body may carry a nested `- id:` list (e.g. a Delta's
  // surface_impact:). The boundary scanner must treat it as body, not as a
  // new record — otherwise the record is truncated before its lifecycle
  // anchor and the status flip silently no-ops (0 files changed).
  const md = [
    "```yaml",
    "- id: demo:del-1",
    "  template: Delta",
    "  surface_impact:",
    "    - id: demo:sur-1",
    "      intended_bump: minor",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "```",
  ].join("\n");

  const result = rewriteApproval(md, { ...REQ, id: "demo:del-1" }, FROZEN_TIME);

  assert.equal(result.matched.length, 1);
  // endLine (1-based, exclusive) must span past the lifecycle line (line 7).
  assert.ok(result.matched[0]!.endLine > 7);
  assert.match(result.newContent, /lifecycle\.status: approved/);
  assert.match(result.newContent, /approver_identity: cyberash/);
});

test("flips a record whose nested `- id:` list follows lifecycle (regression guard)", () => {
  // @covers sdd-cli:INV-007
  // Mirror of the bug case but with lifecycle ahead of the nested list — the
  // accidental pre-fix workaround. Must keep flipping after the fix.
  const md = [
    "```yaml",
    "- id: demo:del-2",
    "  template: Delta",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "  surface_impact:",
    "    - id: demo:sur-1",
    "      intended_bump: minor",
    "```",
  ].join("\n");

  const result = rewriteApproval(md, { ...REQ, id: "demo:del-2" }, FROZEN_TIME);

  assert.equal(result.matched.length, 1);
  assert.match(result.newContent, /lifecycle\.status: approved/);
});

test("glob enumerates only top-level records, not nested `- id:` items (INV-007)", () => {
  // @covers sdd-cli:INV-007
  // Two top-level Policy records; the first carries a nested `- id:` in its
  // body. The glob must match exactly the two top-level ids — the nested id
  // is body, and both siblings still parse as separate records.
  const md = [
    "```yaml",
    "- id: pol:auth",
    "  template: Policy",
    "  surface_impact:",
    "    - id: pol:nested-ignored",
    "      intended_bump: minor",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "- id: pol:audit",
    "  template: Policy",
    "  lifecycle.status: proposed",
    "  approval_record: not_applicable_for_proposed",
    "```",
  ].join("\n");

  const r = rewriteApproval(md, { ...REQ, id: "pol:*" }, FROZEN_TIME);

  assert.deepEqual(r.matched.map((m) => m.id).sort(), ["pol:audit", "pol:auth"]);
  assert.equal((r.newContent.match(/lifecycle\.status: approved/g) ?? []).length, 2);
});

test("flips nested-lifecycle record whose `- id:` list precedes lifecycle (INV-007)", () => {
  // @covers sdd-cli:INV-007
  // The canonical brownfield form (--- delimited, nested lifecycle:) with a
  // surface_impact nested `- id:` list ahead of the lifecycle anchor — the
  // exact shape that landed the defect.
  const md = [
    "```yaml",
    "---",
    "id: demo:del-3",
    "type: Delta",
    "surface_impact:",
    "  - id: demo:sur-1",
    "    intended_bump: minor",
    "lifecycle:",
    "  status: proposed",
    "---",
    "```",
  ].join("\n");

  const result = rewriteApproval(md, { ...REQ, id: "demo:del-3" }, FROZEN_TIME);

  assert.equal(result.matched.length, 1);
  assert.match(result.newContent, /^lifecycle:\n {2}status: approved$/m);
  assert.match(result.newContent, /^ {2}approval_record:\n {4}owner_role: tech-lead$/m);
});
