// @covers sdd-cli:BEH-026
// @covers sdd-cli:BEH-027
// @covers sdd-cli:BEH-028
// @covers sdd-cli:CTR-021
// @covers sdd-cli:CTR-022
// @covers sdd-cli:INV-013
//
// `sdd doctor --rule-version --rules <path>` parses an enforcement registry
// markdown file and reports drift between the methodology's declared
// compatible CLI version range and the running CLI, plus drift between the
// methodology-declared diagnostic-IDs (maturity=implemented) and the local
// DiagnosticRegistry. Read-only on the working tree.

import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSdd } from "./_helpers.js";

import {
  LINT_DIAGNOSTIC_IDS,
  READY_VIOLATION_KINDS,
} from "../../src/shared/domain/DiagnosticRegistry.js";

interface RegistryRow {
  enfId: string;
  ruleName: string;
  maturity: "planned" | "implemented" | "deprecated" | "out_of_scope";
  diagnosticId: string | null;
}

function buildRegistry(opts: { compatRange: string; rows: RegistryRow[] }): string {
  const lines: string[] = [];
  lines.push("# Enforcement Registry");
  lines.push("");
  lines.push("## Compatibility");
  lines.push("");
  lines.push(`compatible_sdd_cli: "${opts.compatRange}"`);
  lines.push("");
  lines.push("## Registry");
  lines.push("");
  lines.push("| enf_id | rule_id | maturity | diagnostic_id |");
  lines.push("|--------|---------|----------|---------------|");
  for (const r of opts.rows) {
    lines.push(`| ${r.enfId} | ${r.ruleName} | ${r.maturity} | ${r.diagnosticId ?? "—"} |`);
  }
  return lines.join("\n") + "\n";
}

function fullCoverageRows(): RegistryRow[] {
  const rows: RegistryRow[] = [];
  let i = 1;
  for (const id of LINT_DIAGNOSTIC_IDS) {
    rows.push({
      enfId: `ENF-${String(i++).padStart(3, "0")}`,
      ruleName: id.replace(/^sdd:/, ""),
      maturity: "implemented",
      diagnosticId: id,
    });
  }
  for (const id of READY_VIOLATION_KINDS) {
    rows.push({
      enfId: `ENF-${String(i++).padStart(3, "0")}`,
      ruleName: id,
      maturity: "implemented",
      diagnosticId: id,
    });
  }
  return rows;
}

async function fixtureRegistry(content: string): Promise<{ registryPath: string; cwd: string }> {
  const cwd = await mkdtemp(join(tmpdir(), "sdd-doctor-"));
  const registryPath = join(cwd, "fixture-registry.md");
  await writeFile(registryPath, content);
  return { registryPath, cwd };
}

test("doctor exits 0 with empty drift when registry covers every diagnostic and CLI version is in range", async () => {
  // Use a generous compat range so we don't have to track sdd-cli's actual
  // version in the test.
  const { registryPath, cwd } = await fixtureRegistry(buildRegistry({
    compatRange: ">=0.1 <2.0",
    rows: fullCoverageRows(),
  }));

  const result = await runSdd(cwd, ["doctor", "--rule-version", "--rules", registryPath, "--format=json"]);
  assert.equal(result.code, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    rule_version: string;
    cli_version: string;
    compatible_range: string;
    drift: unknown[];
  };
  assert.equal(body.ok, true);
  assert.equal(body.compatible_range, ">=0.1 <2.0");
  assert.deepEqual(body.drift, []);
  assert.match(body.cli_version, /^\d+\.\d+\.\d+/);
});

test("doctor reports version_mismatch when CLI is outside compatible range (BEH-027)", async () => {
  const { registryPath, cwd } = await fixtureRegistry(buildRegistry({
    compatRange: ">=99.0 <100.0",
    rows: fullCoverageRows(),
  }));

  const result = await runSdd(cwd, ["doctor", "--rule-version", "--rules", registryPath, "--format=json"]);
  assert.equal(result.code, 1);
  const body = JSON.parse(result.stdout) as {
    ok: boolean;
    drift: Array<{ kind: string; remediation: string }>;
  };
  assert.equal(body.ok, false);
  const versionMismatch = body.drift.find((d) => d.kind === "version_mismatch");
  assert.ok(versionMismatch !== undefined, `expected version_mismatch in drift, got ${JSON.stringify(body.drift)}`);
  assert.match(versionMismatch.remediation, /outside the registry range/);
});

