// P2.3 — SpecDiff classifier unit tests. Exercises the pure logic of
// classifyDiff + requiredSurfaceBumps + semver helpers without touching git.
//
// @covers sdd-cli:BEH-040

import assert from "node:assert/strict";
import test from "node:test";

import {
  actualBump,
  bumpAtLeast,
  classifyDiff,
  requiredSurfaceBumps,
} from "../../src/features/ready/domain/SpecDiff.js";
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

test("classifyDiff: identical record yields none", () => {
  const r = rec("p:CTR-1", "Contract", { schema: { foo: "bar" } });
  const out = classifyDiff([r], [r]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.classification, "none");
});

test("classifyDiff: changed schema is predicate_change", () => {
  const prev = rec("p:CTR-1", "Contract", { schema: { foo: "bar" } });
  const curr = rec("p:CTR-1", "Contract", { schema: { foo: "baz" } });
  const out = classifyDiff([prev], [curr]);
  assert.equal(out[0]!.classification, "predicate_change");
  assert.deepEqual(out[0]!.changedFields, ["schema"]);
});

test("classifyDiff: changed notes is content_change", () => {
  const prev = rec("p:CTR-1", "Contract", { schema: { x: 1 }, notes: "v1" });
  const curr = rec("p:CTR-1", "Contract", { schema: { x: 1 }, notes: "v2" });
  const out = classifyDiff([prev], [curr]);
  assert.equal(out[0]!.classification, "content_change");
});

test("classifyDiff: ID new in curr is content_change", () => {
  const curr = rec("p:CTR-2", "Contract", { schema: {} });
  const out = classifyDiff([], [curr]);
  assert.equal(out[0]!.classification, "content_change");
  assert.deepEqual(out[0]!.changedFields, ["__new__"]);
});

test("classifyDiff: appending to schema.members is content_change (CTR-016 append-only)", () => {
  const prev = rec("p:CTR-16", "Contract", { schema: { members: { lint: ["sdd:a"], ready: ["x"] } } });
  const curr = rec("p:CTR-16", "Contract", { schema: { members: { lint: ["sdd:a"], ready: ["x", "y"] } } });
  const out = classifyDiff([prev], [curr]);
  assert.equal(out[0]!.classification, "content_change");
});

test("classifyDiff: removing a schema.members entry stays predicate_change", () => {
  const prev = rec("p:CTR-16", "Contract", { schema: { members: { ready: ["x", "y"] } } });
  const curr = rec("p:CTR-16", "Contract", { schema: { members: { ready: ["x"] } } });
  const out = classifyDiff([prev], [curr]);
  assert.equal(out[0]!.classification, "predicate_change");
});

test("classifyDiff: member append plus another schema field change stays predicate_change", () => {
  const prev = rec("p:CTR-16", "Contract", { schema: { grammar: "^a$", members: { ready: ["x"] } } });
  const curr = rec("p:CTR-16", "Contract", { schema: { grammar: "^b$", members: { ready: ["x", "y"] } } });
  const out = classifyDiff([prev], [curr]);
  assert.equal(out[0]!.classification, "predicate_change");
});

test("classifyDiff: changing always (Invariant predicate) is predicate_change", () => {
  const prev = rec("p:INV-1", "Invariant", { always: "X" });
  const curr = rec("p:INV-1", "Invariant", { always: "Y" });
  const out = classifyDiff([prev], [curr]);
  assert.equal(out[0]!.classification, "predicate_change");
});

test("classifyDiff: lifecycle and approval_record changes ignored", () => {
  const prev = rec("p:CTR-1", "Contract", { schema: { x: 1 }, lifecycle: { status: "proposed" } });
  const curr = rec("p:CTR-1", "Contract", {
    schema: { x: 1 },
    lifecycle: { status: "approved", approval_record: { approver: "alice" } },
  });
  const out = classifyDiff([prev], [curr]);
  assert.equal(out[0]!.classification, "none");
});

test("requiredSurfaceBumps: predicate_change in member cascades to major", () => {
  const prev = [
    rec("p:SUR-1", "Surface", { version: "0.1.0", members: ["p:CTR-1"], boundary_type: "cli" }),
    rec("p:CTR-1", "Contract", { schema: { foo: "bar" } }),
  ];
  const curr = [
    rec("p:SUR-1", "Surface", { version: "0.1.1", members: ["p:CTR-1"], boundary_type: "cli" }),
    rec("p:CTR-1", "Contract", { schema: { foo: "baz" } }),
  ];
  const diffs = classifyDiff(prev, curr);
  const bumps = requiredSurfaceBumps(prev, curr, diffs);
  assert.equal(bumps.length, 1);
  assert.equal(bumps[0]!.required, "major");
  assert.equal(bumps[0]!.declaredVersion, "0.1.1");
  assert.equal(bumps[0]!.prevDeclaredVersion, "0.1.0");
});

test("requiredSurfaceBumps: content_change in member cascades to minor", () => {
  const prev = [
    rec("p:SUR-1", "Surface", { version: "0.1.0", members: ["p:CTR-1"] }),
    rec("p:CTR-1", "Contract", { notes: "v1" }),
  ];
  const curr = [
    rec("p:SUR-1", "Surface", { version: "0.1.1", members: ["p:CTR-1"] }),
    rec("p:CTR-1", "Contract", { notes: "v2" }),
  ];
  const bumps = requiredSurfaceBumps(prev, curr, classifyDiff(prev, curr));
  assert.equal(bumps[0]!.required, "minor");
});

test("requiredSurfaceBumps: no change cascades to patch", () => {
  const prev = [
    rec("p:SUR-1", "Surface", { version: "0.1.0", members: ["p:CTR-1"] }),
    rec("p:CTR-1", "Contract", { schema: { x: 1 } }),
  ];
  const curr = [
    rec("p:SUR-1", "Surface", { version: "0.1.0", members: ["p:CTR-1"] }),
    rec("p:CTR-1", "Contract", { schema: { x: 1 } }),
  ];
  const bumps = requiredSurfaceBumps(prev, curr, classifyDiff(prev, curr));
  assert.equal(bumps[0]!.required, "patch");
});

test("actualBump + bumpAtLeast: 0.1.0 → 1.0.0 is major", () => {
  assert.equal(actualBump("0.1.0", "1.0.0"), "major");
  assert.equal(bumpAtLeast("major", "minor"), true);
  assert.equal(bumpAtLeast("minor", "major"), false);
});

test("actualBump: 0.1.0 → 0.1.1 is patch", () => {
  assert.equal(actualBump("0.1.0", "0.1.1"), "patch");
  assert.equal(bumpAtLeast("patch", "minor"), false);
});
