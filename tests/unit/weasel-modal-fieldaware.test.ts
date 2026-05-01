// Field-aware modal weasel detection (P0.5):
//   - "may be" in a non-normative field (notes, title, test_obligation.predicate)
//     does NOT trigger sdd:weasel-word.
//   - "may be" in a normative field (Behavior.then, Invariant.always, etc.)
//     DOES trigger sdd:weasel-word with a field-naming message.
//   - Section-aware "absolute" weasels (etc., approximately) keep the
//     pre-P0.5 behavior unchanged.

import assert from "node:assert/strict";
import test from "node:test";

import { weaselFindings } from "../../src/shared/domain/LintRules.js";
import { lintRecordsFromMarkdown } from "../../src/shared/domain/SpecRecord.js";

const HEADER = `# Spec\n\n## 1. Context\n\nUsers may be confused.\n\n## 6. Requirements\n\n`;

function build(records: string): string {
  return HEADER + records;
}

test("modal verb in non-normative field (Behavior.notes) does not trigger", () => {
  const md = build(
    "```yaml\n---\nid: t:BEH-001\ntype: Behavior\nlifecycle:\n  status: proposed\npartition_id: t\ntitle: do thing\nwhen: button click\nthen: server returns 200\nnotes: |\n  the user may be redirected to the home page\n---\n```\n",
  );
  const records = lintRecordsFromMarkdown("t.md", md);
  const findings = weaselFindings(md, records);
  // Header has "may be" in Section 1 (Context), not normative — no Pass 1 hit.
  // notes is non-normative — no Pass 2 hit.
  assert.equal(findings.filter((f) => f.word === "may be").length, 0);
});

test("modal verb in normative field (Behavior.then) does trigger", () => {
  const md = build(
    "```yaml\n---\nid: t:BEH-002\ntype: Behavior\nlifecycle:\n  status: proposed\npartition_id: t\ntitle: do thing\nwhen: button click\nthen: |\n  client may be retried after timeout\n---\n```\n",
  );
  const records = lintRecordsFromMarkdown("t.md", md);
  const findings = weaselFindings(md, records);
  const modal = findings.find((f) => f.word === "may be");
  assert.ok(modal !== undefined, "expected one modal finding in Behavior.then");
  assert.equal(modal.field, "Behavior.then");
});

test("modal verb in test_obligation (non-normative for Behavior) does not trigger", () => {
  const md = build(
    "```yaml\n---\nid: t:BEH-003\ntype: Behavior\nlifecycle:\n  status: proposed\npartition_id: t\ntitle: do thing\nwhen: button click\nthen: server returns 200\ntest_obligation:\n  predicate: |\n    the test may be parameterised over inputs\n  test_template: unit\n---\n```\n",
  );
  const records = lintRecordsFromMarkdown("t.md", md);
  const findings = weaselFindings(md, records);
  assert.equal(findings.filter((f) => f.word === "may be").length, 0);
});

test("modal verb in Invariant.always does trigger", () => {
  const md = build(
    "```yaml\n---\nid: t:INV-001\ntype: Invariant\nlifecycle:\n  status: proposed\npartition_id: t\ntitle: thing always\nalways: |\n  the gateway may be reached over HTTPS\nevidence: public_api\nstability: contractual\n---\n```\n",
  );
  const records = lintRecordsFromMarkdown("t.md", md);
  const findings = weaselFindings(md, records);
  const modal = findings.find((f) => f.word === "may be");
  assert.ok(modal !== undefined);
  assert.equal(modal.field, "Invariant.always");
});

test("absolute weasel (etc.) still triggers section-aware in Pass 1", () => {
  const md = build(
    "Some prose containing etc. before any record.\n\n```yaml\n---\nid: t:BEH-004\ntype: Behavior\nlifecycle:\n  status: proposed\npartition_id: t\ntitle: do thing\nwhen: x\nthen: y\n---\n```\n",
  );
  const records = lintRecordsFromMarkdown("t.md", md);
  const findings = weaselFindings(md, records);
  const absolute = findings.find((f) => f.word === "etc.");
  assert.ok(absolute !== undefined);
  assert.equal(absolute.field, undefined, "absolute findings carry no field");
});

test("legacy single-arg call form still works (records absent => Pass 2 skipped)", () => {
  const md = build(
    "```yaml\n---\nid: t:BEH-005\ntype: Behavior\nlifecycle:\n  status: proposed\npartition_id: t\ntitle: legacy\nwhen: x\nthen: |\n  client may be retried\n---\n```\n",
  );
  const findings = weaselFindings(md);
  // No records => Pass 2 skipped => modal not flagged.
  assert.equal(findings.filter((f) => f.word === "may be").length, 0);
});
