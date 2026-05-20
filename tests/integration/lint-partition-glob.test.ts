// @covers sdd-cli:BEH-052
//
// OQ-011 (option b) — sdd lint selects partition-spec files for the §2
// section-structure check via lint.partition_glob; absent glob falls back to
// heading-based detection ("## 1. Context").

import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSdd } from "./_helpers.js";

// A spec file that opens with "## 1. Context" but omits the remaining §2
// sections — triggers section-presence only when the §2 check applies to it.
const PARTITION_SHAPED = ["# x", "", "## 1. Context", ""].join("\n");

interface LintBody {
  diagnostics: Array<{ rule: string; file: string }>;
}

async function fixture(lintBlock: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sdd-pglob-"));
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify({
    spec_file: "spec/partition.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    lint: { spec_files: ["spec/*.md"], ...lintBlock },
  }, null, 2));
  await writeFile(join(root, "spec", "partition.md"), `${PARTITION_SHAPED}\n`);
  await writeFile(join(root, "spec", "other.md"), `${PARTITION_SHAPED}\n`);
  return root;
}

async function sectionDiagnosticsByFile(root: string): Promise<Map<string, number>> {
  const r = await runSdd(root, ["lint", "--format=json"]);
  const body = JSON.parse(r.stdout) as LintBody;
  const counts = new Map<string, number>();
  for (const d of body.diagnostics) {
    if (d.rule !== "sdd:section-presence" && d.rule !== "sdd:section-order") continue;
    const key = d.file.replace(/^.*\/spec\//, "spec/");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

test("BEH-052: partition_glob restricts the §2 check to matching files", async () => {
  const root = await fixture({ partition_glob: ["spec/partition.md"] });

  const counts = await sectionDiagnosticsByFile(root);
  assert.ok((counts.get("spec/partition.md") ?? 0) > 0, "matching file should get the §2 check");
  assert.equal(counts.get("spec/other.md") ?? 0, 0, "non-matching file must be exempt even with a ## 1. Context heading");
});

test("BEH-052: absent partition_glob falls back to heading-based detection", async () => {
  const root = await fixture({});

  const counts = await sectionDiagnosticsByFile(root);
  assert.ok((counts.get("spec/other.md") ?? 0) > 0, "heading-shaped file should get the §2 check under the fallback");
});
