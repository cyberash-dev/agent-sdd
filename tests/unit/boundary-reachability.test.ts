// @covers sdd-cli:BEH-034
// @covers sdd-cli:BEH-035
// @covers sdd-cli:BEH-036
// @covers sdd-cli:BEH-037
//
// Pure-logic unit tests for reachableBoundaryIds(). The integration tests
// (tests/integration/p2-boundary-requiredness.test.ts) cover the rules
// indirectly; this file pins the helper itself so a future change to the
// reachability heuristic shows up as a focused failure.

import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTERNAL_BOUNDARY_TYPES,
  reachableBoundaryIds,
} from "../../src/shared/domain/BoundaryReachability.js";
import type { LintRecord } from "../../src/shared/domain/SpecRecord.js";

function rec(id: string, template: string, parsed: Record<string, unknown>): LintRecord {
  return {
    id,
    template,
    lifecycleStatus: "approved",
    approvalRecord: "human",
    testObligations: [],
    hasAliasedObligations: false,
    parsed,
    file: "spec.md",
    line: 1,
    rawBlock: "",
  };
}

test("EXTERNAL_BOUNDARY_TYPES contains exactly the six published-boundary kinds", () => {
  const expected = new Set(["api", "sdk", "event_bus", "cli", "public_db", "public_storage"]);
  assert.deepEqual(new Set([...EXTERNAL_BOUNDARY_TYPES]), expected);
});

test("Contract with surface_ref to an external Surface is in the boundary set", () => {
  const records = [
    rec("p:SUR-1", "Surface", { boundary_type: "cli", members: ["p:CTR-1"] }),
    rec("p:CTR-1", "Contract", { surface_ref: "p:SUR-1" }),
  ];
  const out = reachableBoundaryIds(records);
  assert.equal(out.has("p:CTR-1"), true);
});

test("Contract with surface_ref to a non-external Surface is NOT in the boundary set", () => {
  // generated_published_artifact is in VALID_BOUNDARY but NOT in EXTERNAL_BOUNDARY_TYPES
  const records = [
    rec("p:SUR-1", "Surface", { boundary_type: "generated_published_artifact", members: ["p:CTR-1"] }),
    rec("p:CTR-1", "Contract", { surface_ref: "p:SUR-1" }),
  ];
  const out = reachableBoundaryIds(records);
  assert.equal(out.has("p:CTR-1"), false);
});

test("members[] reverse edge: every member of an external Surface is in the boundary set", () => {
  const records = [
    rec("p:SUR-1", "Surface", { boundary_type: "api", members: ["p:CTR-1", "p:BEH-1"] }),
    rec("p:CTR-1", "Contract", {}),     // no surface_ref but listed as member
    rec("p:BEH-1", "Behavior", {}),     // no surface_ref but listed as member
    rec("p:CTR-2", "Contract", {}),     // not listed anywhere
  ];
  const out = reachableBoundaryIds(records);
  assert.equal(out.has("p:CTR-1"), true);
  assert.equal(out.has("p:BEH-1"), true);
  assert.equal(out.has("p:CTR-2"), false);
});

test("Behavior with surface_ref to an external Surface is in the boundary set", () => {
  const records = [
    rec("p:SUR-1", "Surface", { boundary_type: "event_bus", members: [] }),
    rec("p:BEH-1", "Behavior", { surface_ref: "p:SUR-1" }),
  ];
  const out = reachableBoundaryIds(records);
  assert.equal(out.has("p:BEH-1"), true);
});

test("Surfaces themselves are NOT in the boundary set (only their members)", () => {
  const records = [
    rec("p:SUR-1", "Surface", { boundary_type: "cli", members: ["p:CTR-1"] }),
    rec("p:CTR-1", "Contract", {}),
  ];
  const out = reachableBoundaryIds(records);
  assert.equal(out.has("p:SUR-1"), false);
  assert.equal(out.has("p:CTR-1"), true);
});

test("Records reachable from multiple external Surfaces are deduped", () => {
  const records = [
    rec("p:SUR-1", "Surface", { boundary_type: "api", members: ["p:CTR-shared"] }),
    rec("p:SUR-2", "Surface", { boundary_type: "cli", members: ["p:CTR-shared"] }),
    rec("p:CTR-shared", "Contract", {}),
  ];
  const out = reachableBoundaryIds(records);
  assert.equal(out.has("p:CTR-shared"), true);
  assert.equal(out.size, 1);
});

test("non-array members[] is silently ignored (no crash)", () => {
  const records = [
    rec("p:SUR-1", "Surface", { boundary_type: "cli", members: "not-an-array" }),
  ];
  const out = reachableBoundaryIds(records);
  assert.equal(out.size, 0);
});

test("Surface with no boundary_type is NOT external", () => {
  const records = [
    rec("p:SUR-1", "Surface", { members: ["p:CTR-1"] }),
    rec("p:CTR-1", "Contract", { surface_ref: "p:SUR-1" }),
  ];
  const out = reachableBoundaryIds(records);
  assert.equal(out.has("p:CTR-1"), false);
});

test("empty records list yields empty set", () => {
  assert.deepEqual([...reachableBoundaryIds([])], []);
});
