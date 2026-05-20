// @covers sdd-cli:BEH-026
// @covers sdd-cli:BEH-027
//
// Unit coverage for the enforcement-registry parser: the 10-column methodology
// table, the `## Compatibility metadata` table, escaped-pipe multi-value
// diagnostic_id cells (ENF-008), and the em-dash "no diagnostic" sentinel.

import assert from "node:assert/strict";
import test from "node:test";

import { parseRegistry } from "../../src/features/doctor/domain/RegistryRow.js";

const HEADER =
  "| id | parent_id | requirement | enforcement_class | executor | gate | diagnostic_id | maturity | process_owner | review_trigger |";
const SEP =
  "|----|-----------|-------------|-------------------|----------|------|---------------|----------|---------------|----------------|";

function doc(rows: string[]): string {
  return [
    "# Enforcement Registry",
    "",
    "## Compatibility metadata",
    "",
    "| Field | Value |",
    "|---|---|",
    "| sdd_methodology_version | 1.0.0 |",
    "| compatible_sdd_cli | >=1.0 <2.0 |",
    "",
    "## Registry",
    "",
    HEADER,
    SEP,
    ...rows,
    "",
  ].join("\n");
}

test("reads compatible_sdd_cli from the ## Compatibility metadata table", () => {
  const out = parseRegistry(doc(["| ENF-001 | — | weasel words | structural-lint | sdd lint | spec-valid | sdd:weasel-word | implemented | — | — |"]));
  assert.ok(out.ok, JSON.stringify(out));
  assert.equal(out.doc.compatibleSddCli, ">=1.0 <2.0");
});

test("parses a 10-column row, mapping id→enfId and requirement→ruleName", () => {
  const out = parseRegistry(doc(["| ENF-001 | — | weasel words | structural-lint | sdd lint | spec-valid | sdd:weasel-word | implemented | — | — |"]));
  assert.ok(out.ok);
  assert.equal(out.doc.rows.length, 1);
  const row = out.doc.rows[0]!;
  assert.equal(row.enfId, "ENF-001");
  assert.equal(row.ruleName, "weasel words");
  assert.equal(row.maturity, "implemented");
  assert.deepEqual(row.diagnosticIds, ["sdd:weasel-word"]);
});

test("splits an escaped-pipe multi-value diagnostic_id cell into multiple ids", () => {
  const out = parseRegistry(doc([
    "| ENF-008 | — | drift kinds | graph-consistency | sdd doctor | — | version_mismatch \\| missing_diagnostic \\| stale_diagnostic | implemented | — | release cut |",
  ]));
  assert.ok(out.ok);
  assert.deepEqual(out.doc.rows[0]!.diagnosticIds, [
    "version_mismatch",
    "missing_diagnostic",
    "stale_diagnostic",
  ]);
});

test("treats an em-dash diagnostic_id cell as no diagnostic id", () => {
  const out = parseRegistry(doc(["| ENF-007A | ENF-007 | report obligations | report-evidence | sdd report | implementation-valid | — | implemented | PR author | PR merge |"]));
  assert.ok(out.ok);
  assert.deepEqual(out.doc.rows[0]!.diagnosticIds, []);
});

test("returns a parse error when compatible_sdd_cli is absent", () => {
  const md = ["## Registry", "", HEADER, SEP, "| ENF-001 | — | x | structural-lint | sdd lint | spec-valid | sdd:weasel-word | implemented | — | — |"].join("\n");
  const out = parseRegistry(md);
  assert.equal(out.ok, false);
});

test("treats an `implemented:hybrid` maturity suffix as implemented", () => {
  const out = parseRegistry(doc(["| ENF-020B | ENF-020 | debt monotonicity | aggregate-gate | sdd ready | implementation-valid | debt_budget_increased | implemented:hybrid | partition owner | sprint close |"]));
  assert.ok(out.ok);
  assert.equal(out.doc.rows.length, 1);
  assert.equal(out.doc.rows[0]!.maturity, "implemented");
  assert.deepEqual(out.doc.rows[0]!.diagnosticIds, ["debt_budget_increased"]);
});

test("ignores rows whose maturity is not a known value", () => {
  const out = parseRegistry(doc([
    "| ENF-001 | — | x | structural-lint | sdd lint | spec-valid | sdd:weasel-word | implemented | — | — |",
    "| ENF-XXX | — | y | structural-lint | sdd lint | spec-valid | sdd:bogus | nonsense | — | — |",
  ]));
  assert.ok(out.ok);
  assert.equal(out.doc.rows.length, 1);
  assert.equal(out.doc.rows[0]!.enfId, "ENF-001");
});
