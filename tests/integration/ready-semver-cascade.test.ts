// @covers sdd-cli:BEH-040
// @covers sdd-cli:BEH-049
// @covers sdd-cli:CTR-025
// @covers sdd-cli:INV-014
//
// End-to-end coverage for the P2.3 semver cascade pass. Spec-diff unit tests
// cover the classifier in isolation; this file pins the CLI invocation
// against a real two-commit git fixture.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { runSdd } from "./_helpers.js";

const exec = promisify(execFile);

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
  discovery_scope: ["src", "spec"],
  mechanism: "git_tree_hash_v1",
};

interface ReadyEnvelope {
  ok: boolean;
  violations: Array<{
    kind: string;
    id?: string;
    expected?: string;
    actual?: string;
    file?: string;
    remediation?: string;
  }>;
}

const surfaceContract = (surVersion: string, ctrSchema: string, ctrNotes?: string): string => {
  const lines: string[] = [];
  lines.push("```yaml");
  lines.push("---");
  lines.push("id: fixture:SUR-1");
  lines.push("type: Surface");
  lines.push("lifecycle:");
  lines.push("  status: approved");
  lines.push("  approval_record:");
  lines.push("    owner_role: tech-lead");
  lines.push("    approver_identity: alice");
  lines.push("    timestamp: 2026-04-01T00:00:00.000Z");
  lines.push("    change_request: https://example.com/pr/1");
  lines.push("    scope: first-time-approval");
  lines.push("partition_id: fixture");
  lines.push("name: fixture/api");
  lines.push(`version: "${surVersion}"`);
  lines.push("boundary_type: api");
  lines.push("members:");
  lines.push("  - fixture:CTR-1");
  lines.push("consumer_compat_policy: semver_per_surface");
  lines.push("---");
  lines.push("```");
  lines.push("");
  lines.push("```yaml");
  lines.push("---");
  lines.push("id: fixture:CTR-1");
  lines.push("type: Contract");
  lines.push("lifecycle:");
  lines.push("  status: approved");
  lines.push("  approval_record:");
  lines.push("    owner_role: tech-lead");
  lines.push("    approver_identity: alice");
  lines.push("    timestamp: 2026-04-01T00:00:00.000Z");
  lines.push("    change_request: https://example.com/pr/1");
  lines.push("    scope: first-time-approval");
  lines.push("partition_id: fixture");
  lines.push("title: contract under cascade test");
  lines.push("surface_ref: fixture:SUR-1");
  lines.push(`schema:`);
  lines.push(`  ${ctrSchema}`);
  if (ctrNotes !== undefined) lines.push(`notes: |`), lines.push(`  ${ctrNotes}`);
  lines.push("applicability:");
  lines.push("  invariant_to_all_axes: true");
  lines.push("concurrency_model:");
  lines.push("  actor_concurrency: single_per_process");
  lines.push("  read_consistency: strong");
  lines.push("  idempotency: none");
  lines.push("  time_source: none");
  lines.push("data_scope: all_data");
  lines.push("policy_refs:");
  lines.push("  - fixture:POL-001");
  lines.push("test_obligation:");
  lines.push("  predicate: |");
  lines.push("    Cascade fixture.");
  lines.push("  test_template: integration");
  lines.push("---");
  lines.push("```");
  return lines.join("\n");
};

async function fixtureProject(specBody: string): Promise<{ root: string }> {
  const root = await mkdtemp(join(tmpdir(), "sdd-cascade-"));
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify(CONFIG, null, 2));
  await writeFile(join(root, "spec", "spec.md"), `${PARTITION_SHELL}\n${specBody}\n`);
  return { root };
}

