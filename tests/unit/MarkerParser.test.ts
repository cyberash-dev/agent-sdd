import assert from "node:assert/strict";
import test from "node:test";
import { ALLOWED_MARKER_KEYS, parseMarkers } from "../../src/features/ready/domain/MarkerParser.js";

test("parseMarkers detects a happy-path single marker", () => {
  // @covers sdd-cli:CST-007
  const text = "// @cov" + "ers fixture:BEH-001\n";
  const out = parseMarkers(text, "tests/foo.test.ts");

  assert.equal(out.length, 1);
  assert.equal(out[0]!.partition, "fixture");
  assert.equal(out[0]!.id, "BEH-001");
  assert.equal(out[0]!.line, 1);
  assert.deepEqual(out[0]!.tail, {});
});

test("parseMarkers populates 1-based line numbers across newlines", () => {
  // @covers sdd-cli:CST-007
  const text = "line one\nline two\n// @cov" + "ers fixture:BEH-002\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 1);
  assert.equal(out[0]!.line, 3);
});

test("parseMarkers detects multiple markers per line", () => {
  // @covers sdd-cli:CST-007
  const text = "@cov" + "ers a:BEH-001 @cov" + "ers b:BEH-002\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 2);
  assert.equal(out[0]!.partition, "a");
  assert.equal(out[1]!.partition, "b");
});

test("parseMarkers tail captures the whitelisted compatibility_action key", () => {
  // @covers sdd-cli:CST-007
  const text = "@cov" + "ers fixture:BEH-001 compatibility_action=reject\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 1);
  assert.equal(out[0]!.tail.compatibility_action, "reject");
});

test("parseMarkers silently drops keys outside the v0.3.0 whitelist (forward-compat)", () => {
  // @covers sdd-cli:CST-007
  // @covers sdd-cli:OQ-016
  const text = "@cov" + "ers fixture:BEH-001 compatibility_action=reject oracle=strict\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 1);
  assert.equal(out[0]!.tail.compatibility_action, "reject");
  assert.equal(out[0]!.tail.oracle, undefined);
});

test("parseMarkers handles three key=value pairs on one line (regex foot-gun probe)", () => {
  // @covers sdd-cli:CST-007
  // CST-007 mandates the two-stage parse to avoid the JS/TS regex foot-gun
  // where a single capture-group with `*` keeps only the last match. We only
  // whitelist `compatibility_action`; this test ensures the OTHER two unknown
  // keys do not corrupt the parsed marker.
  const text = "@cov" + "ers fixture:BEH-001 compatibility_action=reject foo=bar baz=qux\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 1);
  assert.equal(out[0]!.tail.compatibility_action, "reject");
});

test("parseMarkers rejects partition/ID outside the documented charset", () => {
  // @covers sdd-cli:CST-007
  // Partition must start with [a-z]; ID neutral part must be uppercase
  // letters; suffix must be digits.
  const text = "@covers UPPER:BEH-001\n@covers fixture:lower-1\n@covers fixture:BEH-abc\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 0);
});

test("parseMarkers exposes the v0.3.0 whitelist set", () => {
  // @covers sdd-cli:CST-007
  assert.deepEqual([...ALLOWED_MARKER_KEYS], ["compatibility_action"]);
});

test("parseMarkers detects a single-segment marker (legacy regression)", () => {
  // @covers sdd-cli:CST-007
  // Strict v0.2.0 form must keep parsing byte-for-bit identical to the
  // pre-widening grammar.
  const text = "@cov" + "ers sdd-cli:BEH-006\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 1);
  assert.equal(out[0]!.partition, "sdd-cli");
  assert.equal(out[0]!.id, "BEH-006");
});

test("parseMarkers detects a two-segment partition prefix", () => {
  // @covers sdd-cli:CST-007
  const text = "@cov" + "ers bridge:commands:CON-004\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 1);
  assert.equal(out[0]!.partition, "bridge:commands");
  assert.equal(out[0]!.id, "CON-004");
});

test("parseMarkers detects a three-segment partition prefix (forward-compat)", () => {
  // @covers sdd-cli:CST-007
  const text = "@cov" + "ers acme:bridge:auth:BEH-001\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 1);
  assert.equal(out[0]!.partition, "acme:bridge:auth");
  assert.equal(out[0]!.id, "BEH-001");
});

test("parseMarkers detects multiple multi-segment markers on one line", () => {
  // @covers sdd-cli:CST-007
  const text = "// @cov" + "ers bridge:lock:INV-001 @cov" + "ers bridge:lock:INV-002\n";
  const out = parseMarkers(text, "f.ts");

  assert.equal(out.length, 2);
  assert.equal(out[0]!.partition, "bridge:lock");
  assert.equal(out[0]!.id, "INV-001");
  assert.equal(out[1]!.partition, "bridge:lock");
  assert.equal(out[1]!.id, "INV-002");
});

test("parseMarkers silently skips a near-miss with uppercase in partition prefix (OQ-017 default a)", () => {
  // @covers sdd-cli:CST-007
  // @covers sdd-cli:OQ-017
  // The grammar requires `@covers\s+` immediately followed by a charset-valid
  // <partition>:<id>. Uppercase in any partition segment fails the match for
  // that single `@covers` anchor; without a second `@covers` token the engine
  // produces zero markers (silent skip). Asserting this explicitly so a future
  // grammar change cannot drift the OQ-017 default-a behaviour silently.
  const out1 = parseMarkers("@covers bridge:Commands:CON-004\n", "f.ts");
  assert.equal(out1.length, 0);

  // A subsequent valid `@covers` on the same line still parses — the near-miss
  // does not poison the rest of the line.
  const out2 = parseMarkers(
    "@cov" + "ers bridge:Commands:CON-004 @cov" + "ers ok:BEH-001\n",
    "f.ts",
  );
  assert.equal(out2.length, 1);
  assert.equal(out2[0]!.partition, "ok");
  assert.equal(out2[0]!.id, "BEH-001");
});
