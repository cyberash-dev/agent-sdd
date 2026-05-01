// @covers sdd-cli:BEH-041
// @covers sdd-cli:BEH-044
// @covers sdd-cli:BEH-045
// @covers sdd-cli:BEH-046
// @covers sdd-cli:BEH-047
// @covers sdd-cli:BEH-048
// @covers sdd-cli:CTR-023
// @covers sdd-cli:CTR-024
//
// `sdd report --pr-summary` emits a 5-section markdown block. Verify the
// section order and the placeholder vs. populated rendering.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSdd } from "./_helpers.js";

const PARTITION_SHELL = [
  "# fixture", "", "## 1. Context", "", "## 2. Glossary", "", "## 3. Partition", "",
  "## 4. Brownfield baseline", "", "## 5. Surfaces", "", "## 6. Requirements", "",
  "## 7. Data contracts", "", "## 8. Invariants", "", "## 9. External dependencies", "",
  "## 10. Generated artifacts", "", "## 11. Localization", "", "## 12. Policies", "",
  "## 13. Constraints", "", "## 14. Migrations", "", "## 15. Deltas", "",
  "## 16. Implementation bindings", "", "## 17. Open questions", "",
  "## 18. Assumptions", "", "## 19. Out of scope", "",
].join("\n");

const CONFIG = {
  spec_file: "spec/spec.md",
  baseline_id: "fixture:BL-001",
  discovery_scope: ["src"],
  mechanism: "git_tree_hash_v1",
};

async function fixtureProject(specBody: string): Promise<{ root: string }> {
  const root = await mkdtemp(join(tmpdir(), "sdd-rep-"));
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify(CONFIG, null, 2));
  await writeFile(join(root, "spec", "spec.md"), `${PARTITION_SHELL}\n${specBody}\n`);
  return { root };
}

const REQUIRED_SECTIONS_IN_ORDER: ReadonlyArray<string> = [
  "## SDD PR Report",
  "### Closed Test obligations",
  "### Internal decisions (candidates for new Constraint/Policy/ASSUMPTION)",
  "### ASSUMPTIONs",
  "### Open-Q residuals",
  "### Debt budget delta",
];

function assertSectionsInOrder(markdown: string): void {
  let cursor = 0;
  for (const heading of REQUIRED_SECTIONS_IN_ORDER) {
    const idx = markdown.indexOf(heading, cursor);
    assert.ok(idx !== -1, `missing section heading "${heading}" in:\n${markdown}`);
    cursor = idx + heading.length;
  }
}

test("report --pr-summary on an empty fixture emits all 5 sections in order with placeholder text", async () => {
  const { root } = await fixtureProject("");

  const r = await runSdd(root, ["report", "--pr-summary"]);
  assert.equal(r.code, 0, `stderr=${r.stderr}`);
  assertSectionsInOrder(r.stdout);
  // Empty placeholders are present.
  assert.match(r.stdout, /_No records with `test_obligation` in scope\._/);
  assert.match(r.stdout, /_No ASSUMPTION records in scope\._/);
  assert.match(r.stdout, /_No open Open-Q records in scope\._/);
  assert.match(r.stdout, /_No Partition records in scope/);
});

test("report --pr-summary surfaces ASSUMPTIONs, Open-Q residuals, and Partition.unmodeled_budget", async () => {
  const block = [
    "```yaml",
    "---",
    "id: fixture:ASM-1",
    "type: ASSUMPTION",
    "lifecycle:",
    "  status: proposed",
    "partition_id: fixture",
    "title: a non-blocking assumption",
    "blocking: no",
    'review_by: "2026-08-01"',
    "test_obligation:",
    "  predicate: |",
    "    Trigger fixture.",
    "  test_template: integration",
    "---",
    "```",
    "",
    "```yaml",
    "---",
    "id: fixture:OQ-1",
    "type: Open-Q",
    "lifecycle:",
    "  status: proposed",
    "partition_id: fixture",
    "question: |",
    "  Some open question.",
    "options:",
    "  - id: a",
    "    label: option_a",
    "    consequence: |",
    "      First option.",
    "blocking: no",
    "owner: cyberash",
    "default_if_unresolved: a",
    "---",
    "```",
    "",
    "```yaml",
    "---",
    "id: fixture:PRT-1",
    "type: Partition",
    "lifecycle:",
    "  status: proposed",
    "partition_id: fixture",
    "title: example partition",
    "default_policy_set: []",
    "unmodeled_budget:",
    "  current: 12",
    '  baseline_at: "2026-04-01"',
    "  baseline_value: 20",
    "  trend: monotonic_non_increasing",
    "test_obligation:",
    "  predicate: |",
    "    Trigger fixture.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");
  const { root } = await fixtureProject(block);

  const r = await runSdd(root, ["report", "--pr-summary"]);
  assert.equal(r.code, 0);
  assertSectionsInOrder(r.stdout);
  assert.match(r.stdout, /\[fixture:ASM-1\] blocking=no, review_by=2026-08-01/);
  assert.match(r.stdout, /\[fixture:OQ-1\] blocking=no/);
  assert.match(r.stdout, /\[fixture:PRT-1\] current=12/);
  assert.match(r.stdout, /trend=monotonic_non_increasing/);
});

test("report without --pr-summary exits 2", async () => {
  const { root } = await fixtureProject("");

  const r = await runSdd(root, ["report"]);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /report requires --pr-summary/);
});

test("report --pr-summary --format=json wraps the markdown in a JSON envelope", async () => {
  const { root } = await fixtureProject("");

  const r = await runSdd(root, ["report", "--pr-summary", "--format=json"]);
  assert.equal(r.code, 0);
  const body = JSON.parse(r.stdout) as { ok: boolean; markdown: string };
  assert.equal(body.ok, true);
  assertSectionsInOrder(body.markdown);
});