async function gitInit(root: string): Promise<void> {
  await exec("git", ["init", "-q", "-b", "main"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await exec("git", ["config", "user.name", "test"], { cwd: root });
}

async function gitCommitAll(root: string, message: string): Promise<string> {
  await exec("git", ["add", "-A"], { cwd: root });
  await exec("git", ["commit", "-q", "-m", message], { cwd: root });
  const { stdout } = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  return stdout.trim();
}

async function rewriteSpec(root: string, body: string): Promise<void> {
  await writeFile(join(root, "spec", "spec.md"), `${PARTITION_SHELL}\n${body}\n`);
}

async function snapshot(path: string): Promise<{ size: number; mtimeMs: number; sha: string }> {
  const st = await stat(path);
  const buf = await readFile(path);
  const sha = (await import("node:crypto")).createHash("sha256").update(buf).digest("hex");
  return { size: st.size, mtimeMs: st.mtimeMs, sha };
}

test("BEH-040: schema change → surface_semver_cascade requires major when bump is patch", async () => {
  const { root } = await fixtureProject(surfaceContract("0.1.0", "field_a: string"));
  await gitInit(root);
  const baseSha = await gitCommitAll(root, "base");

  // Predicate change in CTR-1.schema; Surface stays at 0.1.0 (no bump).
  await rewriteSpec(root, surfaceContract("0.1.0", "field_b: integer"));
  await gitCommitAll(root, "schema change");

  const r = await runSdd(root, ["ready", "--against", baseSha, "--format=json"]);
  const body = JSON.parse(r.stdout) as ReadyEnvelope;
  const fired = body.violations.filter((v) => v.kind === "surface_semver_cascade");
  assert.equal(fired.length, 1, JSON.stringify(body.violations));
  assert.equal(fired[0]!.id, "fixture:SUR-1");
  assert.equal(fired[0]!.expected, "major");
});

test("BEH-040: notes change → surface_semver_cascade requires minor when bump is patch", async () => {
  const { root } = await fixtureProject(surfaceContract("0.1.0", "field_a: string", "v1"));
  await gitInit(root);
  const baseSha = await gitCommitAll(root, "base");

  // Content change in notes only; Surface stays at 0.1.0.
  await rewriteSpec(root, surfaceContract("0.1.0", "field_a: string", "v2"));
  await gitCommitAll(root, "notes change");

  const r = await runSdd(root, ["ready", "--against", baseSha, "--format=json"]);
  const body = JSON.parse(r.stdout) as ReadyEnvelope;
  const fired = body.violations.filter((v) => v.kind === "surface_semver_cascade");
  assert.equal(fired.length, 1);
  assert.equal(fired[0]!.expected, "minor");
});

test("BEH-040: schema change with major bump declared → silent (declared >= required)", async () => {
  const { root } = await fixtureProject(surfaceContract("0.1.0", "field_a: string"));
  await gitInit(root);
  const baseSha = await gitCommitAll(root, "base");

  // Predicate change AND Surface bumps to 1.0.0 (major).
  await rewriteSpec(root, surfaceContract("1.0.0", "field_b: integer"));
  await gitCommitAll(root, "schema change with major bump");

  const r = await runSdd(root, ["ready", "--against", baseSha, "--format=json"]);
  const body = JSON.parse(r.stdout) as ReadyEnvelope;
  const fired = body.violations.filter((v) => v.kind === "surface_semver_cascade");
  assert.deepEqual(fired, []);
});

test("BEH-040: no spec change → silent", async () => {
  const { root } = await fixtureProject(surfaceContract("0.1.0", "field_a: string"));
  await gitInit(root);
  const baseSha = await gitCommitAll(root, "base");

  // Touch a file outside discovery_scope so HEAD advances but spec is unchanged.
  await writeFile(join(root, "src.txt"), "hello");
  await gitCommitAll(root, "no-op");

  const r = await runSdd(root, ["ready", "--against", baseSha, "--format=json"]);
  const body = JSON.parse(r.stdout) as ReadyEnvelope;
  const fired = body.violations.filter((v) => v.kind === "surface_semver_cascade");
  assert.deepEqual(fired, []);
});

test("BEH-040: ready without --against runs no cascade pass at all (CTR-025)", async () => {
  const { root } = await fixtureProject(surfaceContract("0.1.0", "field_a: string"));
  await gitInit(root);
  await gitCommitAll(root, "base");

  // Mutate the working tree (not committed) so a cascade WOULD trigger if the
  // pass ran; without --against, the cascade pass is skipped entirely.
  await rewriteSpec(root, surfaceContract("0.1.0", "field_b: integer"));

  const r = await runSdd(root, ["ready", "--format=json"]);
  const body = JSON.parse(r.stdout) as ReadyEnvelope;
  const fired = body.violations.filter((v) => v.kind === "surface_semver_cascade");
  assert.deepEqual(fired, []);
});

test("BEH-049 / ENF-019: GeneratedArtifact(published_surface=yes) structural diff fires generated_artifact_structural_diff_unbumped", async () => {
  // Surface SUR-1 reaches a published GA. Mutate the GA's outputs (a
  // predicate-bearing field for GeneratedArtifact) and bump SUR-1 only minor.
  // Cascade requires major. We expect BOTH surface_semver_cascade and
  // generated_artifact_structural_diff_unbumped because the GA-specific
  // violation is a more specific signal layered on top.
  const fixtureWithGA = (gaOutputs: string, surVersion: string): string => [
    "```yaml",
    "---",
    "id: fixture:SUR-1",
    "type: Surface",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-01T00:00:00.000Z",
    "    change_request: https://example.com/pr/1",
    "    scope: first-time-approval",
    "partition_id: fixture",
    "name: fixture/api",
    `version: "${surVersion}"`,
    "boundary_type: api",
    "members:",
    "  - fixture:GEN-1",
    "consumer_compat_policy: semver_per_surface",
    "---",
    "```",
    "",
    "```yaml",
    "---",
    "id: fixture:GEN-1",
    "type: GeneratedArtifact",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-01T00:00:00.000Z",
    "    change_request: https://example.com/pr/1",
    "    scope: first-time-approval",
    "partition_id: fixture",
    "title: published artifact",
    "generator: openapi-codegen",
    "inputs:",
    "  - fixture/api.yaml",
    "outputs:",
    `  - ${gaOutputs}`,
    "published_surface: yes",
    "surface_ref: fixture:SUR-1",
    "applicability:",
    "  invariant_to_all_axes: true",
    "data_scope: not_applicable",
    "applicability_reason: generated artifact",
    "test_obligation:",
    "  predicate: |",
    "    Cascade fixture.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");

  const { root } = await fixtureProject(fixtureWithGA("client-v1.ts", "0.1.0"));
  await gitInit(root);
  const baseSha = await gitCommitAll(root, "base");

  // Predicate change in GA outputs (generated symbol names changed).
  // Surface bumps minor only — cascade requires major.
  await rewriteSpec(root, fixtureWithGA("client-v2.ts", "0.2.0"));
  await gitCommitAll(root, "GA shape change");

  const r = await runSdd(root, ["ready", "--against", baseSha, "--format=json"]);
  const body = JSON.parse(r.stdout) as ReadyEnvelope;
  const fired = body.violations.filter((v) => v.kind === "generated_artifact_structural_diff_unbumped");
  assert.equal(fired.length, 1, JSON.stringify(body.violations));
  assert.equal(fired[0]!.id, "fixture:SUR-1");
  assert.equal(fired[0]!.expected, "major");
  assert.match(fired[0]!.remediation ?? "", /fixture:GEN-1/);
});

test("BEH-049: published GA with no diff is silent", async () => {
  const fixtureWithGA = (gaOutputs: string): string => [
    "```yaml",
    "---",
    "id: fixture:SUR-1",
    "type: Surface",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-01T00:00:00.000Z",
    "    change_request: https://example.com/pr/1",
    "    scope: first-time-approval",
    "partition_id: fixture",
    "name: fixture/api",
    `version: "0.1.0"`,
    "boundary_type: api",
    "members:",
    "  - fixture:GEN-1",
    "consumer_compat_policy: semver_per_surface",
    "---",
    "```",
    "",
    "```yaml",
    "---",
    "id: fixture:GEN-1",
    "type: GeneratedArtifact",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-01T00:00:00.000Z",
    "    change_request: https://example.com/pr/1",
    "    scope: first-time-approval",
    "partition_id: fixture",
    "title: published artifact",
    "generator: openapi-codegen",
    "outputs:",
    `  - ${gaOutputs}`,
    "published_surface: yes",
    "surface_ref: fixture:SUR-1",
    "applicability:",
    "  invariant_to_all_axes: true",
    "data_scope: not_applicable",
    "applicability_reason: generated artifact",
    "test_obligation:",
    "  predicate: |",
    "    Silent fixture.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");

  const { root } = await fixtureProject(fixtureWithGA("client-v1.ts"));
  await gitInit(root);
  const baseSha = await gitCommitAll(root, "base");

  // No spec change, just advance HEAD.
  await writeFile(join(root, "src.txt"), "hello");
  await gitCommitAll(root, "no-op");

  const r = await runSdd(root, ["ready", "--against", baseSha, "--format=json"]);
  const body = JSON.parse(r.stdout) as ReadyEnvelope;
  const fired = body.violations.filter((v) => v.kind === "generated_artifact_structural_diff_unbumped");
  assert.deepEqual(fired, []);
});

test("BEH-049: GA with published_surface=no is NOT in scope for ENF-019", async () => {
  const fixtureWithUnpublishedGA = (gaOutputs: string): string => [
    "```yaml",
    "---",
    "id: fixture:SUR-1",
    "type: Surface",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-01T00:00:00.000Z",
    "    change_request: https://example.com/pr/1",
    "    scope: first-time-approval",
    "partition_id: fixture",
    "name: fixture/api",
    `version: "0.1.0"`,
    "boundary_type: api",
    "members:",
    "  - fixture:GEN-1",
    "consumer_compat_policy: semver_per_surface",
    "---",
    "```",
    "",
    "```yaml",
    "---",
    "id: fixture:GEN-1",
    "type: GeneratedArtifact",
    "lifecycle:",
    "  status: approved",
    "  approval_record:",
    "    owner_role: tech-lead",
    "    approver_identity: alice",
    "    timestamp: 2026-04-01T00:00:00.000Z",
    "    change_request: https://example.com/pr/1",
    "    scope: first-time-approval",
    "partition_id: fixture",
    "title: internal artifact",
    "generator: openapi-codegen",
    "outputs:",
    `  - ${gaOutputs}`,
    "published_surface: no",
    "applicability:",
    "  invariant_to_all_axes: true",
    "data_scope: not_applicable",
    "applicability_reason: generated artifact",
    "test_obligation:",
    "  predicate: |",
    "    Internal-GA fixture.",
    "  test_template: integration",
    "---",
    "```",
  ].join("\n");

  const { root } = await fixtureProject(fixtureWithUnpublishedGA("client-v1.ts"));
  await gitInit(root);
  const baseSha = await gitCommitAll(root, "base");
  await rewriteSpec(root, fixtureWithUnpublishedGA("client-v2.ts"));
  await gitCommitAll(root, "GA change");

  const r = await runSdd(root, ["ready", "--against", baseSha, "--format=json"]);
  const body = JSON.parse(r.stdout) as ReadyEnvelope;
  const fired = body.violations.filter((v) => v.kind === "generated_artifact_structural_diff_unbumped");
  assert.deepEqual(fired, []);
});

test("INV-014: cascade pass NEVER writes to spec.md (every fixture is byte-stable)", async () => {
  const { root } = await fixtureProject(surfaceContract("0.1.0", "field_a: string"));
  await gitInit(root);
  const baseSha = await gitCommitAll(root, "base");

  // Predicate change; Surface stays patch — cascade fires.
  await rewriteSpec(root, surfaceContract("0.1.0", "field_b: integer"));
  await gitCommitAll(root, "schema change");

  const before = await snapshot(join(root, "spec", "spec.md"));
  await runSdd(root, ["ready", "--against", baseSha, "--format=json"]);
  const after = await snapshot(join(root, "spec", "spec.md"));

  assert.equal(after.size, before.size);
  assert.equal(after.sha, before.sha);
});
