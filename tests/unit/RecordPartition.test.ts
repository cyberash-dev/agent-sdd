import assert from "node:assert/strict";
import test from "node:test";
import { partitionOf } from "../../src/features/record/domain/RecordPartition.js";

test("partitionOf: normative id drops the trailing ID tail", () => {
  // @covers sdd-cli:BEH-058
  assert.equal(partitionOf("sdd-cli:BEH-001"), "sdd-cli");
});

test("partitionOf: bare partition-name id returns itself", () => {
  // @covers sdd-cli:BEH-058
  assert.equal(partitionOf("sdd-cli"), "sdd-cli");
});

test("partitionOf: multi-segment partition keeps all but the ID tail", () => {
  // @covers sdd-cli:BEH-058
  assert.equal(partitionOf("bridge:commands:CON-004"), "bridge:commands");
});
