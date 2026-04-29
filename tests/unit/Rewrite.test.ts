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
  const md = [
    "```yaml",
    "---",
    "id: demo:beh-1",
    "type: Behavior",
    "lifecycle:",
    "  status: proposed",
    "test_obligations:",
    "  - to:demo:beh-1:happy",
    "approval_record: not_applicable_for_proposed",
    "---",
    "```",
  ].join("\n");
  const result = rewriteApproval(md, REQ, FROZEN_TIME);
  assert.equal(result.matched.length, 1);
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
