import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRefusal,
  type ApproveRequest,
} from "../../src/features/approve/domain/ApproveRequest.js";

// @covers sdd-cli:approve-feature
//
// SDD §7.5 — self-approval ban. The agent identity blocklist is enforced
// in pure domain logic (no I/O), so the rule is testable in isolation.

function req(partial: Partial<ApproveRequest> = {}): ApproveRequest {
  return {
    id: "demo:cnt-1",
    approver: "cyberash",
    ownerRole: "tech-lead",
    changeRequest: "https://example.com/pr/1",
    scope: "first-time-approval",
    targetStatus: "approved",
    reviewedTestOracle: null,
    ...partial,
  };
}

test("rejects approver=claude", () => {
  const r = classifyRefusal(req({ approver: "claude" }), []);
  assert.equal(r?.kind, "agent-approver");
});

test("rejects approver=Claude (case-insensitive)", () => {
  const r = classifyRefusal(req({ approver: "Claude" }), []);
  assert.equal(r?.kind, "agent-approver");
});

test("rejects approver=bot:anything", () => {
  const r = classifyRefusal(req({ approver: "bot:tg-12345" }), []);
  assert.equal(r?.kind, "agent-approver");
});

test("rejects identities in custom blocklist (config-supplied)", () => {
  const r = classifyRefusal(req({ approver: "intern-bot-a" }), ["intern-bot-a"]);
  assert.equal(r?.kind, "agent-approver");
});

test("rejects unknown owner-role", () => {
  const r = classifyRefusal(req({ ownerRole: "junior-dev" }), []);
  assert.equal(r?.kind, "invalid-owner-role");
});

test("accepts a non-agent identity with valid owner-role", () => {
  const r = classifyRefusal(req(), []);
  assert.equal(r, null);
});

test("rejects approver=spec-author-bot", () => {
  const r = classifyRefusal(req({ approver: "spec-author-bot" }), []);
  assert.equal(r?.kind, "agent-approver");
});

test("rejects approver=sdd-cli (the tool itself)", () => {
  const r = classifyRefusal(req({ approver: "sdd-cli" }), []);
  assert.equal(r?.kind, "agent-approver");
});