test("doctor reports missing_diagnostic when registry declares an unknown diagnostic-ID (BEH-027)", async () => {
  const rows = fullCoverageRows();
  rows.push({
    enfId: "ENF-999",
    ruleName: "made-up rule",
    maturity: "implemented",
    diagnosticId: "sdd:never-seen-this-rule",
  });
  const { registryPath, cwd } = await fixtureRegistry(buildRegistry({
    compatRange: ">=0.1 <2.0",
    rows,
  }));

  const result = await runSdd(cwd, ["doctor", "--rule-version", "--rules", registryPath, "--format=json"]);
  assert.equal(result.code, 1);
  const body = JSON.parse(result.stdout) as {
    drift: Array<{ kind: string; id: string }>;
  };
  const missing = body.drift.find((d) => d.kind === "missing_diagnostic");
  assert.ok(missing !== undefined, `expected missing_diagnostic, got ${JSON.stringify(body.drift)}`);
  assert.equal(missing.id, "sdd:never-seen-this-rule");
});

test("doctor reports stale_diagnostic when registry omits a known DiagnosticRegistry constant (BEH-027)", async () => {
  // Remove sdd:weasel-word from the registry; expect stale_diagnostic.
  const rows = fullCoverageRows().filter((r) => r.diagnosticId !== "sdd:weasel-word");
  const { registryPath, cwd } = await fixtureRegistry(buildRegistry({
    compatRange: ">=0.1 <2.0",
    rows,
  }));

  const result = await runSdd(cwd, ["doctor", "--rule-version", "--rules", registryPath, "--format=json"]);
  assert.equal(result.code, 1);
  const body = JSON.parse(result.stdout) as {
    drift: Array<{ kind: string; id: string }>;
  };
  const stale = body.drift.find((d) => d.kind === "stale_diagnostic" && d.id === "sdd:weasel-word");
  assert.ok(stale !== undefined, `expected stale_diagnostic for sdd:weasel-word, got ${JSON.stringify(body.drift)}`);
});

test("doctor exits 2 with registry-not-found when --rules points to a missing file (BEH-028)", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "sdd-doctor-nf-"));

  const result = await runSdd(cwd, [
    "doctor",
    "--rule-version",
    "--rules", "/does/not/exist/registry.md",
    "--format=json",
  ]);
  assert.equal(result.code, 2);
  const body = JSON.parse(result.stdout) as { ok: boolean; kind: string; path: string };
  assert.equal(body.ok, false);
  assert.equal(body.kind, "registry-not-found");
  assert.equal(body.path, "/does/not/exist/registry.md");
});

test("doctor without --rule-version exits 2", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "sdd-doctor-mode-"));

  const result = await runSdd(cwd, ["doctor", "--format=json"]);
  assert.equal(result.code, 2);
  // The argv parser refuses with "doctor requires --rule-version"; envelope
  // shape is the parser's generic error stream.
  assert.match(result.stderr, /doctor requires --rule-version/);
});

test("doctor reports planned-maturity rows as not declared, not as drift (BEH-026)", async () => {
  // A registry where every implemented row matches DiagnosticRegistry, plus
  // some `planned` rows that should NOT cause drift.
  const rows = fullCoverageRows();
  rows.push({
    enfId: "ENF-PLANNED",
    ruleName: "future rule",
    maturity: "planned",
    diagnosticId: "sdd:future-rule",
  });
  const { registryPath, cwd } = await fixtureRegistry(buildRegistry({
    compatRange: ">=0.1 <2.0",
    rows,
  }));

  const result = await runSdd(cwd, ["doctor", "--rule-version", "--rules", registryPath, "--format=json"]);
  assert.equal(result.code, 0, `stdout=${result.stdout}`);
  const body = JSON.parse(result.stdout) as { ok: boolean; drift: unknown[] };
  assert.equal(body.ok, true);
  assert.deepEqual(body.drift, []);
});

test("doctor is read-only on its --rules input (INV-013)", async () => {
  const content = buildRegistry({ compatRange: ">=0.1 <2.0", rows: fullCoverageRows() });
  const { registryPath, cwd } = await fixtureRegistry(content);

  const before = await readFile(registryPath, "utf8");
  await runSdd(cwd, ["doctor", "--rule-version", "--rules", registryPath, "--format=json"]);
  const after = await readFile(registryPath, "utf8");

  assert.equal(after, before, "registry file must be byte-identical before and after doctor runs");
});
