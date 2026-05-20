import assert from "node:assert/strict";
import test from "node:test";
import { titleOf } from "../../src/features/record/domain/RecordSummary.js";

test("titleOf: prefers the title field", () => {
  // @covers sdd-cli:BEH-054
  assert.equal(titleOf({ id: "x:A-1", title: "a title", name: "ignored" }), "a title");
});

test("titleOf: falls back to the name field", () => {
  // @covers sdd-cli:BEH-054
  assert.equal(titleOf({ id: "x:A-1", name: "x/thing" }), "x/thing");
});

test("titleOf: null when neither title nor name present", () => {
  // @covers sdd-cli:BEH-054
  assert.equal(titleOf({ id: "x:A-1", type: "Invariant" }), null);
});

test("titleOf: ignores non-string title/name", () => {
  // @covers sdd-cli:BEH-054
  assert.equal(titleOf({ id: "x:A-1", title: 42, name: ["nope"] }), null);
});
