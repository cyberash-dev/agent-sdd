import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSdd } from "./_helpers.js";

const SPEC = [
  "# fixture",
  "",
  "```yaml",
  "---",
  "id: fixture:BEH-001",
  "type: Behavior",
  "lifecycle:",
  "  status: proposed",
  "title: first behavior",
  "---",
  "```",
  "",
  "```yaml",
  "---",
  "id: fixture:INV-001",
  "type: Invariant",
  "lifecycle:",
  "  status: approved",
  "never: nothing happens",
  "---",
  "```",
  "",
  "```yaml",
  "---",
  "id: fixture:SUR-001",
  "type: Surface",
  "lifecycle:",
  "  status: draft",
  "name: fixture/thing",
  'version: "0.1.0"',
  "---",
  "```",
  "",
].join("\n");

const INV_001_BODY = [
  "id: fixture:INV-001",
  "type: Invariant",
  "lifecycle:",
  "  status: approved",
  "never: nothing happens",
].join("\n");

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "sdd-record-"));
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify({
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
  }, null, 2));
  await writeFile(join(root, "spec", "spec.md"), SPEC);
  return root;
}

interface ListBody {
  format_version: number;
  count: number;
  records: Array<{ id: string; type: string | null; status: string | null; title: string | null; file: string; line: number }>;
}

test("BEH-054 / CTR-026: record list indexes every record (json)", async () => {
  // @covers sdd-cli:BEH-054
  // @covers sdd-cli:CTR-026
  const root = await fixture();

  const r = await runSdd(root, ["record", "list", "--format=json"]);

  assert.equal(r.code, 0);
  const body = JSON.parse(r.stdout) as ListBody;
  assert.equal(body.format_version, 1);
  assert.equal(body.count, 3);
  assert.deepEqual(body.records.map((x) => x.id), ["fixture:BEH-001", "fixture:INV-001", "fixture:SUR-001"]);

  const byId = new Map(body.records.map((x) => [x.id, x]));
  assert.equal(byId.get("fixture:BEH-001")?.title, "first behavior");
  assert.equal(byId.get("fixture:INV-001")?.title, null);
  assert.equal(byId.get("fixture:SUR-001")?.title, "fixture/thing");
  assert.equal(byId.get("fixture:INV-001")?.status, "approved");
  assert.equal(byId.get("fixture:BEH-001")?.type, "Behavior");
});

test("BEH-054: record list human output names every record", async () => {
  // @covers sdd-cli:BEH-054
  const root = await fixture();

  const r = await runSdd(root, ["record", "list"]);

  assert.equal(r.code, 0);
  assert.match(r.stdout, /fixture:BEH-001/);
  assert.match(r.stdout, /fixture:INV-001/);
  assert.match(r.stdout, /fixture:SUR-001/);
});

test("BEH-055 / CTR-027: record get returns the verbatim block (json)", async () => {
  // @covers sdd-cli:BEH-055
  // @covers sdd-cli:CTR-027
  const root = await fixture();

  const r = await runSdd(root, ["record", "get", "fixture:INV-001", "--format=json"]);

  assert.equal(r.code, 0);
  const body = JSON.parse(r.stdout) as { format_version: number; found: boolean; id: string; raw: string };
  assert.equal(body.format_version, 1);
  assert.equal(body.found, true);
  assert.equal(body.id, "fixture:INV-001");
  assert.equal(body.raw, INV_001_BODY);
});

test("BEH-055: record get prints the verbatim block (human)", async () => {
  // @covers sdd-cli:BEH-055
  const root = await fixture();

  const r = await runSdd(root, ["record", "get", "fixture:INV-001"]);

  assert.equal(r.code, 0);
  assert.equal(r.stdout.trimEnd(), INV_001_BODY);
});

test("BEH-056 / CTR-027: record get on unknown id exits 1", async () => {
  // @covers sdd-cli:BEH-056
  // @covers sdd-cli:CTR-027
  const root = await fixture();

  const r = await runSdd(root, ["record", "get", "fixture:NOPE-999"]);

  assert.equal(r.code, 1);
  assert.match(r.stderr, /record not found: fixture:NOPE-999/);
});

test("BEH-056: record get unknown id json reports found false", async () => {
  // @covers sdd-cli:BEH-056
  const root = await fixture();

  const r = await runSdd(root, ["record", "get", "fixture:NOPE-999", "--format=json"]);

  assert.equal(r.code, 1);
  const body = JSON.parse(r.stdout) as { found: boolean; id: string };
  assert.equal(body.found, false);
  assert.equal(body.id, "fixture:NOPE-999");
});

test("BEH-057: invalid record invocation exits 2", async () => {
  // @covers sdd-cli:BEH-057
  const root = await fixture();

  const noSub = await runSdd(root, ["record"]);
  const unknown = await runSdd(root, ["record", "bogus"]);
  const getNoId = await runSdd(root, ["record", "get"]);

  assert.equal(noSub.code, 2);
  assert.equal(unknown.code, 2);
  assert.equal(getNoId.code, 2);
  assert.match(getNoId.stderr, /record/);
});
